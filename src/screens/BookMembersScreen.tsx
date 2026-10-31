import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Book, Invitation, Member, MemberBalance, Settlement } from '../types';
import { bookService } from '../services/bookService';
import { invitationService } from '../services/invitationService';
import { settlementService } from '../services/settlementService';
import { formatMoney } from '../services/money';
import { toServiceError } from '../services/serviceErrors';
import { formatEntryDate } from '../utils/dateDisplay';
import { Skeleton } from '../components/Skeleton';
import { suggestSettlements } from '../utils/suggestSettlements';

interface Props { navigation: any; route: any; }

export const BookMembersScreen: React.FC<Props> = ({ navigation, route }) => {
  const bookId: string | undefined = route.params?.bookId;
  const initialName: string | undefined = route.params?.name;
  const { user } = useAuth();
  const { theme } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [settlementsError, setSettlementsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [settleVisible, setSettleVisible] = useState(false);
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const [settlementSaving, setSettlementSaving] = useState(false);

  const isOwner = useMemo(() => members.some((member) => member.userId === user?.id && member.role === 'owner'), [members, user?.id]);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ownBalance = balances.find((balance) => balance.userId === user?.id)?.balance ?? 0;
  const balanceByUser = useMemo(() => new Map(balances.map((balance) => [balance.userId, balance.balance])), [balances]);
  const suggestions = useMemo(() => suggestSettlements(balances), [balances]);
  const currency = book?.currencyCode ?? 'PKR';
  const balanceReady = !balancesLoading && !balancesError;
  const ownBalanceKnown = balanceReady && balances.some((balance) => balance.userId === user?.id);

  const load = useCallback(async () => {
    if (!bookId) { setError('This book could not be opened.'); setLoading(false); return; }
    setError(null);
    try {
      const [bookInfo, memberRows] = await Promise.all([bookService.getBook(bookId), bookService.listMembers(bookId)]);
      setBook(bookInfo);
      setMembers(memberRows);
      setBalancesLoading(true);
      const [balanceResult, settlementResult] = await Promise.allSettled([
        settlementService.getMemberBalances(bookId),
        settlementService.listSettlements(bookId),
      ]);
      if (balanceResult.status === 'fulfilled') {
        setBalances(balanceResult.value);
        setBalancesError(null);
      } else {
        setBalancesError(toServiceError(balanceResult.reason, 'Could not load member balances').message);
      }
      if (settlementResult.status === 'fulfilled') {
        setSettlements(settlementResult.value);
        setSettlementsError(null);
      } else {
        setSettlementsError(toServiceError(settlementResult.reason, 'Could not load settlement history').message);
      }
      if (memberRows.some((member) => member.userId === user?.id && member.role === 'owner')) {
        setInvitations(await invitationService.listBookPendingInvitations(bookId));
      } else setInvitations([]);
    } catch (loadError) {
      setError(toServiceError(loadError, 'Could not load book members').message);
    } finally { setLoading(false); setBalancesLoading(false); }
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

  const openSettlement = (suggestion?: { fromUser: string; toUser: string; amount: number }) => {
    const currentSuggestion = suggestion ?? suggestions.find((item) => item.fromUser === user?.id);
    const suggestedPayee = currentSuggestion?.toUser ?? balances.find((item) => item.balance > 0 && item.userId !== user?.id)?.userId ?? '';
    const suggestedAmount = suggestion?.amount ?? (ownBalance < 0 ? Math.abs(ownBalance) : 0);
    setSettleTo(suggestedPayee);
    setSettleAmount(suggestedAmount ? suggestedAmount.toFixed(2) : '');
    setSettleDate(() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    });
    setSettleVisible(true);
  };

  const confirmSettlement = () => {
    const payee = members.find((member) => member.userId === settleTo);
    if (!payee) return;
    Alert.alert('Confirm payment', `Record ${currency} ${settleAmount} paid to ${payee.displayName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setSettlementSaving(true);
        try {
          await settlementService.recordSettlement(bookId!, settleTo, settleAmount, settleDate);
          setSettleVisible(false);
          await load();
        } catch (settlementError) {
          Alert.alert('Could not record settlement', toServiceError(settlementError, 'Could not record settlement').message);
        } finally { setSettlementSaving(false); }
      } },
    ]);
  };

  const confirmDeleteSettlement = (settlement: Settlement) => Alert.alert('Delete settlement', 'Delete this payment from the shared balance history?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      setActionId(settlement.id);
      try { await settlementService.deleteSettlement(settlement.id); await load(); }
      catch (deleteError) { Alert.alert('Could not delete settlement', toServiceError(deleteError, 'Could not delete settlement').message); }
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
          <View style={styles.card}>{members.map((member) => {
            const memberBalance = balanceByUser.get(member.userId);
            const hasBalance = memberBalance === undefined || memberBalance !== 0;
            return <View key={member.userId} style={styles.row}>
              <View style={styles.avatar}><Ionicons name="person" size={18} color={theme.colors.primaryVariant} /></View>
              <View style={styles.memberCopy}><Text style={styles.memberName}>{member.displayName || 'Member'}{member.userId === user?.id ? ' (you)' : ''}</Text><Text style={styles.memberRole}>{member.role}</Text>
                {isOwner && member.userId !== user?.id && hasBalance && <Text style={styles.disabledReason}>{memberBalance === undefined ? 'Balance unavailable; retry before removing.' : 'Settle their balance before removing them.'}</Text>}
              </View>
              {isOwner && member.userId !== user?.id && <TouchableOpacity style={[styles.rowAction, hasBalance && styles.disabledAction]} onPress={() => confirmRemove(member)} disabled={actionId === member.userId || hasBalance} accessibilityRole="button" accessibilityLabel={`Remove ${member.displayName || 'member'}${hasBalance ? ', disabled because balance is not zero' : ''}`}>
                {actionId === member.userId ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Ionicons name="person-remove-outline" size={20} color={hasBalance ? theme.colors.textTertiary : theme.colors.error} />}
              </TouchableOpacity>}
            </View>;
          })}</View>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Balances</Text><TouchableOpacity style={styles.rowAction} onPress={() => { setBalancesLoading(true); void load(); }} accessibilityRole="button" accessibilityLabel="Refresh balances"><Ionicons name="refresh" size={19} color={theme.colors.primaryVariant} /></TouchableOpacity></View>
          {balancesLoading ? <View style={[styles.card, styles.balanceLoading]}><Skeleton width="72%" height={18} /><Skeleton width="54%" height={18} style={{ marginTop: theme.spacing.md }} /></View>
            : balancesError ? <View style={styles.card}><Text style={styles.error}>{balancesError}</Text><TouchableOpacity style={styles.retry} onPress={() => { setBalancesLoading(true); void load(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
              : <View style={styles.card}>
                {balances.length === 0 ? <Text style={styles.muted}>No member balances yet.</Text> : balances.map((balance) => {
                  const color = balance.balance > 0 ? theme.colors.success : balance.balance < 0 ? theme.colors.error : theme.colors.textSecondary;
                  const icon = balance.balance > 0 ? 'arrow-down-circle-outline' : balance.balance < 0 ? 'arrow-up-circle-outline' : 'checkmark-circle-outline';
                  const label = balance.balance > 0 ? `is owed ${formatMoney(balance.balance, currency)}` : balance.balance < 0 ? `owes ${formatMoney(Math.abs(balance.balance), currency)}` : 'settled up';
                  return <View key={balance.userId} style={styles.balanceRow}>
                    <View style={styles.memberCopy}><Text style={styles.memberName}>{balance.displayName}{balance.userId === user?.id ? ' (you)' : ''}</Text></View>
                    <View style={styles.balanceValue}><Ionicons name={icon} size={19} color={color} /><Text style={[styles.balanceText, { color }]}>{label}</Text></View>
                  </View>;
                })}
                {suggestions.length > 0 && <View style={styles.suggestionBlock}>
                  <Text style={styles.suggestionTitle}>Suggested settlements</Text>
                  {suggestions.map((suggestion) => <View key={`${suggestion.fromUser}-${suggestion.toUser}`} style={styles.suggestionRow}>
                    <Text style={styles.suggestionText}>{suggestion.fromName} pays {suggestion.toName} {formatMoney(suggestion.amount, currency)}</Text>
                    {suggestion.fromUser === user?.id && <TouchableOpacity style={styles.suggestionAction} onPress={() => openSettlement(suggestion)} accessibilityRole="button"><Text style={styles.suggestionActionText}>Settle</Text></TouchableOpacity>}
                  </View>)}
                </View>}
                <TouchableOpacity style={[styles.primaryButton, (!ownBalanceKnown || ownBalance >= 0) && styles.disabledButton]} onPress={() => openSettlement()} disabled={!ownBalanceKnown || ownBalance >= 0} accessibilityRole="button" accessibilityLabel={ownBalance < 0 ? 'Settle up' : 'Settle up, no amount owed'}>
                  <Text style={[styles.primaryText, (!ownBalanceKnown || ownBalance >= 0) && styles.disabledButtonText]}>Settle up</Text>
                </TouchableOpacity>
                {ownBalanceKnown && ownBalance >= 0 && <Text style={styles.muted}>You do not owe a settlement amount right now.</Text>}
              </View>}
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Settlement history</Text><TouchableOpacity style={styles.rowAction} onPress={() => { setBalancesLoading(true); void load(); }} accessibilityRole="button" accessibilityLabel="Refresh settlement history"><Ionicons name="refresh" size={19} color={theme.colors.primaryVariant} /></TouchableOpacity></View>
          {balancesLoading ? <View style={[styles.card, styles.balanceLoading]}><Skeleton width="88%" height={18} /><Skeleton width="68%" height={18} style={{ marginTop: theme.spacing.md }} /></View>
            : settlementsError ? <View style={styles.card}><Text style={styles.error}>{settlementsError}</Text><TouchableOpacity style={styles.retry} onPress={() => { setBalancesLoading(true); void load(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
              : <View style={styles.card}>{settlements.length === 0 ? <Text style={styles.muted}>No settlements yet.</Text> : settlements.map((settlement) => {
                const fromName = members.find((member) => member.userId === settlement.fromUser)?.displayName || 'Former member';
                const toName = members.find((member) => member.userId === settlement.toUser)?.displayName || 'Former member';
                const canDelete = settlement.createdBy === user?.id || isOwner;
                return <View key={settlement.id} style={styles.settlementRow}>
                  <View style={styles.memberCopy}><Text style={styles.memberName}>{fromName} paid {toName}</Text><Text style={styles.memberRole}>{formatMoney(settlement.amount, currency)} · {formatEntryDate(settlement.entryDate)}</Text></View>
                  {canDelete && <TouchableOpacity style={styles.rowAction} onPress={() => confirmDeleteSettlement(settlement)} disabled={actionId === settlement.id} accessibilityRole="button" accessibilityLabel="Delete settlement">
                    {actionId === settlement.id ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Ionicons name="trash-outline" size={19} color={theme.colors.error} />}
                  </TouchableOpacity>}
                </View>;
              })}</View>}
          {isOwner && <>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Invitations</Text><TouchableOpacity style={styles.rowAction} onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Refresh invitations"><Ionicons name="refresh" size={19} color={theme.colors.primaryVariant} /></TouchableOpacity></View>
            <View style={styles.card}>{invitations.length === 0 ? <Text style={styles.muted}>No pending invitations.</Text> : invitations.map((invitation) => <View key={invitation.id} style={styles.row}>
              <View style={styles.memberCopy}><Text style={styles.memberName}>{invitation.invitedEmail}</Text><Text style={styles.memberRole}>Expires {formatEntryDate(invitation.expiresAt.slice(0, 10))}</Text></View>
              <TouchableOpacity style={styles.rowAction} onPress={() => revokeInvitation(invitation)} disabled={actionId === invitation.id} accessibilityRole="button" accessibilityLabel={`Revoke invitation for ${invitation.invitedEmail}`}><Text style={styles.revokeText}>{actionId === invitation.id ? '…' : 'Revoke'}</Text></TouchableOpacity>
            </View>)}</View>
          </>}
          {members.some((member) => member.userId === user?.id) && <>
            <TouchableOpacity style={[styles.leaveButton, (!ownBalanceKnown || ownBalance !== 0) && styles.disabledLeave]} onPress={leaveBook} disabled={!ownBalanceKnown || ownBalance !== 0} accessibilityRole="button" accessibilityLabel={ownBalance !== 0 ? 'Leave book disabled because your balance is not zero' : 'Leave book'}><Ionicons name="exit-outline" size={20} color={!ownBalanceKnown || ownBalance !== 0 ? theme.colors.textTertiary : theme.colors.error} /><Text style={[styles.leaveText, (!ownBalanceKnown || ownBalance !== 0) && styles.disabledButtonText]}>Leave book</Text></TouchableOpacity>
            {(!ownBalanceKnown || ownBalance !== 0) && <Text style={styles.disabledReason}>{ownBalanceKnown ? 'Settle your balance before leaving this book.' : 'Your balance could not be checked. Retry before leaving.'}</Text>}
          </>}
        </ScrollView>}
    <Modal visible={inviteVisible} animationType="slide" transparent onRequestClose={() => setInviteVisible(false)}>
      <View style={styles.modalOverlay}><View style={styles.modalCard}>
        <View style={styles.modalHeader}><Text style={styles.sectionTitle}>Invite member</Text><TouchableOpacity style={styles.rowAction} onPress={() => setInviteVisible(false)} accessibilityRole="button" accessibilityLabel="Close invite form"><Ionicons name="close" size={22} color={theme.colors.textSecondary} /></TouchableOpacity></View>
        <TextInput style={styles.input} value={inviteEmail} onChangeText={setInviteEmail} placeholder="Email address" placeholderTextColor={theme.colors.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Invitation email address" />
        <TouchableOpacity style={styles.primaryButton} onPress={() => void sendInvite()} disabled={saving} accessibilityRole="button"><Text style={styles.primaryText}>{saving ? 'Sending…' : 'Send invitation'}</Text></TouchableOpacity>
      </View></View>
    </Modal>
    <Modal visible={settleVisible} animationType="slide" transparent onRequestClose={() => setSettleVisible(false)}>
      <View style={styles.modalOverlay}><View style={styles.modalCard}>
        <View style={styles.modalHeader}><Text style={styles.sectionTitle}>Settle up</Text><TouchableOpacity style={styles.rowAction} onPress={() => setSettleVisible(false)} accessibilityRole="button" accessibilityLabel="Close settle up"><Ionicons name="close" size={22} color={theme.colors.textSecondary} /></TouchableOpacity></View>
        <Text style={styles.modalLabel}>Pay</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payeeOptions}>{balances.filter((balance) => balance.userId !== user?.id && balance.balance > 0).map((balance) => <TouchableOpacity key={balance.userId} style={[styles.memberChip, { borderColor: settleTo === balance.userId ? theme.colors.primary : theme.colors.border, backgroundColor: settleTo === balance.userId ? theme.colors.primary : theme.colors.surfaceVariant }]} onPress={() => setSettleTo(balance.userId)} accessibilityRole="button" accessibilityState={{ selected: settleTo === balance.userId }}><Text style={{ color: settleTo === balance.userId ? theme.colors.onPrimary : theme.colors.text }}>{balance.displayName}</Text></TouchableOpacity>)}</ScrollView>
        <Text style={styles.modalLabel}>Amount ({currency})</Text>
        <TextInput style={styles.input} value={settleAmount} onChangeText={setSettleAmount} keyboardType="decimal-pad" accessibilityLabel="Settlement amount" />
        <Text style={styles.modalLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={settleDate} onChangeText={setSettleDate} accessibilityLabel="Settlement date" />
        <TouchableOpacity style={[styles.primaryButton, (!settleTo || !settleAmount || settlementSaving) && styles.disabledButton]} onPress={confirmSettlement} disabled={!settleTo || !settleAmount || settlementSaving} accessibilityRole="button">
          {settlementSaving ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={[styles.primaryText, (!settleTo || !settleAmount) && styles.disabledButtonText]}>Confirm payment</Text>}
        </TouchableOpacity>
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
  memberChip: { minHeight: 44, borderWidth: 1, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, alignItems: 'center', justifyContent: 'center' },
  balanceRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight },
  balanceValue: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  balanceText: { fontSize: theme.typeSize.caption, fontWeight: '700' },
  balanceLoading: { paddingVertical: theme.spacing.lg },
  suggestionBlock: { paddingTop: theme.spacing.md, gap: theme.spacing.xs },
  suggestionTitle: { fontSize: theme.typeSize.small, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: theme.spacing.xs },
  suggestionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  suggestionText: { flex: 1, fontSize: theme.typeSize.caption, color: theme.colors.text },
  suggestionAction: { minWidth: 48, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  suggestionActionText: { color: theme.colors.primaryVariant, fontWeight: '700' },
  settlementRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight },
  disabledReason: { color: theme.colors.textTertiary, fontSize: theme.typeSize.caption, marginTop: theme.spacing.xxs },
  disabledAction: { opacity: 0.45 },
  disabledLeave: { opacity: 0.55 },
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
  disabledButton: { opacity: 0.55 },
  disabledButtonText: { color: theme.colors.textTertiary },
  modalLabel: { color: theme.colors.textSecondary, fontSize: theme.typeSize.caption, fontWeight: '700' },
  payeeOptions: { gap: theme.spacing.xs },
});
