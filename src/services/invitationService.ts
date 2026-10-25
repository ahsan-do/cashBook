import { supabase } from './supabase';
import { Invitation, PendingInvitation } from '../types';
import { throwServiceError } from './serviceErrors';

interface InvitationRow {
  id: string;
  book_id: string;
  invited_email: string;
  invited_by: string;
  status: Invitation['status'];
  created_at: string;
  updated_at: string;
  expires_at: string;
}

const mapInvitation = (row: InvitationRow): Invitation => ({
  id: row.id,
  bookId: row.book_id,
  invitedEmail: row.invited_email,
  invitedBy: row.invited_by,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  expiresAt: row.expires_at,
});

export const invitationService = {
  async sendInvitation(bookId: string, email: string): Promise<Invitation> {
    const invitedEmail = email.trim().toLowerCase();
    if (!invitedEmail) throw new Error('Enter an email address to invite.');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign in before sending an invitation.');

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          book_id: bookId,
          invited_email: invitedEmail,
          invited_by: authData.user.id,
        })
        .select('id,book_id,invited_email,invited_by,status,created_at,updated_at,expires_at')
        .single();
      if (error) throw error;
      return mapInvitation(data as unknown as InvitationRow);
    } catch (error) {
      return throwServiceError(error, 'Could not send invitation');
    }
  },

  async listMyPendingInvitations(): Promise<PendingInvitation[]> {
    try {
      const { data, error } = await supabase.rpc('my_pending_invitations');
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{
        invitation_id: string;
        book_name: string;
        inviter_display_name: string;
        expires_at: string;
      }>).map((row) => ({
        id: row.invitation_id,
        bookName: row.book_name,
        inviterDisplayName: row.inviter_display_name,
        expiresAt: row.expires_at,
      }));
    } catch (error) {
      return throwServiceError(error, 'Could not load pending invitations');
    }
  },

  async acceptInvitation(invitationId: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('accept_invitation', {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
      if (typeof data !== 'string') throw new Error('The invitation was accepted without a book reference.');
      return data;
    } catch (error) {
      return throwServiceError(error, 'Could not accept invitation');
    }
  },

  async declineInvitation(invitationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('decline_invitation', {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
    } catch (error) {
      throwServiceError(error, 'Could not decline invitation');
    }
  },

  async revokeInvitation(invitationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('revoke_invitation', {
        p_invitation_id: invitationId,
      });
      if (error) throw error;
    } catch (error) {
      throwServiceError(error, 'Could not revoke invitation');
    }
  },

  async removeMember(bookId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('remove_member', {
        p_book_id: bookId,
        p_user_id: userId,
      });
      if (error) throw error;
    } catch (error) {
      throwServiceError(error, 'Could not remove book member');
    }
  },

  async leaveBook(bookId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('leave_book', { p_book_id: bookId });
      if (error) throw error;
    } catch (error) {
      throwServiceError(error, 'Could not leave book');
    }
  },
};
