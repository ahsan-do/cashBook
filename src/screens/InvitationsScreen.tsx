import React, { useState, useEffect } from 'react';
import {
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
import { groupService, getUserDisplayNames } from '../services/groupService';
import { GroupInvitation, Group } from '../types';

interface InvitationsScreenProps {
  navigation: any;
}

export const InvitationsScreen: React.FC<InvitationsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchInvitations = async () => {
    if (!user?.email) return;
    
    try {
      const pendingInvitations = await groupService.getPendingInvitations(user.email);
      setInvitations(pendingInvitations);

      // Fetch group details for each invitation
      const groupIds = pendingInvitations.map(inv => inv.groupId);
      const groupDetails: Record<string, Group> = {};
      
      await Promise.all(
        groupIds.map(async (groupId) => {
          const group = await groupService.getGroup(groupId);
          if (group) {
            groupDetails[groupId] = group;
          }
        })
      );
      setGroups(groupDetails);

      // Fetch user names for invitedBy
      const userIds = pendingInvitations.map(inv => inv.invitedBy);
      const names = await getUserDisplayNames(userIds);
      setUserNames(names);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      Alert.alert('Error', 'Failed to load invitations');
    }
  };

  const handleAcceptInvitation = async (invitation: GroupInvitation) => {
    setLoading(true);
    try {
      // Update invitation status
      await groupService.updateInvitationStatus(invitation.id, 'accepted');
      
      // Add user to group
      await groupService.addMemberToGroup(invitation.groupId, user!.id);
      
      Alert.alert('Success', 'You have joined the group!');
      fetchInvitations(); // Refresh the list
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitation: GroupInvitation) => {
    setLoading(true);
    try {
      await groupService.updateInvitationStatus(invitation.id, 'declined');
      Alert.alert('Success', 'Invitation declined');
      fetchInvitations(); // Refresh the list
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      Alert.alert('Error', 'Failed to decline invitation');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvitations();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchInvitations();
  }, [user?.email]);

  const renderInvitation = (invitation: GroupInvitation) => {
    const group = groups[invitation.groupId];
    const inviterName = userNames[invitation.invitedBy] || invitation.invitedBy;

    if (!group) return null;

    return (
      <View key={invitation.id} style={styles.invitationCard}>
        <View style={styles.invitationHeader}>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.inviterText}>
              Invited by {inviterName}
            </Text>
            <Text style={styles.invitationDate}>
              {invitation.createdAt.toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        {group.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptInvitation(invitation)}
            disabled={loading}
          >
            <Ionicons name="checkmark" size={20} color="#ffffff" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDeclineInvitation(invitation)}
            disabled={loading}
          >
            <Ionicons name="close" size={20} color="#dc2626" />
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Invitations</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading invitations...</Text>
          </View>
        ) : invitations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyStateText}>No pending invitations</Text>
            <Text style={styles.emptyStateSubtext}>
              You'll see group invitations here when someone invites you
            </Text>
          </View>
        ) : (
          <View style={styles.invitationsList}>
            {invitations.map(renderInvitation)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  invitationsList: {
    padding: 20,
  },
  invitationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  inviterText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  invitationDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  groupDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  declineButton: {
    backgroundColor: '#ffffff',
    borderColor: '#dc2626',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  declineButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    marginLeft: 6,
  },
}); 