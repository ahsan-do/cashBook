import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Book, Invitation, Member, Transaction, TransactionType } from '../types';
import { bookService } from '../services/bookService';
import { invitationService } from '../services/invitationService';
import { formatMoney, parseMoneyAmount } from '../services/money';
import { toServiceError } from '../services/serviceErrors';
import { TransactionCursor, transactionService } from '../services/transactionService';

interface GroupDetailsScreenProps {
  navigation: any;
  route: any;
}

type Totals = { cashInTotal: number; cashOutTotal: number; netBalance: number };

const localToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const friendlyError = (error: unknown, operation: string) => toServiceError(error, operation).message;

export const GroupDetailsScreen: React.FC<GroupDetailsScreenProps> = ({ navigation, route }) => {
  // HomeScreen still sends its legacy group param until that screen is migrated.
  const bookId: string | undefined = route.params?.bookId ?? route.params?.group?.id;
  const initialName: string | undefined = route.params?.name ?? route.params?.group?.name;
  const { user } = useAuth();
  const { theme } = useTheme();

  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [totalsError, setTotalsError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionCursor, setTransactionCursor] = useState<TransactionCursor | null>(null);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const transactionsBusyRef = useRef(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>('cash_out');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(localToday());
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [savingInvite, setSavingInvite] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const isOwner = useMemo(
    () => Boolean(user && members.some((member) => member.userId === user.id && member.role === 'owner')),
    [members, user],
  );

  const loadBook = useCallback(async () => {
    if (!bookId) {
      setBookError('This book could not be opened. Return to the book list and try again.');
      setBookLoading(false);
      return;
    }
    setBookLoading(true);
    setBookError(null);
    try {
      setBook(await bookService.getBook(bookId));
    } catch (error) {
      setBookError(friendlyError(error, 'Could not load book'));
    } finally {
      setBookLoading(false);
    }
  }, [bookId]);

  const loadMembers = useCallback(async () => {
    if (!bookId) {
      setMembersError('This book could not be opened. Return to the book list and try again.');
      setMembersLoading(false);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      setMembers(await bookService.listMembers(bookId));
    } catch (error) {
      setMembersError(friendlyError(error, 'Could not load book members'));
    } finally {
      setMembersLoading(false);
    }
  }, [bookId]);

  const loadTotals = useCallback(async () => {
    if (!bookId) {
      setTotalsError('This book could not be opened. Return to the book list and try again.');
      setTotalsLoading(false);
      return;
    }
    setTotalsLoading(true);
    setTotalsError(null);
    try {
      setTotals(await transactionService.getBookTotals(bookId));
    } catch (error) {
      setTotalsError(friendlyError(error, 'Could not load book totals'));
    } finally {
      setTotalsLoading(false);
    }
  }, [bookId]);

  const loadTransactions = useCallback(async (reset = true) => {
    if (!bookId) {
      setTransactionsError('This book could not be opened. Return to the book list and try again.');
      setTransactionsLoading(false);
      return;
    }
    if (transactionsBusyRef.current) return;
    transactionsBusyRef.current = true;
    setTransactionsError(null);
    if (reset) {
      setTransactionsLoading(true);
      setTransactionsError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const page = await transactionService.pageTransactions({
        bookId,
        pageSize: 30,
        cursor: reset ? null : transactionCursor,
      });
      setTransactions((current) => reset ? page.transactions : [...current, ...page.transactions]);
      setTransactionCursor(page.nextCursor);
      setHasMoreTransactions(page.nextCursor !== null);
    } catch (error) {
      setTransactionsError(friendlyError(error, 'Could not load transactions'));
    } finally {
      transactionsBusyRef.current = false;
      if (reset) setTransactionsLoading(false);
      else setLoadingMore(false);
    }
  }, [bookId, transactionCursor]);

  const loadInvitations = useCallback(async () => {
    if (!bookId || !isOwner) return;
    setInvitationsLoading(true);
    setInvitationsError(null);
    try {
      setInvitations(await invitationService.listBookPendingInvitations(bookId));
    } catch (error) {
      setInvitationsError(friendlyError(error, 'Could not load pending invitations'));
    } finally {
      setInvitationsLoading(false);
    }
  }, [bookId, isOwner]);

  useEffect(() => {
    void loadBook();
    void loadMembers();
    void loadTotals();
    void loadTransactions(true);
  // Reload when the route changes to another book. The callbacks intentionally
  // use their current implementations for this one-time screen initialization.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    if (isOwner) void loadInvitations();
  }, [isOwner, loadInvitations]);

  const refreshTransactionsAndTotals = async () => {
    setTransactionCursor(null);
    await Promise.all([loadTotals(), loadTransactions(true)]);
  };

  const openAddTransaction = (type: TransactionType) => {
    setEditingTransaction(null);
    setTransactionType(type);
    setTitle('');
    setAmount('');
    setCategory('General');
    setDescription('');
    setEntryDate(localToday());
    setShowTransactionModal(true);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setTitle(transaction.title);
    setAmount(String(transaction.amount));
    setCategory(transaction.category || 'General');
    setDescription(transaction.description ?? '');
    setEntryDate(transaction.entryDate);
    setShowTransactionModal(true);
  };

  const validateAmount = (input: string) => {
    const normalized = input.trim();
    if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) {
      throw new Error('Enter a positive amount with up to two decimal places.');
    }
    const parsed = parseMoneyAmount(normalized);
    if (parsed <= 0) throw new Error('Amount must be greater than zero.');
    return parsed;
  };

  const saveTransaction = async () => {
    if (!bookId) return;
    const cleanTitle = title.trim();
    const cleanCategory = category.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle) {
      Toast.show({ type: 'error', text1: 'Check transaction', text2: 'Enter a title.' });
      return;
    }
    if (!cleanCategory) {
      Toast.show({ type: 'error', text1: 'Check transaction', text2: 'Enter a category.' });
      return;
    }
    const parsedEntryDate = new Date(`${entryDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)
      || Number.isNaN(parsedEntryDate.getTime())
      || parsedEntryDate.toISOString().slice(0, 10) !== entryDate) {
      Toast.show({ type: 'error', text1: 'Check transaction', text2: 'Entry date must use YYYY-MM-DD.' });
      return;
    }
    let parsedAmount: number;
    try {
      parsedAmount = validateAmount(amount);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Check transaction', text2: friendlyError(error, 'Invalid amount') });
      return;
    }

    setSavingTransaction(true);
    try {
      if (editingTransaction) {
        await transactionService.editTransaction(editingTransaction.id, {
          title: cleanTitle,
          amount: parsedAmount,
          type: transactionType,
          category: cleanCategory,
          description: cleanDescription,
          entryDate,
        });
      } else {
        await transactionService.addTransaction({
          bookId,
          title: cleanTitle,
          amount: parsedAmount,
          type: transactionType,
          category: cleanCategory,
          description: cleanDescription,
          entryDate,
        });
      }
      setShowTransactionModal(false);
      Toast.show({ type: 'success', text1: 'Saved', text2: `Transaction ${editingTransaction ? 'updated' : 'added'}.` });
      await refreshTransactionsAndTotals();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not save transaction', text2: friendlyError(error, 'Could not save transaction') });
    } finally {
      setSavingTransaction(false);
    }
  };

  const deleteTransaction = (transaction: Transaction) => {
    Alert.alert('Delete transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await transactionService.deleteTransaction(transaction.id);
            await refreshTransactionsAndTotals();
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Transaction deleted.' });
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not delete transaction', text2: friendlyError(error, 'Could not delete transaction') });
          }
        },
      },
    ]);
  };

  const sendInvite = async () => {
    if (!bookId || !inviteEmail.trim()) {
      Toast.show({ type: 'error', text1: 'Check email', text2: 'Enter an email address.' });
      return;
    }
    setSavingInvite(true);
    try {
      await invitationService.sendInvitation(bookId, inviteEmail);
      setInviteEmail('');
      setShowInviteModal(false);
      await loadInvitations();
      Toast.show({ type: 'success', text1: 'Invitation sent' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not send invitation', text2: friendlyError(error, 'Could not send invitation') });
    } finally {
      setSavingInvite(false);
    }
  };

  const removeMember = (member: Member) => {
    Alert.alert('Remove member', `Remove ${member.displayName || 'this member'} from the book?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setMemberActionId(member.userId);
          try {
            await invitationService.removeMember(bookId!, member.userId);
            await loadMembers();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not remove member', text2: friendlyError(error, 'Could not remove member') });
          } finally {
            setMemberActionId(null);
          }
        },
      },
    ]);
  };

  const leaveBook = () => {
    Alert.alert('Leave book', `Leave “${book?.name ?? initialName ?? 'this book'}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await invitationService.leaveBook(bookId!);
            navigation.goBack();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not leave book', text2: friendlyError(error, 'Could not leave book') });
          }
        },
      },
    ]);
  };

  const revokeInvitation = async (invitation: Invitation) => {
    try {
      await invitationService.revokeInvitation(invitation.id);
      await loadInvitations();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not revoke invitation', text2: friendlyError(error, 'Could not revoke invitation') });
    }
  };

  const retryButton = (onPress: () => void) => (
    <TouchableOpacity onPress={onPress} style={styles.retryButton}>
      <Text style={[styles.retryText, { color: theme.colors.primary }]}>Retry</Text>
    </TouchableOpacity>
  );

  const cardStyle = [styles.card, { backgroundColor: theme.colors.surface }];
  const inputStyle = [styles.input, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border, color: theme.colors.text }];
  const bookCurrency = book?.currencyCode ?? 'PKR';

  const listHeader = (
    <View>
      <View style={cardStyle}>
        {bookLoading ? <ActivityIndicator color={theme.colors.primary} /> : bookError ? (
          <View><Text style={{ color: theme.colors.error }}>{bookError}</Text>{retryButton(() => void loadBook())}</View>
        ) : book ? <>
          <Text style={[styles.bookName, { color: theme.colors.text }]}>{book.name}</Text>
          {!!book.description && <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>{book.description}</Text>}
          <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>{book.currencyCode} · {members.length} members</Text>
        </> : <Text style={{ color: theme.colors.textSecondary }}>{initialName ?? 'Book'}</Text>}
      </View>

      <View style={styles.summaryContainer}>
        {totalsLoading ? <View style={cardStyle}><ActivityIndicator color={theme.colors.primary} /></View> : totalsError ? (
          <View style={cardStyle}><Text style={{ color: theme.colors.error }}>{totalsError}</Text>{retryButton(() => void loadTotals())}</View>
        ) : totals ? <>
          {[
            ['Net Balance', totals.netBalance, totals.netBalance >= 0 ? theme.colors.success : theme.colors.error],
            ['Total In (+)', totals.cashInTotal, theme.colors.success],
            ['Total Out (-)', totals.cashOutTotal, theme.colors.error],
          ].map(([label, value, color]) => (
            <View key={String(label)} style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>{label}</Text>
              <Text style={[styles.summaryAmount, { color: String(color) }]}>{formatMoney(Number(value), bookCurrency)}</Text>
            </View>
          ))}
        </> : null}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => openAddTransaction('cash_in')}>
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.success} />
          <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Cash In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => openAddTransaction('cash_out')}>
          <Ionicons name="remove-circle-outline" size={24} color={theme.colors.error} />
          <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Cash Out</Text>
        </TouchableOpacity>
      </View>

      <View style={cardStyle}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Members</Text>
          {isOwner && <TouchableOpacity onPress={() => setShowInviteModal(true)} style={styles.inlineAction}>
            <Ionicons name="person-add-outline" size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary }}>Invite</Text>
          </TouchableOpacity>}
        </View>
        {membersLoading ? <ActivityIndicator color={theme.colors.primary} /> : membersError ? (
          <View><Text style={{ color: theme.colors.error }}>{membersError}</Text>{retryButton(() => void loadMembers())}</View>
        ) : members.length === 0 ? <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>No members found.</Text> :
          members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text }}>{member.displayName || 'Member'}</Text>
                <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>{member.role}</Text>
              </View>
              {isOwner && member.userId !== user?.id && <TouchableOpacity disabled={memberActionId === member.userId} onPress={() => removeMember(member)}>
                {memberActionId === member.userId ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Ionicons name="person-remove-outline" size={20} color={theme.colors.error} />}
              </TouchableOpacity>}
            </View>
          ))}
        {membersError === null && members.some((member) => member.userId === user?.id) && (
          <TouchableOpacity style={styles.leaveButton} onPress={leaveBook}>
            <Text style={{ color: theme.colors.error }}>Leave book</Text>
          </TouchableOpacity>
        )}
      </View>

      {isOwner && <View style={cardStyle}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pending invitations</Text>
          <TouchableOpacity onPress={() => void loadInvitations()}><Ionicons name="refresh" size={20} color={theme.colors.primary} /></TouchableOpacity>
        </View>
        {invitationsLoading ? <ActivityIndicator color={theme.colors.primary} /> : invitationsError ? (
          <View><Text style={{ color: theme.colors.error }}>{invitationsError}</Text>{retryButton(() => void loadInvitations())}</View>
        ) : invitations.length === 0 ? <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>No pending invitations.</Text> :
          invitations.map((invitation) => <View key={invitation.id} style={styles.memberRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text }}>{invitation.invitedEmail}</Text>
              <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity onPress={() => void revokeInvitation(invitation)}>
              <Text style={{ color: theme.colors.error }}>Revoke</Text>
            </TouchableOpacity>
          </View>)}
      </View>}

      <View style={styles.transactionsHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Transactions</Text>
        <TouchableOpacity onPress={() => void refreshTransactionsAndTotals()}><Ionicons name="refresh" size={20} color={theme.colors.primary} /></TouchableOpacity>
      </View>
      {transactionsLoading && transactions.length === 0 ? <View style={styles.stateBox}><ActivityIndicator color={theme.colors.primary} /><Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>Loading transactions…</Text></View> : null}
      {transactionsError && transactions.length === 0 ? <View style={styles.stateBox}><Text style={{ color: theme.colors.error }}>{transactionsError}</Text>{retryButton(() => void loadTransactions(true))}</View> : null}
      {!transactionsLoading && !transactionsError && transactions.length === 0 ? <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={48} color={theme.colors.textTertiary} />
        <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No transactions yet</Text>
        <Text style={[styles.secondary, { color: theme.colors.textSecondary }]}>Add your first transaction to get started.</Text>
      </View> : null}
      {transactionsError && transactions.length > 0 ? <View style={styles.stateBox}><Text style={{ color: theme.colors.error }}>{transactionsError}</Text>{retryButton(() => void loadTransactions(false))}</View> : null}
    </View>
  );

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const canEdit = item.createdBy === user?.id;
    const canDelete = canEdit || isOwner;
    const amountLabel = `${item.type === 'cash_in' ? '+' : '−'}${formatMoney(item.amount, bookCurrency)}`;
    const dateLabel = new Date(`${item.entryDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
    return (
      <View style={[styles.transactionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight }]}>
        <View style={styles.transactionTop}>
          <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>{dateLabel}</Text>
          <Text style={[styles.expenseAmount, { color: item.type === 'cash_in' ? theme.colors.success : theme.colors.error }]}>{amountLabel}</Text>
        </View>
        <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.expenseMeta, { color: theme.colors.textSecondary }]}>{item.category} · {members.find((member) => member.userId === item.createdBy)?.displayName || (item.createdBy === user?.id ? 'You' : 'Member')}</Text>
        {!!item.description && <Text style={[styles.expenseDescription, { color: theme.colors.textSecondary }]}>{item.description}</Text>}
        <Text style={[styles.expenseBalance, { color: theme.colors.textTertiary }]}>
          Balance after: {item.runningBalance === null ? '—' : formatMoney(item.runningBalance, bookCurrency)}
        </Text>
        {(canEdit || canDelete) && <View style={styles.transactionActions}>
          {canEdit && <TouchableOpacity onPress={() => openEditTransaction(item)} style={styles.inlineAction}><Ionicons name="create-outline" size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary }}>Edit</Text></TouchableOpacity>}
          {canDelete && <TouchableOpacity onPress={() => deleteTransaction(item)} style={styles.inlineAction}><Ionicons name="trash-outline" size={18} color={theme.colors.error} /><Text style={{ color: theme.colors.error }}>Delete</Text></TouchableOpacity>}
        </View>}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{book?.name ?? initialName ?? 'Book details'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={listHeader}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={theme.colors.primary} /> : null}
        contentContainerStyle={styles.content}
        onEndReached={() => { if (!transactionsLoading && !loadingMore && hasMoreTransactions) void loadTransactions(false); }}
        onEndReachedThreshold={0.35}
      />

      <Modal visible={showTransactionModal} animationType="slide" transparent onRequestClose={() => setShowTransactionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</Text>
              <TouchableOpacity onPress={() => setShowTransactionModal(false)}><Ionicons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>
            <FlatList
              data={[{ key: 'form' }]}
              keyExtractor={(item) => item.key}
              renderItem={() => <View style={styles.form}>
                <View style={styles.typeToggle}>
                  {(['cash_in', 'cash_out'] as const).map((type) => (
                    <TouchableOpacity key={type} onPress={() => setTransactionType(type)} style={[styles.typeButton, transactionType === type && { backgroundColor: theme.colors.primary }]}>
                      <Text style={{ color: transactionType === type ? theme.colors.onPrimary : theme.colors.text }}>{type === 'cash_in' ? 'Cash In' : 'Cash Out'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.label, { color: theme.colors.text }]}>Title *</Text><TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="Transaction title" placeholderTextColor={theme.colors.textTertiary} />
                <Text style={[styles.label, { color: theme.colors.text }]}>Amount *</Text><TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.colors.textTertiary} />
                <Text style={[styles.label, { color: theme.colors.text }]}>Category *</Text><TextInput style={inputStyle} value={category} onChangeText={setCategory} placeholder="General" placeholderTextColor={theme.colors.textTertiary} />
                <Text style={[styles.label, { color: theme.colors.text }]}>Description (Optional)</Text><TextInput style={[inputStyle, styles.textArea]} value={description} onChangeText={setDescription} multiline placeholder="Add details" placeholderTextColor={theme.colors.textTertiary} />
                <Text style={[styles.label, { color: theme.colors.text }]}>Entry date (YYYY-MM-DD) *</Text><TextInput style={inputStyle} value={entryDate} onChangeText={setEntryDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textTertiary} autoCapitalize="none" />
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.colors.primary, opacity: savingTransaction ? 0.6 : 1 }]} onPress={() => void saveTransaction()} disabled={savingTransaction}>
                  <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>{savingTransaction ? 'Saving…' : editingTransaction ? 'Save Changes' : 'Add Transaction'}</Text>
                </TouchableOpacity>
              </View>}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showInviteModal} animationType="slide" transparent onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.colors.text }]}>Invite Member</Text><TouchableOpacity onPress={() => setShowInviteModal(false)}><Ionicons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity></View>
            <Text style={[styles.label, { color: theme.colors.text }]}>Email address *</Text>
            <TextInput style={inputStyle} value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" placeholderTextColor={theme.colors.textTertiary} />
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.colors.primary, opacity: savingInvite ? 0.6 : 1 }]} onPress={() => void sendInvite()} disabled={savingInvite}>
              <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>{savingInvite ? 'Sending…' : 'Send Invitation'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  content: { padding: 16, paddingBottom: 36 },
  card: { padding: 18, marginHorizontal: 4, marginTop: 12, borderRadius: 12 },
  bookName: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  secondary: { fontSize: 14, marginTop: 5 },
  summaryContainer: { paddingHorizontal: 4, marginTop: 8 },
  summaryCard: { padding: 16, borderRadius: 12, marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, fontWeight: '500' },
  summaryAmount: { fontSize: 20, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', gap: 12, marginHorizontal: 4, marginTop: 16 },
  actionButton: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  actionButtonText: { fontSize: 15, fontWeight: '600' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#8884', paddingVertical: 12 },
  leaveButton: { alignSelf: 'flex-start', paddingVertical: 10, marginTop: 4 },
  transactionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 4, marginTop: 24, marginBottom: 8 },
  transactionCard: { padding: 16, marginHorizontal: 4, marginVertical: 6, borderRadius: 12, borderWidth: 1 },
  transactionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  expenseDate: { fontSize: 13 },
  expenseAmount: { fontSize: 16, fontWeight: '700' },
  expenseTitle: { fontSize: 17, fontWeight: '600' },
  expenseMeta: { fontSize: 13, marginTop: 6 },
  expenseDescription: { fontSize: 14, marginTop: 8 },
  expenseBalance: { fontSize: 13, marginTop: 12 },
  transactionActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 8 },
  stateBox: { alignItems: 'center', padding: 18, gap: 8 },
  emptyState: { alignItems: 'center', padding: 24, gap: 8 },
  emptyStateText: { fontSize: 16, fontWeight: '600' },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  retryText: { fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '90%', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  form: { paddingBottom: 16 },
  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeButton: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 8, backgroundColor: '#8882' },
  label: { fontSize: 14, fontWeight: '500', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  submitButton: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  submitButtonText: { fontSize: 16, fontWeight: '600' },
});
