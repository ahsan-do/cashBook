import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { PendingInvitation } from '../types';
import { invitationService } from '../services/invitationService';
import { toServiceError } from '../services/serviceErrors';

interface InvitationsScreenProps { navigation: any; }

export const InvitationsScreen: React.FC<InvitationsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
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
      Alert.alert('Success', `You have joined ${invitation.bookName}.`);
      await fetchInvitations();
    } catch (actionError) {
      Alert.alert('Could not accept invitation', toServiceError(actionError, 'Could not accept invitation').message);
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
      Alert.alert('Could not decline invitation', toServiceError(actionError, 'Could not decline invitation').message);
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
          <Text style={styles.invitationDate}>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.statusBadge}><Text style={styles.statusText}>Pending</Text></View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => void handleAcceptInvitation(invitation)} disabled={actionId !== null}>
          {actionId === invitation.id ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="checkmark" size={20} color="#ffffff" />}
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={() => void handleDeclineInvitation(invitation)} disabled={actionId !== null}>
          <Ionicons name="close" size={20} color="#dc2626" /><Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={24} color="#1f2937" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Book Invitations</Text><View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <View style={styles.loadingContainer}><ActivityIndicator color="#059669" /><Text style={styles.loadingText}>Loading invitations...</Text></View>
          : error ? <View style={styles.emptyState}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); void fetchInvitations(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
            : invitations.length === 0 ? <View style={styles.emptyState}><Ionicons name="mail-outline" size={48} color="#9ca3af" /><Text style={styles.emptyStateText}>No pending invitations</Text><Text style={styles.emptyStateSubtext}>You'll see book invitations here when someone invites you</Text></View>
              : <View style={styles.invitationsList}>{invitations.map(renderInvitation)}</View>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 8 },
  loadingText: { fontSize: 16, fontWeight: '500', color: '#6b7280' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyStateText: { fontSize: 18, fontWeight: '500', color: '#6b7280', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center' },
  retryButton: { marginTop: 16, padding: 10 },
  retryText: { color: '#059669', fontWeight: '600' },
  invitationsList: { padding: 20 },
  invitationCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  invitationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  inviterText: { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  invitationDate: { fontSize: 12, color: '#9ca3af' },
  statusBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, color: '#92400e', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  acceptButton: { backgroundColor: '#059669', borderColor: '#059669' },
  declineButton: { backgroundColor: '#ffffff', borderColor: '#dc2626' },
  acceptButtonText: { color: '#ffffff', fontWeight: '600', marginLeft: 6 },
  declineButtonText: { color: '#dc2626', fontWeight: '600', marginLeft: 6 },
});
