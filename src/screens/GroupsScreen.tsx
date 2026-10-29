import React, { useCallback, useState } from 'react';
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
import { Book, Member } from '../types';
import { bookService } from '../services/bookService';

interface GroupsScreenProps {
  navigation: any;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editBookName, setEditBookName] = useState('');
  const [editBookDescription, setEditBookDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);

  // Member details state
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [memberDetails, setMemberDetails] = useState<Member[]>([]);
  const [membersCache, setMembersCache] = useState<Record<string, Member[]>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const fetchBooks = useCallback(async (showLoading = true) => {
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setLoadError(null);
    setMembersCache({});
    try {
      setBooks(await bookService.listMyBooks(user.id));
    } catch (error: any) {
      setLoadError(error?.message || 'Could not load your books. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user]);

  // Refresh books when the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      void fetchBooks();
    }, [fetchBooks])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchBooks(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setEditBookName(book.name);
    setEditBookDescription(book.description || '');
    setShowEditModal(true);
  };

  const handleUpdateBook = async () => {
    if (!editingBook || !editBookName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Book name is required',
      });
      return;
    }

    try {
      await bookService.updateBook(editingBook.id, {
        name: editBookName.trim(),
        description: editBookDescription.trim() || null,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Book updated successfully',
      });

      setShowEditModal(false);
      void fetchBooks(false);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update book',
      });
    }
  };

  const handleDeleteBook = (book: Book) => {
    setDeletingBook(book);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteBook = async () => {
    if (!deletingBook) return;

    try {
      await bookService.softDeleteBook(deletingBook.id);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Book deleted successfully',
      });

      setShowDeleteConfirm(false);
      void fetchBooks(false);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to delete book',
      });
    }
  };

  const isBookOwner = (book: Book) => book.memberRole === 'owner';

  const handleShowMemberDetails = async (book: Book) => {
    setSelectedBook(book);
    setLoadingMembers(true);
    setMemberError(null);
    setMemberDetails([]);
    setShowMemberDetails(true);

    try {
      const members = await bookService.listMembers(book.id);
      setMemberDetails(members);
      setMembersCache((current) => ({ ...current, [book.id]: members }));
    } catch (error: any) {
      setMemberError(error?.message || 'Could not load members. Please try again.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenBook = (book: Book) => {
    navigation.navigate('GroupDetails', { bookId: book.id, name: book.name });
  };

  const renderBookItem = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={[
        styles.groupItem,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderLight,
        },
      ]}
      onPress={() => void handleOpenBook(item)}
      onLongPress={isBookOwner(item) ? () => Alert.alert(
        'Book Options',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Book', onPress: () => handleEditBook(item) },
          { text: 'Delete Book', style: 'destructive', onPress: () => handleDeleteBook(item) },
        ]
      ) : undefined}
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
              {membersCache[item.id] ? `${membersCache[item.id].length} members` : 'View members'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {isBookOwner(item) && (
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
        <Text style={[styles.title, { color: theme.colors.text }]}>My Books</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Ionicons name="add" size={24} color={theme.colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={books}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={books.length > 0 && loadError ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.error }]}>{loadError}</Text>
            <TouchableOpacity onPress={() => void fetchBooks()}>
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading your books...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={64} color={theme.colors.error} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>Could not load books</Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>{loadError}</Text>
              <TouchableOpacity onPress={() => void fetchBooks()}>
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No books yet</Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                Create your first book to start tracking cash in and cash out
              </Text>
              <TouchableOpacity
                style={[styles.createGroupButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={[styles.createGroupButtonText, { color: theme.colors.onPrimary }]}>Create Book</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Edit Book Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Book</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Book Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={editBookName}
                onChangeText={setEditBookName}
                placeholder="Enter book name"
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
                value={editBookDescription}
                onChangeText={setEditBookDescription}
                placeholder="Enter book description"
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
                onPress={handleUpdateBook}
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
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Book</Text>
            </View>

            <Text style={[styles.deleteMessage, { color: theme.colors.textSecondary }]}>
              Are you sure you want to delete "{deletingBook?.name}"? This will hide the book and its transactions.
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
                onPress={confirmDeleteBook}
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
                {selectedBook?.name} - Members
              </Text>
              <TouchableOpacity onPress={() => setShowMemberDetails(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.memberList}>
              {loadingMembers ? (
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading members...</Text>
              ) : memberError ? (
                <View style={styles.memberError}>
                  <Text style={[styles.emptyStateText, { color: theme.colors.error }]}>{memberError}</Text>
                  {selectedBook && (
                    <TouchableOpacity onPress={() => void handleShowMemberDetails(selectedBook)}>
                      <Text style={[styles.retryText, { color: theme.colors.primary }]}>Try Again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                memberDetails.map((member) => (
                  <View key={member.userId} style={[styles.memberItem, { borderBottomColor: theme.colors.borderLight }]}>
                    <View style={styles.memberInfo}>
                      <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                        <Ionicons name="person" size={20} color={theme.colors.onPrimary} />
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={[styles.memberName, { color: theme.colors.text }]}>{member.displayName || 'Unnamed member'}</Text>
                        <View style={styles.memberBadges}>
                          {member.role === 'owner' && (
                            <Text style={[styles.ownerBadge, { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }]}>Owner</Text>
                          )}
                          {member.userId === user?.id && (
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
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
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
  memberError: {
    alignItems: 'center',
    paddingVertical: 16,
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
