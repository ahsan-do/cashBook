import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Book, PendingInvitation, Transaction } from '../types';
import { bookService } from '../services/bookService';
import { transactionService } from '../services/transactionService';
import { invitationService } from '../services/invitationService';
import { formatMoney } from '../services/money';
import { toServiceError } from '../services/serviceErrors';

interface HomeScreenProps { navigation: any; }
type BookTotals = { cashInTotal: number; cashOutTotal: number; netBalance: number };

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [totals, setTotals] = useState<Record<string, BookTotals>>({});
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    if (!user?.id) {
      setBooks([]);
      setTotals({});
      setRecentTransactions([]);
      setPendingInvitations([]);
      setLoading(false);
      setError(null);
      return;
    }
    setError(null);
    try {
      const [myBooks, invitations] = await Promise.all([
        bookService.listMyBooks(user.id),
        invitationService.listMyPendingInvitations(),
      ]);
      const [bookTotals, transactionPages] = await Promise.all([
        Promise.all(myBooks.map(async (book) => [book.id, await transactionService.getBookTotals(book.id)] as const)),
        Promise.all(myBooks.map(async (book) => ({
          bookId: book.id,
          page: await transactionService.pageTransactions({ bookId: book.id, pageSize: 3 }),
        }))),
      ]);
      const mergedTransactions = transactionPages
        .flatMap(({ page }) => page.transactions)
        .sort((a, b) => b.entryDate.localeCompare(a.entryDate)
          || b.createdAt.localeCompare(a.createdAt)
          || b.id.localeCompare(a.id))
        .slice(0, 5);
      setBooks(myBooks);
      setTotals(Object.fromEntries(bookTotals));
      setRecentTransactions(mergedTransactions);
      setPendingInvitations(invitations);
    } catch (loadError) {
      setError(toServiceError(loadError, 'Could not load your cashbook overview').message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadHome(); }, [loadHome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadHome(); } finally { setRefreshing(false); }
  }, [loadHome]);

  const bookById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);

  const renderBookCard = (book: Book) => {
    const bookTotals = totals[book.id];
    return (
      <TouchableOpacity
        key={book.id}
        style={[styles.bookCard, { backgroundColor: theme.colors.surfaceVariant }]}
        onPress={() => navigation.navigate('GroupDetails', { bookId: book.id, name: book.name })}
      >
        <View style={styles.bookInfo}>
          <Text style={[styles.bookName, { color: theme.colors.text }]}>{book.name}</Text>
          {!!book.description && <Text style={[styles.bookDescription, { color: theme.colors.textSecondary }]} numberOfLines={1}>{book.description}</Text>}
          {bookTotals ? (
            <>
              <Text style={[styles.totalLine, { color: theme.colors.success }]}>In {formatMoney(bookTotals.cashInTotal, book.currencyCode)}</Text>
              <Text style={[styles.totalLine, { color: theme.colors.error }]}>Out {formatMoney(bookTotals.cashOutTotal, book.currencyCode)}</Text>
              <Text style={[styles.totalLine, { color: theme.colors.textSecondary }]}>Balance {formatMoney(bookTotals.netBalance, book.currencyCode)}</Text>
            </>
          ) : <ActivityIndicator size="small" color={theme.colors.primary} />}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Hello, {user?.displayName}!</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Here's your cashbook overview</Text>
          </View>
          {pendingInvitations.length > 0 && (
            <TouchableOpacity style={styles.invitationButton} onPress={() => navigation.navigate('Invitations')} accessibilityLabel={`${pendingInvitations.length} pending invitations`}>
              <Ionicons name="mail" size={24} color={theme.colors.primary} />
              <View style={[styles.invitationBadge, { backgroundColor: theme.colors.error }]}><Text style={[styles.invitationCount, { color: theme.colors.onError }]}>{pendingInvitations.length}</Text></View>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Books</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Groups')}><Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text></TouchableOpacity>
          </View>
          {loading ? <View style={styles.loadingContainer}><ActivityIndicator color={theme.colors.primary} /><Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading your books...</Text></View>
            : error ? <View style={styles.emptyState}><Text style={[styles.emptyStateText, { color: theme.colors.error }]}>{error}</Text><TouchableOpacity onPress={() => { setLoading(true); void loadHome(); }}><Text style={[styles.seeAllText, { color: theme.colors.primary }]}>Retry</Text></TouchableOpacity></View>
              : books.length === 0 ? <View style={styles.emptyState}><Ionicons name="wallet-outline" size={48} color={theme.colors.textTertiary} /><Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No books yet</Text><Text style={[styles.emptyStateSubtext, { color: theme.colors.textTertiary }]}>Create a book to start tracking transactions</Text><TouchableOpacity style={[styles.createBookButton, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.navigate('CreateGroup')}><Text style={[styles.createBookButtonText, { color: theme.colors.onPrimary }]}>Create Book</Text></TouchableOpacity></View>
                : <ScrollView horizontal showsHorizontalScrollIndicator={false}>{books.slice(0, 3).map(renderBookCard)}</ScrollView>}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Transactions</Text></View>
          {loading ? <View style={styles.loadingContainer}><ActivityIndicator color={theme.colors.primary} /><Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading transactions...</Text></View>
            : error ? <View style={styles.emptyState}><Text style={[styles.emptyStateText, { color: theme.colors.error }]}>{error}</Text><TouchableOpacity onPress={() => { setLoading(true); void loadHome(); }}><Text style={[styles.seeAllText, { color: theme.colors.primary }]}>Retry</Text></TouchableOpacity></View>
              : recentTransactions.length === 0 ? <View style={styles.emptyState}><Ionicons name="receipt-outline" size={48} color={theme.colors.textTertiary} /><Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No transactions yet</Text><Text style={[styles.emptyStateSubtext, { color: theme.colors.textTertiary }]}>Add transactions to your books to see them here</Text></View>
                : recentTransactions.map((transaction) => {
                  const book = bookById.get(transaction.bookId);
                  const incoming = transaction.type === 'cash_in';
                  return <TouchableOpacity key={transaction.id} style={[styles.transactionItem, { borderBottomColor: theme.colors.borderLight }]} onPress={() => book && navigation.navigate('GroupDetails', { bookId: book.id, name: book.name })}>
                    <View style={styles.transactionInfo}><Text style={[styles.transactionTitle, { color: theme.colors.text }]}>{transaction.title}</Text><Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>{book?.name ?? ''} · {transaction.category} · {transaction.entryDate}</Text></View>
                    {book && <Text style={[styles.transactionAmount, { color: incoming ? theme.colors.success : theme.colors.error }]}>{incoming ? '+' : '−'}{formatMoney(transaction.amount, book.currencyCode)}</Text>}
                  </TouchableOpacity>;
                })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16 },
  invitationButton: { position: 'relative', padding: 4 },
  invitationBadge: { position: 'absolute', top: -4, right: -4, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  invitationCount: { fontSize: 12, fontWeight: 'bold' },
  section: { margin: 20, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  seeAllText: { fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 12 },
  emptyStateText: { fontSize: 16, fontWeight: '500', marginTop: 12, textAlign: 'center' },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  createBookButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  createBookButtonText: { fontWeight: '600' },
  bookCard: { padding: 16, borderRadius: 8, marginRight: 12, minWidth: 190, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bookInfo: { flex: 1 },
  bookName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  bookDescription: { fontSize: 13, marginBottom: 6 },
  totalLine: { fontSize: 12, marginTop: 3 },
  transactionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  transactionInfo: { flex: 1, paddingRight: 12 },
  transactionTitle: { fontSize: 16, fontWeight: '500' },
  transactionCategory: { fontSize: 13, marginTop: 3 },
  transactionAmount: { fontSize: 15, fontWeight: '600' },
  loadingContainer: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  loadingText: { fontSize: 14 },
});
