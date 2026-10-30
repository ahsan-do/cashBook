import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Book, Member, Transaction } from '../types';
import { bookService } from '../services/bookService';
import { transactionService, TransactionCursor } from '../services/transactionService';
import { formatMoney } from '../services/money';
import { toServiceError } from '../services/serviceErrors';
import { QuickAddSheet } from '../components/QuickAddSheet';
import { BalanceAmount } from '../components/BalanceAmount';
import { categoryIcon } from '../theme/categories';

interface Props { navigation: any; route: any; }
interface DaySection { date: string; data: Transaction[]; }
type Totals = { cashInTotal: number; cashOutTotal: number; netBalance: number };

const dateLabel = (date: string) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (date === todayKey) return 'Today';
  if (date === yesterdayKey) return 'Yesterday';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

export const GroupDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const bookId: string | undefined = route.params?.bookId;
  const initialName: string | undefined = route.params?.name;
  const { user } = useAuth();
  const { theme } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<TransactionCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [actionId, setActionId] = useState<string | null>(null);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const loadFirstPage = useCallback(async () => {
    if (!bookId) { setError('This book could not be opened.'); setLoading(false); return; }
    setError(null);
    try {
      const [bookInfo, bookTotals, members, page] = await Promise.all([
        bookService.getBook(bookId),
        transactionService.getBookTotals(bookId),
        bookService.listMembers(bookId),
        transactionService.pageTransactions({ bookId, pageSize: 30 }),
      ]);
      setBook(bookInfo);
      setTotals(bookTotals);
      setIsOwner(members.some((member: Member) => member.userId === user?.id && member.role === 'owner'));
      setTransactions(page.transactions);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
    } catch (loadError) {
      setError(toServiceError(loadError, 'Could not load this book').message);
    } finally { setLoading(false); }
  }, [bookId, user?.id]);

  useEffect(() => { void loadFirstPage(); }, [loadFirstPage]);

  const refresh = async () => {
    setRefreshing(true);
    try { await loadFirstPage(); } finally { setRefreshing(false); }
  };

  const loadMore = async () => {
    if (!bookId || !cursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await transactionService.pageTransactions({ bookId, pageSize: 30, cursor });
      setTransactions((current) => [...current, ...page.transactions]);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
    } catch (loadError) { Alert.alert('Could not load more entries', toServiceError(loadError, 'Could not load transactions').message); }
    finally { setLoadingMore(false); }
  };

  const deleteEntry = (item: Transaction) => {
    Alert.alert('Delete entry', `Delete “${item.title}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setActionId(item.id);
        try { await transactionService.deleteTransaction(item.id); await loadFirstPage(); }
        catch (deleteError) { Alert.alert('Could not delete entry', toServiceError(deleteError, 'Could not delete transaction').message); }
        finally { setActionId(null); }
      } },
    ]);
  };

  const sections: DaySection[] = useMemo(() => {
    const grouped = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const bucket = grouped.get(transaction.entryDate) ?? [];
      bucket.push(transaction);
      grouped.set(transaction.entryDate, bucket);
    }
    return Array.from(grouped.entries()).map(([date, data]) => ({ date, data }));
  }, [transactions]);

  const currency = book?.currencyCode ?? 'PKR';
  const canDelete = (item: Transaction) => item.createdBy === user?.id || isOwner;
  const renderItem = ({ item }: { item: Transaction }) => {
    const editable = item.createdBy === user?.id;
    const row = <TouchableOpacity style={styles.entry} activeOpacity={editable ? 0.7 : 1} onPress={editable ? () => setEditing(item) : undefined} accessibilityRole={editable ? 'button' : undefined} accessibilityLabel={editable ? `Edit ${item.title}` : undefined}>
      <View style={styles.categoryIcon}><Ionicons name={categoryIcon(item.category)} size={18} color={theme.colors.textSecondary} /></View>
      <View style={styles.entryBody}>
        <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.entryMeta}>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {item.category}</Text>
      </View>
      <View style={styles.entryAmounts}>
        <View style={styles.signedAmount}><Ionicons name={item.type === 'cash_in' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={15} color={item.type === 'cash_in' ? theme.colors.success : theme.colors.error} /><Text style={[styles.entryAmount, { color: item.type === 'cash_in' ? theme.colors.success : theme.colors.error }]}>{item.type === 'cash_in' ? '+' : '−'}{formatMoney(item.amount, currency)}</Text></View>
        <Text style={styles.runningBalance}>{item.runningBalance == null ? '—' : formatMoney(item.runningBalance, currency)}</Text>
      </View>
    </TouchableOpacity>;
    if (!canDelete(item)) return row;
    return <Swipeable
      overshootRight={false}
      renderRightActions={() => <TouchableOpacity style={styles.deleteAction} onPress={() => deleteEntry(item)} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}><Ionicons name="trash-outline" size={21} color={theme.colors.onError} /><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>}
    >{row}</Swipeable>;
  };

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={23} color={theme.colors.text} /></TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{book?.name ?? initialName ?? 'Cash book'}</Text>
      <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('BookMembers', { bookId, name: book?.name ?? initialName })} accessibilityRole="button" accessibilityLabel="Book members and invitations"><Ionicons name="people-outline" size={23} color={theme.colors.primaryVariant} /></TouchableOpacity>
    </View>

    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>Net balance</Text>
      {totals ? <BalanceAmount amount={totals.netBalance} currencyCode={currency} /> : <ActivityIndicator color={theme.colors.primary} />}
      <View style={styles.summaryFlows}>
        <Text style={[styles.flowValue, { color: theme.colors.success }]}>In {totals ? formatMoney(totals.cashInTotal, currency) : '—'}</Text>
        <View style={styles.flowDivider} />
        <Text style={[styles.flowValue, { color: theme.colors.error }]}>Out {totals ? formatMoney(totals.cashOutTotal, currency) : '—'}</Text>
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>

    {loading && transactions.length === 0 ? <View style={styles.state}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.stateText}>Loading entries…</Text></View>
      : error && transactions.length === 0 ? <View style={styles.state}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); void loadFirstPage(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
        : <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => {
            const dailyNet = section.data.reduce((sum, entry) => sum + (entry.type === 'cash_in' ? entry.amount : -entry.amount), 0);
            const incompleteNewestDay = hasMore && section.date === sections[sections.length - 1]?.date;
            return <View style={styles.dayHeader}><Text style={styles.dayText}>{dateLabel(section.date)}</Text>{!incompleteNewestDay && <Text style={[styles.dayNet, { color: dailyNet >= 0 ? theme.colors.success : theme.colors.error }]}>{dailyNet >= 0 ? '+' : '−'}{formatMoney(Math.abs(dailyNet), currency)}</Text>}</View>;
          }}
          stickySectionHeadersEnabled
          contentContainerStyle={sections.length ? styles.listContent : styles.emptyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="receipt-outline" size={34} color={theme.colors.textTertiary} /><Text style={styles.emptyTitle}>No entries yet</Text><Text style={styles.emptyCopy}>Add your first cash-in or cash-out entry.</Text></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: theme.spacing.lg }} color={theme.colors.primary} /> : null}
        />}

    {!loading && <TouchableOpacity style={styles.fab} onPress={() => { setEditing(undefined); setQuickAddVisible(true); }} accessibilityRole="button" accessibilityLabel="Add a transaction"><Ionicons name="add" size={28} color={theme.colors.onPrimary} /></TouchableOpacity>}
    <QuickAddSheet visible={quickAddVisible || Boolean(editing)} books={book ? [book] : []} defaultBookId={bookId} editingTransaction={editing} onClose={() => { setQuickAddVisible(false); setEditing(undefined); }} onSaved={loadFirstPage} />
  </SafeAreaView>;
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { minHeight: 60, paddingHorizontal: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: theme.colors.text, fontWeight: '700', fontSize: theme.typeSize.subtitle },
  summary: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  summaryLabel: { color: theme.colors.textSecondary, fontSize: theme.typeSize.small, fontWeight: '600' },
  summaryFlows: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.xs },
  flowValue: { fontSize: theme.typeSize.caption, fontWeight: '600' },
  flowDivider: { width: 1, height: 16, backgroundColor: theme.colors.border },
  errorText: { color: theme.colors.error, fontSize: theme.typeSize.small, marginTop: theme.spacing.sm },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.xl },
  stateText: { color: theme.colors.textSecondary },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
  retryText: { color: theme.colors.primaryVariant, fontWeight: '700' },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: 100 },
  emptyContent: { flexGrow: 1, padding: theme.spacing.lg, paddingBottom: 100 },
  dayHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.xs, backgroundColor: theme.colors.background },
  dayText: { fontSize: theme.typeSize.small, color: theme.colors.textSecondary, fontWeight: '700' },
  dayNet: { fontSize: theme.typeSize.caption, fontWeight: '700' },
  entry: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  categoryIcon: { width: 40, height: 40, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceVariant },
  entryBody: { flex: 1 },
  entryTitle: { fontSize: theme.typeSize.body, fontWeight: '600', color: theme.colors.text },
  entryMeta: { fontSize: theme.typeSize.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  entryAmounts: { alignItems: 'flex-end' },
  signedAmount: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs },
  entryAmount: { fontSize: theme.typeSize.small, fontWeight: '700' },
  runningBalance: { fontSize: theme.typeSize.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  deleteAction: { width: 86, minHeight: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.error, gap: theme.spacing.xs },
  deleteText: { fontSize: theme.typeSize.caption, fontWeight: '700', color: theme.colors.onError },
  empty: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xxxl, flex: 1 },
  emptyTitle: { fontSize: theme.typeSize.subtitle, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.md },
  emptyCopy: { color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xs },
  fab: { position: 'absolute', right: theme.spacing.xl, bottom: theme.spacing.xl, width: 60, height: 60, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
});
