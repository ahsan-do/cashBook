import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Book, PendingInvitation, Transaction } from '../types';
import { bookService } from '../services/bookService';
import { invitationService } from '../services/invitationService';
import { transactionService } from '../services/transactionService';
import { formatMoney } from '../services/money';
import { toServiceError } from '../services/serviceErrors';
import { QuickAddSheet } from '../components/QuickAddSheet';
import { BalanceAmount } from '../components/BalanceAmount';
import { categoryIcon } from '../theme/categories';
import { formatEntryDate } from '../utils/dateDisplay';

interface HomeScreenProps { navigation: any; }
type BookOverview = { book: Book; cashIn: number; cashOut: number; balance: number; recent: Transaction[] };

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [overviews, setOverviews] = useState<BookOverview[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const loadHome = useCallback(async () => {
    if (!user?.id) {
      setOverviews([]);
      setPendingInvitations([]);
      setLoading(false);
      setError(null);
      return;
    }
    setError(null);
    try {
      const [books, invitations] = await Promise.all([
        bookService.listMyBooks(user.id),
        invitationService.listMyPendingInvitations(),
      ]);
      const data = await Promise.all(books.map(async (book): Promise<BookOverview> => {
        const [totals, page] = await Promise.all([
          transactionService.getBookTotals(book.id),
          transactionService.pageTransactions({ bookId: book.id, pageSize: 3 }),
        ]);
        return { book, cashIn: totals.cashInTotal, cashOut: totals.cashOutTotal, balance: totals.netBalance, recent: page.transactions };
      }));
      setOverviews(data);
      setPendingInvitations(invitations);
    } catch (loadError) {
      setError(toServiceError(loadError, 'Could not load your cashbook overview').message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadHome(); }, [loadHome]);
  const refresh = async () => {
    setRefreshing(true);
    try { await loadHome(); } finally { setRefreshing(false); }
  };
  const books = useMemo(() => overviews.map(({ book }) => book), [overviews]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const openBook = (book: Book) => navigation.navigate('GroupDetails', { bookId: book.id, name: book.name });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>Hello, {user?.displayName}</Text>
            <Text style={styles.subtitle}>Your books at a glance</Text>
          </View>
          {pendingInvitations.length > 0 && <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Invitations')} accessibilityRole="button" accessibilityLabel={`${pendingInvitations.length} pending invitations`}>
            <Ionicons name="mail-outline" size={23} color={theme.colors.primaryVariant} />
            <View style={styles.invitationBadge}><Text style={styles.badgeText}>{pendingInvitations.length}</Text></View>
          </TouchableOpacity>}
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.stateText}>Loading your books…</Text></View>
          : error ? <View style={styles.state}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); void loadHome(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
            : overviews.length === 0 ? <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="wallet-outline" size={34} color={theme.colors.primaryVariant} /></View>
              <Text style={styles.emptyTitle}>Start your first cash book</Text>
              <Text style={styles.emptyCopy}>Keep cash in and cash out together, with a clear running balance.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('CreateGroup')} accessibilityRole="button"><Text style={styles.primaryButtonText}>Create your first book</Text></TouchableOpacity>
            </View>
              : <View style={styles.bookList}>{overviews.map(({ book, cashIn, cashOut, balance, recent }) => (
                <View key={book.id} style={styles.bookCard}>
                  <TouchableOpacity onPress={() => openBook(book)} accessibilityRole="button" accessibilityLabel={`Open ${book.name}`}>
                    <View style={styles.bookTop}><Text style={styles.bookName} numberOfLines={1}>{book.name}</Text><Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} /></View>
                    <Text style={styles.balanceLabel}>Net balance</Text>
                    <BalanceAmount compact amount={balance} currencyCode={book.currencyCode} />
                    <Text style={styles.flowLine}><Text style={{ color: theme.colors.success }}>In {formatMoney(cashIn, book.currencyCode)}</Text><Text style={{ color: theme.colors.textTertiary }}>  ·  </Text><Text style={{ color: theme.colors.error }}>Out {formatMoney(cashOut, book.currencyCode)}</Text></Text>
                  </TouchableOpacity>
                  {recent.length > 0 && <View style={styles.recentBlock}>
                    <Text style={styles.recentHeading}>Recent</Text>
                    {recent.map((transaction) => <TouchableOpacity key={transaction.id} style={styles.recentRow} onPress={() => openBook(book)} accessibilityRole="button" accessibilityLabel={`Open ${transaction.title} in ${book.name}`}>
                      <View style={styles.categoryIcon}><Ionicons name={categoryIcon(transaction.category)} size={16} color={theme.colors.textSecondary} /></View>
                      <View style={styles.recentCopy}><Text style={styles.recentTitle} numberOfLines={1}>{transaction.description?.trim() || transaction.category}</Text><Text style={styles.recentDate}>{formatEntryDate(transaction.entryDate)}</Text></View>
                      <View style={styles.recentValue}><Ionicons name={transaction.type === 'cash_in' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={14} color={transaction.type === 'cash_in' ? theme.colors.success : theme.colors.error} /><Text style={[styles.recentAmount, { color: transaction.type === 'cash_in' ? theme.colors.success : theme.colors.error }]}>{transaction.type === 'cash_in' ? '+' : '−'}{formatMoney(transaction.amount, book.currencyCode)}</Text></View>
                    </TouchableOpacity>)}
                  </View>}
                </View>
              ))}</View>}
        {overviews.length > 0 && <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Groups')} accessibilityRole="button"><Text style={styles.seeAllText}>All books</Text><Ionicons name="arrow-forward" size={16} color={theme.colors.primaryVariant} /></TouchableOpacity>}
      </ScrollView>
      {overviews.length > 0 && !loading && <TouchableOpacity style={styles.fab} onPress={() => setQuickAddVisible(true)} accessibilityRole="button" accessibilityLabel="Add a transaction">
        <Ionicons name="add" size={28} color={theme.colors.onPrimary} />
      </TouchableOpacity>}
      <QuickAddSheet visible={quickAddVisible} books={books} onClose={() => setQuickAddVisible(false)} onSaved={loadHome} />
    </SafeAreaView>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { padding: theme.spacing.xl, paddingBottom: 60 + theme.spacing.xl + theme.spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xxl },
  headerCopy: { flex: 1 },
  greeting: { fontSize: theme.typeSize.title, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: theme.typeSize.small, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  iconButton: { minWidth: 48, minHeight: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  invitationBadge: { position: 'absolute', right: 1, top: 1, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  badgeText: { color: theme.colors.onPrimary, fontSize: theme.typeSize.caption, fontWeight: '700' },
  state: { alignItems: 'center', padding: theme.spacing.xxxl, gap: theme.spacing.md },
  stateText: { fontSize: theme.typeSize.body, color: theme.colors.textSecondary },
  errorText: { fontSize: theme.typeSize.body, color: theme.colors.error, textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: theme.spacing.lg, justifyContent: 'center' },
  retryText: { color: theme.colors.primaryVariant, fontWeight: '700', fontSize: theme.typeSize.body },
  emptyState: { alignItems: 'center', paddingHorizontal: theme.spacing.xxl, paddingTop: 72, paddingBottom: 72 },
  emptyIcon: { width: 72, height: 72, borderRadius: theme.radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceVariant },
  emptyTitle: { fontSize: theme.typeSize.title, color: theme.colors.text, fontWeight: '700', marginTop: theme.spacing.xl, textAlign: 'center' },
  emptyCopy: { fontSize: theme.typeSize.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.sm, lineHeight: 24 },
  primaryButton: { minHeight: 52, paddingHorizontal: theme.spacing.xxl, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.xxl },
  primaryButtonText: { fontSize: theme.typeSize.body, color: theme.colors.onPrimary, fontWeight: '700' },
  bookList: { gap: theme.spacing.md },
  bookCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.borderLight },
  bookTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookName: { flex: 1, color: theme.colors.text, fontSize: theme.typeSize.subtitle, fontWeight: '700' },
  balanceLabel: { marginTop: theme.spacing.md, color: theme.colors.textSecondary, fontSize: theme.typeSize.small },
  balance: { marginTop: theme.spacing.xs },
  flowLine: { fontSize: theme.typeSize.caption, marginTop: theme.spacing.xs },
  recentBlock: { marginTop: theme.spacing.lg, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.borderLight },
  recentHeading: { fontSize: theme.typeSize.caption, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: theme.spacing.xs },
  recentRow: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  categoryIcon: { width: 34, height: 34, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceVariant },
  recentCopy: { flex: 1 },
  recentTitle: { color: theme.colors.text, fontSize: theme.typeSize.small, fontWeight: '600' },
  recentDate: { color: theme.colors.textSecondary, fontSize: theme.typeSize.caption, marginTop: 2 },
  recentValue: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs },
  recentAmount: { fontSize: theme.typeSize.caption, fontWeight: '700' },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, minHeight: 48, marginTop: theme.spacing.sm },
  seeAllText: { color: theme.colors.primaryVariant, fontWeight: '700', fontSize: theme.typeSize.small },
  fab: { position: 'absolute', right: theme.spacing.xl, bottom: theme.spacing.xl, minWidth: 60, minHeight: 60, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, elevation: 5, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
});
