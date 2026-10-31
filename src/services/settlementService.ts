import { MemberBalance, Settlement } from '../types';
import { parseMoneyAmount } from './money';
import { supabase } from './supabase';
import { throwServiceError } from './serviceErrors';

interface SettlementRow {
  id: string;
  book_id: string;
  from_user: string;
  to_user: string;
  amount: number | string;
  entry_date: string;
  created_by: string;
  created_at: string;
}

const mapSettlement = (row: SettlementRow): Settlement => ({
  id: row.id,
  bookId: row.book_id,
  fromUser: row.from_user,
  toUser: row.to_user,
  amount: parseMoneyAmount(row.amount),
  entryDate: row.entry_date,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const requireDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Settlement date must use YYYY-MM-DD format.');
  }
};

const amountForDatabase = (value: number | string) => {
  const raw = String(value).trim();
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(raw) || parseMoneyAmount(raw) <= 0) {
    throw new Error('Enter a positive settlement amount with up to two decimal places.');
  }
  return raw;
};

export const settlementService = {
  async recordSettlement(bookId: string, toUser: string, amount: number | string, entryDate: string): Promise<string> {
    requireDate(entryDate);
    try {
      const { data, error } = await supabase.rpc('record_settlement', {
        p_book_id: bookId,
        p_to_user: toUser,
        p_amount: amountForDatabase(amount),
        p_entry_date: entryDate,
      });
      if (error) throw error;
      if (typeof data !== 'string') throw new Error('The settlement was saved without a returned reference.');
      return data;
    } catch (error) {
      return throwServiceError(error, 'Could not record settlement');
    }
  },

  async deleteSettlement(settlementId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('soft_delete_settlement', { p_settlement_id: settlementId });
      if (error) throw error;
    } catch (error) {
      return throwServiceError(error, 'Could not delete settlement');
    }
  },

  async listSettlements(bookId: string): Promise<Settlement[]> {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .select('id,book_id,from_user,to_user,amount,entry_date,created_by,created_at')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as SettlementRow[]).map(mapSettlement);
    } catch (error) {
      return throwServiceError(error, 'Could not load settlement history');
    }
  },

  async getMemberBalances(bookId: string): Promise<MemberBalance[]> {
    try {
      const { data, error } = await supabase.rpc('book_member_balances', { p_book_id: bookId });
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{
        user_id: string;
        display_name: string;
        paid_total: number | string;
        share_total: number | string;
        settled_net: number | string;
        balance: number | string;
      }>).map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        paidTotal: parseMoneyAmount(row.paid_total),
        shareTotal: parseMoneyAmount(row.share_total),
        settledNet: parseMoneyAmount(row.settled_net),
        balance: parseMoneyAmount(row.balance),
      }));
    } catch (error) {
      return throwServiceError(error, 'Could not load member balances');
    }
  },
};
