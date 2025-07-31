import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Group, User } from '../types';
import { groupService, getUserDisplayNames } from '../services/groupService';

interface GroupsScreenProps {
  navigation: any;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  // Member details state
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [memberDetails, setMemberDetails] = useState<Record<string, string>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchGroups = async () => {
    if (!user) return;
    
    try {
      console.log('Fetching groups for user:', user.id);
      const userGroups = await groupService.getUserGroups(user.id);
      console.log('Fetched groups:', userGroups);
      setGroups(userGroups);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  // Refresh groups when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchGroups();
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  };

  // Group management functions
  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || '');
    setShowEditModal(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !editGroupName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Group name is required',
      });
      return;
    }

    try {
      await groupService.updateGroup(editingGroup.id, {
        name: editGroupName.trim(),
        description: editGroupDescription.trim() || undefined,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Group updated successfully',
      });

      setShowEditModal(false);
      fetchGroups();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update group',
      });
    }
  };

  const handleDeleteGroup = (group: Group) => {
    setDeletingGroup(group);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteGroup = async () => {
    if (!deletingGroup) return;

    try {
      await groupService.deleteGroup(deletingGroup.id);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Group deleted successfully',
      });

      setShowDeleteConfirm(false);
      fetchGroups();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to delete group',
      });
    }
  };

  const isGroupOwner = (group: Group) => user?.id === group.createdBy;

  const handleShowMemberDetails = async (group: Group) => {
    setSelectedGroup(group);
    setLoadingMembers(true);
    setShowMemberDetails(true);

    try {
      const memberNames = await getUserDisplayNames(group.members);
      setMemberDetails(memberNames);
    } catch (error) {
      console.error('Error fetching member details:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={[
        styles.groupItem,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderLight,
        },
      ]}
      onPress={() => navigation.navigate('GroupDetails', { group: item })}
      onLongPress={() => {
        if (isGroupOwner(item)) {
          Alert.alert(
            'Group Options',
            'What would you like to do?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Edit Group', onPress: () => handleEditGroup(item) },
              { text: 'Delete Group', style: 'destructive', onPress: () => handleDeleteGroup(item) },
            ]
          );
        }
      }}
    >
      <View style={styles.groupInfo}>
        <Text style={[styles.groupName, { color: theme.colors.text }]}>{item.name}</Text>
        <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>
          {item.description || 'No description'}
        </Text>
        <View style={styles.groupStats}>
          <TouchableOpacity 
            onPress={() => handleShowMemberDetails(item)}
            style={styles.memberCountButton}
          >
            <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
              {item.members.length} members
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {isGroupOwner(item) && (
            <Text style={[styles.ownerBadge, { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }]}>Owner</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Groups</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Ionicons name="add" size={24} color={theme.colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading your groups...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No groups yet</Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                Create your first group to start tracking expenses with friends
              </Text>
              <TouchableOpacity
                style={[styles.createGroupButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={[styles.createGroupButtonText, { color: theme.colors.onPrimary }]}>Create Group</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Edit Group Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Group</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={editGroupName}
                onChangeText={setEditGroupName}
                placeholder="Enter group name"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={editGroupDescription}
                onChangeText={setEditGroupDescription}
                placeholder="Enter group description"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleUpdateGroup}
              >
                <Text style={[styles.saveButtonText, { color: theme.colors.onPrimary }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Group</Text>
            </View>

            <Text style={[styles.deleteMessage, { color: theme.colors.textSecondary }]}>
              Are you sure you want to delete "{deletingGroup?.name}"? This action cannot be undone.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
                onPress={confirmDeleteGroup}
              >
                <Text style={[styles.deleteButtonText, { color: theme.colors.onError }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Details Modal */}
      <Modal
        visible={showMemberDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMemberDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedGroup?.name} - Members
              </Text>
              <TouchableOpacity onPress={() => setShowMemberDetails(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.memberList}>
              {loadingMembers ? (
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading members...</Text>
              ) : (
                Object.entries(memberDetails).map(([userId, displayName]) => (
                  <View key={userId} style={[styles.memberItem, { borderBottomColor: theme.colors.borderLight }]}>
                    <View style={styles.memberInfo}>
                      <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                        <Ionicons name="person" size={20} color={theme.colors.onPrimary} />
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={[styles.memberName, { color: theme.colors.text }]}>{displayName}</Text>
                        <View style={styles.memberBadges}>
                          {selectedGroup?.createdBy === userId && (
                            <Text style={[styles.ownerBadge, { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }]}>Owner</Text>
                          )}
                          {userId === user?.id && (
                            <Text style={[styles.currentUserBadge, { backgroundColor: theme.colors.secondary, color: theme.colors.onSecondary }]}>You</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
  },
  groupItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderBottomWidth: 1,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupMembers: {
    fontSize: 14,
  },
  memberCountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownerBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  createGroupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createGroupButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputLabel: {
    marginBottom: 8,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteMessage: {
    marginBottom: 20,
    textAlign: 'center',
  },
  deleteButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Member details modal styles
  memberList: {
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  memberBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  currentUserBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
}); 