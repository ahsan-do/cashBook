import { supabase } from './supabase';
import { Transaction, TransactionParticipant, TransactionType } from '../types';
import { parseMoneyAmount } from './money';
import { throwServiceError } from './serviceErrors';

export type MoneyInput = number | string;

export interface TransactionCursor {
  entryDate: string;
  createdAt: string;
  id: string;
}

export interface TransactionFilters {
  bookId: string;
  pageSize?: number;
  cursor?: TransactionCursor | null;
  type?: TransactionType | null;
  fromDate?: string | null;
  /** Exclusive upper date boundary, matching the book_transaction_page RPC. */
  toDate?: string | null;
}

export interface TransactionPage {
  transactions: Transaction[];
  nextCursor: TransactionCursor | null;
}

export interface AddTransactionInput {
  bookId: string;
  title: string;
  amount: MoneyInput;
  type: TransactionType;
  entryDate?: string;
  category?: string;
  description?: string | null;
}

export interface SharedTransactionInput extends Omit<AddTransactionInput, 'type' | 'entryDate'> {
  type: 'cash_out';
  entryDate: string;
  paidBy: string;
  participants: string[];
}

export interface EditSharedTransactionInput extends Omit<SharedTransactionInput, 'bookId' | 'type'> {
  bookId: string;
}

export type EditableTransactionFields = Partial<
  Pick<Transaction, 'title' | 'type' | 'category' | 'description' | 'entryDate'> & {
    amount: MoneyInput;
  }
>;

interface TransactionRow {
  id: string;
  book_id: string;
  title: string;
  amount: number | string;
  type: TransactionType;
  category: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  entry_date: string;
  running_balance: number | string | null;
  created_by_name?: string | null;
  paid_by?: string | null;
  paid_by_name?: string | null;
  participants?: Array<{ user_id: string; display_name: string | null }> | null;
}

const transactionColumns = 'id,book_id,title,amount,type,category,description,created_by,created_at,updated_at,entry_date';

const mapTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  bookId: row.book_id,
  title: row.title,
  amount: parseMoneyAmount(row.amount),
  type: row.type,
  category: row.category,
  description: row.description,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  entryDate: row.entry_date,
  runningBalance: row.running_balance === null ? null : parseMoneyAmount(row.running_balance),
  createdByName: row.created_by_name ?? null,
  paidBy: row.paid_by ?? null,
  paidByName: row.paid_by_name ?? null,
  participants: (row.participants ?? []).map((participant): TransactionParticipant => ({
    userId: participant.user_id,
    displayName: participant.display_name,
  })),
});

const requireValidDate = (date: string, label: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
};

const amountForDatabase = (value: MoneyInput): string => {
  const normalized = String(value).trim();
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized) || parseMoneyAmount(normalized) <= 0) {
    throw new Error('Amount must be positive and have no more than 12 whole digits and 2 decimal places.');
  }
  return normalized;
};

const validateTextFields = (values: { title?: string; category?: string; description?: string | null }) => {
  if (values.title !== undefined && !values.title.trim()) throw new Error('Enter a transaction title.');
  if (values.category !== undefined && values.category.length > 60) throw new Error('Category must be 60 characters or fewer.');
  if (values.description && values.description.length > 1000) throw new Error('Description must be 1000 characters or fewer.');
};

export const transactionService = {
  async pageTransactions(filters: TransactionFilters): Promise<TransactionPage> {
    const pageSize = filters.pageSize ?? 50;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new Error('Page size must be between 1 and 100.');
    }
    if (filters.fromDate != null) requireValidDate(filters.fromDate, 'Start date');
    if (filters.toDate != null) requireValidDate(filters.toDate, 'End date');
    if (filters.cursor) requireValidDate(filters.cursor.entryDate, 'Cursor date');

    try {
      const { data, error } = await supabase.rpc('book_transaction_page', {
        p_book_id: filters.bookId,
        p_limit: pageSize,
        p_before_entry_date: filters.cursor?.entryDate ?? null,
        p_before_created_at: filters.cursor?.createdAt ?? null,
        p_before_id: filters.cursor?.id ?? null,
        p_type: filters.type ?? null,
        p_from: filters.fromDate ?? null,
        p_to: filters.toDate ?? null,
      });
      if (error) throw error;
      const rows = (data ?? []) as unknown as TransactionRow[];
      const transactions = rows.map(mapTransaction);
      const last = transactions[transactions.length - 1];
      return {
        transactions,
        // A full page may be followed by an empty page when it was the final one.
        nextCursor: rows.length === pageSize && last
          ? { entryDate: last.entryDate, createdAt: last.createdAt, id: last.id }
          : null,
      };
    } catch (error) {
      return throwServiceError(error, 'Could not load transactions');
    }
  },

  /** Totals are calculated by the database; the client never sums transactions. */
  async getBookTotals(bookId: string): Promise<{ cashInTotal: number; cashOutTotal: number; netBalance: number }> {
    try {
      const { data, error } = await supabase.rpc('book_totals', { p_book_id: bookId });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { cash_in_total: number | string; cash_out_total: number | string; net_balance: number | string }
        | null;
      if (!row) throw new Error('The database did not return book totals.');
      return {
        cashInTotal: parseMoneyAmount(row.cash_in_total),
        cashOutTotal: parseMoneyAmount(row.cash_out_total),
        netBalance: parseMoneyAmount(row.net_balance),
      };
    } catch (error) {
      return throwServiceError(error, 'Could not load book totals');
    }
  },

  async addTransaction(input: AddTransactionInput): Promise<Transaction> {
    const title = input.title.trim();
    const category = input.category?.trim() || 'General';
    const description = input.description?.trim() || null;
    validateTextFields({ title, category, description });
    if (input.entryDate != null) requireValidDate(input.entryDate, 'Entry date');
    const amount = amountForDatabase(input.amount);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign in before adding a transaction.');

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          book_id: input.bookId,
          title,
          amount,
          type: input.type,
          entry_date: input.entryDate,
          category,
          description,
          created_by: authData.user.id,
        })
        .select(transactionColumns)
        .single();
      if (error) throw error;
      const row = data as unknown as Omit<TransactionRow, 'running_balance'>;
      return mapTransaction({ ...row, running_balance: null });
    } catch (error) {
      return throwServiceError(error, 'Could not add transaction');
    }
  },

  async addSharedTransaction(input: SharedTransactionInput): Promise<string> {
    if (input.type !== 'cash_out') throw new Error('Only cash-out entries can be shared.');
    const title = input.title.trim();
    const category = input.category?.trim() || 'General';
    const description = input.description?.trim() || null;
    validateTextFields({ title, category, description });
    requireValidDate(input.entryDate, 'Entry date');
    if (!input.paidBy) throw new Error('Choose who paid for this expense.');
    if (!input.participants.length) throw new Error('Choose at least one participant.');
    const amount = amountForDatabase(input.amount);
    try {
      const { data, error } = await supabase.rpc('add_shared_transaction', {
        p_book_id: input.bookId,
        p_title: title,
        p_amount: amount,
        p_category: category,
        p_description: description,
        p_entry_date: input.entryDate,
        p_paid_by: input.paidBy,
        p_participants: input.participants,
      });
      if (error) throw error;
      if (typeof data !== 'string') throw new Error('The shared expense was saved without a transaction reference.');
      return data;
    } catch (error) {
      return throwServiceError(error, 'Could not add shared expense');
    }
  },

  async editSharedTransaction(transaction: Transaction, updates: EditSharedTransactionInput): Promise<void> {
    const title = updates.title.trim();
    const category = updates.category?.trim() || 'General';
    const description = updates.description?.trim() || null;
    validateTextFields({ title, category, description });
    requireValidDate(updates.entryDate, 'Entry date');
    if (!updates.paidBy) throw new Error('Choose who paid for this expense.');
    if (!updates.participants.length) throw new Error('Choose at least one participant.');
    const amount = amountForDatabase(updates.amount);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign in before editing a shared expense.');
      if (authData.user.id !== transaction.createdBy) throw new Error('Only the person who added this expense can edit it.');
      const { error } = await supabase.rpc('edit_shared_transaction', {
        p_transaction_id: transaction.id,
        p_book_id: updates.bookId,
        p_title: title,
        p_amount: amount,
        p_category: category,
        p_description: description,
        p_entry_date: updates.entryDate,
        p_paid_by: updates.paidBy,
        p_participants: updates.participants,
      });
      if (error) throw error;
    } catch (error) {
      return throwServiceError(error, 'Could not update shared expense');
    }
  },

  async editTransaction(transactionId: string, updates: EditableTransactionFields): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.amount !== undefined) payload.amount = amountForDatabase(updates.amount);
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.category !== undefined) payload.category = updates.category.trim();
    if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
    if (updates.entryDate !== undefined) {
      requireValidDate(updates.entryDate, 'Entry date');
      payload.entry_date = updates.entryDate;
    }
    validateTextFields({
      title: updates.title === undefined ? undefined : String(payload.title),
      category: updates.category === undefined ? undefined : String(payload.category),
      description: updates.description === undefined ? undefined : payload.description as string | null,
    });
    if (!Object.keys(payload).length) throw new Error('Provide at least one transaction field to update.');

    try {
      const { error, count } = await supabase
        .from('transactions')
        .update(payload, { count: 'exact' })
        .eq('id', transactionId);
      if (error) throw error;
      if (count === 0) throw new Error('Transaction was not found or you are not allowed to edit it.');
    } catch (error) {
      return throwServiceError(error, 'Could not update transaction');
    }
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('soft_delete_transaction', {
        p_transaction_id: transactionId,
      });
      if (error) throw error;
    } catch (error) {
      return throwServiceError(error, 'Could not delete transaction');
    }
  },
};
