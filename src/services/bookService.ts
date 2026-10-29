import { supabase } from './supabase';
import { Book, Member } from '../types';
import { throwServiceError } from './serviceErrors';

interface BookRow {
  id: string;
  name: string;
  description: string | null;
  currency_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BookWithMembershipRow extends BookRow {
  book_members?: Array<{ user_id: string; role: 'owner' | 'member' }>;
}

const bookColumns = 'id,name,description,currency_code,created_by,created_at,updated_at,deleted_at';

const mapBook = (row: BookRow, memberRole?: 'owner' | 'member'): Book => ({
  id: row.id,
  name: row.name,
  description: row.description,
  currencyCode: row.currency_code,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  ...(memberRole ? { memberRole } : {}),
});

export interface CreateBookInput {
  name: string;
  currencyCode: string;
  description?: string | null;
}

export interface UpdateBookInput {
  name?: string;
  description?: string | null;
}

export const bookService = {
  /** RLS limits this query to books the signed-in user belongs to. */
  async listMyBooks(userId: string): Promise<Book[]> {
    try {
      const { data, error } = await supabase
        .from('books')
        .select(`${bookColumns},book_members!inner(user_id,role)`)
        .eq('book_members.user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as BookWithMembershipRow[]).map((row) =>
        mapBook(row, row.book_members?.[0]?.role)
      );
    } catch (error) {
      return throwServiceError(error, 'Could not load books');
    }
  },

  async createBook(input: CreateBookInput): Promise<Book> {
    try {
      const { data, error } = await supabase.rpc('create_book', {
        p_name: input.name.trim(),
        p_currency_code: input.currencyCode.trim().toUpperCase(),
        p_description: input.description?.trim() || null,
      });
      if (error) throw error;
      if (!data) throw new Error('The book was created without a returned record.');
      return mapBook(data as unknown as BookRow, 'owner');
    } catch (error) {
      return throwServiceError(error, 'Could not create book');
    }
  },

  async updateBook(bookId: string, updates: UpdateBookInput): Promise<Book> {
    const payload: { name?: string; description?: string | null } = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
    if (Object.keys(payload).length === 0) throw new Error('Provide a book name or description to update.');

    try {
      const { data, error } = await supabase
        .from('books')
        .update(payload)
        .eq('id', bookId)
        .is('deleted_at', null)
        .select(bookColumns)
        .single();
      if (error) throw error;
      return mapBook(data as unknown as BookRow);
    } catch (error) {
      return throwServiceError(error, 'Could not update book');
    }
  },

  async softDeleteBook(bookId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('soft_delete_book', { p_book_id: bookId });
      if (error) throw error;
    } catch (error) {
      throwServiceError(error, 'Could not delete book');
    }
  },

  async listMembers(bookId: string): Promise<Member[]> {
    try {
      const { data, error } = await supabase
        .from('book_members')
        .select('book_id,user_id,role,joined_at,profiles!book_members_user_id_fkey(display_name)')
        .eq('book_id', bookId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        bookId: row.book_id,
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
        displayName: row.profiles?.display_name ?? '',
      }));
    } catch (error) {
      return throwServiceError(error, 'Could not load book members');
    }
  },
};
