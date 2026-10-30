import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Book, Invitation, Member } from '../types';
import { bookService } from '../services/bookService';
import { invitationService } from '../services/invitationService';
import { toServiceError } from '../services/serviceErrors';

interface Props { navigation: any; route: any; }

export const BookMembersScreen: React.FC<Props> = ({ navigation, route }) => {
  const bookId: string | undefined = route.params?.bookId;
  const initialName: string | undefined = route.params?.name;
  const { user } = useAuth();
  const { theme } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const isOwner = useMemo(() => members.some((member) => member.userId === user?.id && member.role === 'owner'), [members, user?.id]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const load = useCallback(async () => {
    if (!bookId) { setError('This book could not be opened.'); setLoading(false); return; }
    setError(null);
    try {
      const [bookInfo, memberRows] = await Promise.all([bookService.getBook(bookId), bookService.listMembers(bookId)]);
      setBook(bookInfo);
      setMembers(memberRows);
      if (memberRows.some((member) => member.userId === user?.id && member.role === 'owner')) {
        setInvitations(await invitationService.listBookPendingInvitations(bookId));
      } else setInvitations([]);
    } catch (loadError) {
      setError(toServiceError(loadError, 'Could not load book members').message);
    } finally { setLoading(false); }
  }, [bookId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const sendInvite = async () => {
    if (!bookId || !inviteEmail.trim()) return;
    setSaving(true);
    try {
      await invitationService.sendInvitation(bookId, inviteEmail);
      setInviteEmail('');
      setInviteVisible(false);
      await load();
    } catch (inviteError) {
      Alert.alert('Could not send invitation', toServiceError(inviteError, 'Could not send invitation').message);
    } finally { setSaving(false); }
  };

  const confirmRemove = (member: Member) => Alert.alert('Remove member', `Remove ${member.displayName || 'this member'} from the book?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      setActionId(member.userId);
      try { await invitationService.removeMember(bookId!, member.userId); await load(); }
      catch (actionError) { Alert.alert('Could not remove member', toServiceError(actionError, 'Could not remove member').message); }
      finally { setActionId(null); }
    } },
  ]);

  const leaveBook = () => Alert.alert('Leave book', `Leave “${book?.name ?? initialName ?? 'this book'}”?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: async () => {
      try { await invitationService.leaveBook(bookId!); navigation.goBack(); }
      catch (actionError) { Alert.alert('Could not leave book', toServiceError(actionError, 'Could not leave book').message); }
    } },
  ]);

  const revokeInvitation = (invitation: Invitation) => Alert.alert('Revoke invitation', `Revoke the invitation for ${invitation.invitedEmail}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Revoke', style: 'destructive', onPress: async () => {
      setActionId(invitation.id);
      try { await invitationService.revokeInvitation(invitation.id); await load(); }
      catch (actionError) { Alert.alert('Could not revoke invitation', toServiceError(actionError, 'Could not revoke invitation').message); }
      finally { setActionId(null); }
    } },
  ]);

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color={theme.colors.text} /></TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{book?.name ?? initialName ?? 'Members'}</Text>
      {isOwner ? <TouchableOpacity style={styles.iconButton} onPress={() => setInviteVisible(true)} accessibilityRole="button" accessibilityLabel="Invite member"><Ionicons name="person-add-outline" size={22} color={theme.colors.primaryVariant} /></TouchableOpacity> : <View style={styles.iconButton} />}
    </View>
    {loading ? <View style={styles.state}><ActivityIndicator color={theme.colors.primary} /></View>
      : error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); void load(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
        : <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Members <Text style={styles.sectionCount}>{members.length}</Text></Text>
          <View style={styles.card}>{members.map((member) => <View key={member.userId} style={styles.row}>
            <View style={styles.avatar}><Ionicons name="person" size={18} color={theme.colors.primaryVariant} /></View>
            <View style={styles.memberCopy}><Text style={styles.memberName}>{member.displayName || 'Member'}{member.userId === user?.id ? ' (you)' : ''}</Text><Text style={styles.memberRole}>{member.role}</Text></View>
            {isOwner && member.userId !== user?.id && <TouchableOpacity style={styles.rowAction} onPress={() => confirmRemove(member)} disabled={actionId === member.userId} accessibilityRole="button" accessibilityLabel={`Remove ${member.displayName || 'member'}`}>
              {actionId === member.userId ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Ionicons name="person-remove-outline" size={20} color={theme.colors.error} />}
            </TouchableOpacity>}
          </View>)}</View>
          {isOwner && <>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Invitations</Text><TouchableOpacity style={styles.rowAction} onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Refresh invitations"><Ionicons name="refresh" size={19} color={theme.colors.primaryVariant} /></TouchableOpacity></View>
            <View style={styles.card}>{invitations.length === 0 ? <Text style={styles.muted}>No pending invitations.</Text> : invitations.map((invitation) => <View key={invitation.id} style={styles.row}>
              <View style={styles.memberCopy}><Text style={styles.memberName}>{invitation.invitedEmail}</Text><Text style={styles.memberRole}>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</Text></View>
              <TouchableOpacity style={styles.rowAction} onPress={() => revokeInvitation(invitation)} disabled={actionId === invitation.id} accessibilityRole="button" accessibilityLabel={`Revoke invitation for ${invitation.invitedEmail}`}><Text style={styles.revokeText}>{actionId === invitation.id ? '…' : 'Revoke'}</Text></TouchableOpacity>
            </View>)}</View>
          </>}
          {members.some((member) => member.userId === user?.id) && <TouchableOpacity style={styles.leaveButton} onPress={leaveBook} accessibilityRole="button"><Ionicons name="exit-outline" size={20} color={theme.colors.error} /><Text style={styles.leaveText}>Leave book</Text></TouchableOpacity>}
        </ScrollView>}
    <Modal visible={inviteVisible} animationType="slide" transparent onRequestClose={() => setInviteVisible(false)}>
      <View style={styles.modalOverlay}><View style={styles.modalCard}>
        <View style={styles.modalHeader}><Text style={styles.sectionTitle}>Invite member</Text><TouchableOpacity style={styles.rowAction} onPress={() => setInviteVisible(false)} accessibilityRole="button" accessibilityLabel="Close invite form"><Ionicons name="close" size={22} color={theme.colors.textSecondary} /></TouchableOpacity></View>
        <TextInput style={styles.input} value={inviteEmail} onChangeText={setInviteEmail} placeholder="Email address" placeholderTextColor={theme.colors.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Invitation email address" />
        <TouchableOpacity style={styles.primaryButton} onPress={() => void sendInvite()} disabled={saving} accessibilityRole="button"><Text style={styles.primaryText}>{saving ? 'Sending…' : 'Send invitation'}</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </SafeAreaView>;
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: theme.typeSize.subtitle, fontWeight: '700', color: theme.colors.text },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  content: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.xxl },
  sectionTitle: { fontSize: theme.typeSize.subtitle, color: theme.colors.text, fontWeight: '700', marginBottom: theme.spacing.md },
  sectionCount: { color: theme.colors.textSecondary, fontWeight: '500' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.borderLight },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight, gap: theme.spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceVariant },
  memberCopy: { flex: 1 },
  memberName: { fontSize: theme.typeSize.body, color: theme.colors.text, fontWeight: '600' },
  memberRole: { fontSize: theme.typeSize.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xxs, textTransform: 'capitalize' },
  rowAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  revokeText: { color: theme.colors.error, fontSize: theme.typeSize.small, fontWeight: '600' },
  muted: { color: theme.colors.textSecondary, paddingVertical: theme.spacing.lg },
  leaveButton: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 48, marginTop: theme.spacing.xl },
  leaveText: { color: theme.colors.error, fontWeight: '600' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  error: { color: theme.colors.error, textAlign: 'center' },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
  retryText: { color: theme.colors.primaryVariant, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  modalCard: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxxl, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, backgroundColor: theme.colors.surface, gap: theme.spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, color: theme.colors.text },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.primary },
  primaryText: { color: theme.colors.onPrimary, fontWeight: '700' },
});
