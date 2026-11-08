import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PendingInvitation } from '../types';
import { invitationService } from '../services/invitationService';
import { toServiceError } from '../services/serviceErrors';
import { formatEntryDate } from '../utils/dateDisplay';
import { useDialog } from '../contexts/DialogContext';
import Toast from 'react-native-toast-message';

interface InvitationsScreenProps { navigation: any; }

export const InvitationsScreen: React.FC<InvitationsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const dialog = useDialog();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setError(null);
    try {
      setInvitations(await invitationService.listMyPendingInvitations());
    } catch (loadError) {
      setError(toServiceError(loadError, 'Could not load invitations').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInvitations(); }, [fetchInvitations, user?.id]);

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    setActionId(invitation.id);
    try {
      await invitationService.acceptInvitation(invitation.id);
      Toast.show({ type: 'success', text1: 'Success', text2: `You have joined ${invitation.bookName}.` });
      await fetchInvitations();
    } catch (actionError) {
      void dialog.notify({ title: 'Could not accept invitation', message: toServiceError(actionError, 'Could not accept invitation').message });
    } finally {
      setActionId(null);
    }
  };

  const handleDeclineInvitation = async (invitation: PendingInvitation) => {
    setActionId(invitation.id);
    try {
      await invitationService.declineInvitation(invitation.id);
      await fetchInvitations();
    } catch (actionError) {
      void dialog.notify({ title: 'Could not decline invitation', message: toServiceError(actionError, 'Could not decline invitation').message });
    } finally {
      setActionId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchInvitations(); } finally { setRefreshing(false); }
  };

  const renderInvitation = (invitation: PendingInvitation) => (
    <View key={invitation.id} style={styles.invitationCard}>
      <View style={styles.invitationHeader}>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{invitation.bookName}</Text>
          <Text style={styles.inviterText}>Invited by {invitation.inviterDisplayName || 'Book owner'}</Text>
          <Text style={styles.invitationDate}>Expires {formatEntryDate(invitation.expiresAt.slice(0, 10))}</Text>
        </View>
        <View style={styles.statusBadge}><Text style={styles.statusText}>Pending</Text></View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => void handleAcceptInvitation(invitation)} disabled={actionId !== null}>
          {actionId === invitation.id ? <ActivityIndicator size="small" color={theme.colors.onPrimary} /> : <Ionicons name="checkmark" size={20} color={theme.colors.onPrimary} />}
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={() => void handleDeclineInvitation(invitation)} disabled={actionId !== null}>
          <Ionicons name="close" size={20} color={theme.colors.primaryVariant} /><Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={24} color={theme.colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Book Invitations</Text><View style={styles.iconButton} />
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <View style={styles.loadingContainer}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.loadingText}>Loading invitations...</Text></View>
          : error ? <View style={styles.emptyState}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); void fetchInvitations(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
            : invitations.length === 0 ? <View style={styles.emptyState}><Ionicons name="mail-outline" size={48} color={theme.colors.textTertiary} /><Text style={styles.emptyStateText}>No pending invitations</Text><Text style={styles.emptyStateSubtext}>You'll see book invitations here when someone invites you</Text></View>
              : <View style={styles.invitationsList}>{invitations.map(renderInvitation)}</View>}
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 60, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: theme.typeSize.subtitle, fontWeight: '700', color: theme.colors.text },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: theme.spacing.huge, gap: theme.spacing.sm },
  loadingText: { fontSize: theme.typeSize.body, fontWeight: '500', color: theme.colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.huge, paddingHorizontal: theme.spacing.xl },
  emptyStateText: { fontSize: theme.typeSize.subtitle, fontWeight: '600', color: theme.colors.textSecondary, marginTop: theme.spacing.lg },
  emptyStateSubtext: { fontSize: theme.typeSize.small, color: theme.colors.textTertiary, textAlign: 'center', marginTop: theme.spacing.sm },
  errorText: { fontSize: theme.typeSize.small, color: theme.colors.error, textAlign: 'center' },
  retryButton: { marginTop: theme.spacing.md, minHeight: 48, paddingHorizontal: theme.spacing.md, justifyContent: 'center' },
  retryText: { color: theme.colors.primaryVariant, fontWeight: '700' },
  invitationsList: { padding: theme.spacing.xl },
  invitationCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.borderLight, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  invitationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  groupInfo: { flex: 1 },
  groupName: { fontSize: theme.typeSize.subtitle, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.xs },
  inviterText: { fontSize: theme.typeSize.small, color: theme.colors.textSecondary, marginBottom: theme.spacing.xxs },
  invitationDate: { fontSize: theme.typeSize.caption, color: theme.colors.textTertiary },
  statusBadge: { backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.pill },
  statusText: { fontSize: theme.typeSize.caption, color: theme.colors.textSecondary, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: theme.spacing.md },
  actionButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1 },
  acceptButton: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  declineButton: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  acceptButtonText: { color: theme.colors.onPrimary, fontWeight: '700', marginLeft: theme.spacing.xs },
  declineButtonText: { color: theme.colors.text, fontWeight: '600', marginLeft: theme.spacing.xs },
});
