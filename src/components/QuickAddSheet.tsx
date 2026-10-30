import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Book, Transaction, TransactionType } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { transactionService } from '../services/transactionService';
import { parseMoneyAmount } from '../services/money';
import { toServiceError } from '../services/serviceErrors';
import { categoryOptions } from '../theme/categories';
import { formatEntryDate } from '../utils/dateDisplay';

const RECENT_CATEGORIES_KEY = 'cashbook_recent_categories';
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const dateLabel = (date: string) => formatEntryDate(date);

interface QuickAddSheetProps {
  visible: boolean;
  books: Book[];
  defaultBookId?: string;
  editingTransaction?: Transaction;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({ visible, books, defaultBookId, editingTransaction, onClose, onSaved }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const initialBook = useMemo(() => books.find((book) => book.id === defaultBookId) ?? books[0], [books, defaultBookId]);
  const [bookId, setBookId] = useState(initialBook?.id ?? '');
  const [type, setType] = useState<TransactionType>('cash_out');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(today());
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBookId(editingTransaction?.bookId ?? initialBook?.id ?? '');
    setType(editingTransaction?.type ?? 'cash_out');
    setAmount(editingTransaction ? String(editingTransaction.amount) : '');
    setCategory(editingTransaction?.category ?? 'Other');
    setNoteVisible(Boolean(editingTransaction?.description));
    setNote(editingTransaction?.description ?? '');
    setEntryDate(editingTransaction?.entryDate ?? today());
    setDatePickerVisible(false);
    setError(null);
    void AsyncStorage.getItem(RECENT_CATEGORIES_KEY).then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((item): item is string => typeof item === 'string');
          const recent = clean.filter((item) => categoryOptions.some((option) => option.name === item));
          setRecentCategories(recent);
          if (!editingTransaction && recent.length) setCategory(recent[0]);
        }
      }
    }).catch(() => setRecentCategories([]));
  }, [visible, initialBook]);

  const categories = useMemo(() => [
    ...recentCategories.map((name) => categoryOptions.find((item) => item.name === name)!).filter(Boolean),
    ...categoryOptions.filter((item) => !recentCategories.includes(item.name)),
  ], [recentCategories]);

  const inputStyle = [styles.input, {
    backgroundColor: theme.colors.surfaceVariant,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  }];

  const save = async () => {
    setError(null);
    const normalizedAmount = amount.trim();
    const normalizedCategory = category.trim();
    if (!bookId) { setError('Choose a book first.'); return; }
    if (!/^(?:\d{1,12})(?:\.\d{1,2})?$/.test(normalizedAmount)) {
      setError('Enter a positive amount with up to two decimal places.');
      return;
    }
    let parsedAmount: number;
    try { parsedAmount = parseMoneyAmount(normalizedAmount); } catch (parseError) {
      setError(toServiceError(parseError, 'Enter a valid amount').message);
      return;
    }
    if (parsedAmount <= 0) { setError('Amount must be greater than zero.'); return; }
    if (!normalizedCategory) { setError('Choose a category.'); return; }
    const parsedDate = new Date(`${entryDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== entryDate) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      if (editingTransaction) {
        await transactionService.editTransaction(editingTransaction.id, {
          title: normalizedCategory,
          amount: parsedAmount,
          type,
          category: normalizedCategory,
          description: note.trim() || null,
          entryDate,
        });
      } else {
        await transactionService.addTransaction({
          bookId,
          title: normalizedCategory,
          amount: parsedAmount,
          type,
          category: normalizedCategory,
          description: note.trim() || null,
          entryDate,
        });
      }
      const updatedCategories = [normalizedCategory, ...recentCategories.filter((item) => item !== normalizedCategory)].slice(0, 7);
      setRecentCategories(updatedCategories);
      try { await AsyncStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(updatedCategories)); } catch { /* Recent categories are a convenience, not part of the transaction save. */ }
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { /* Haptics may be unavailable on some devices. */ }
      onClose();
      void onSaved();
    } catch (saveError) {
      setError(toServiceError(saveError, 'Could not save transaction').message);
    } finally {
      setSaving(false);
    }
  };

  const pressKey = (key: string) => {
    setError(null);
    if (key === 'backspace') { setAmount((value) => value.slice(0, -1)); return; }
    if (key === '.') {
      setAmount((value) => value.includes('.') ? value : `${value || '0'}.`);
      return;
    }
    setAmount((value) => {
      const [whole, fraction] = value.split('.');
      if (value.includes('.') && fraction.length >= 2) return value;
      if (!value.includes('.') && whole.length >= 12) return value;
      return `${value}${key}`;
    });
  };

  const shiftDate = (offset: number) => {
    const date = new Date(`${entryDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    setEntryDate(date.toISOString().slice(0, 10));
  };
  const selectedDateLabel = formatEntryDate(entryDate);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} accessibilityLabel="Close quick add" />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: Math.max(theme.spacing.lg, insets.bottom + theme.spacing.md) }]}>
          <View style={styles.handleArea}><View style={[styles.handle, { backgroundColor: theme.colors.border }]} /></View>
          <View style={styles.header}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>{editingTransaction ? 'Edit transaction' : 'Quick add'}</Text>
            <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close quick add"><Ionicons name="close" size={23} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {!editingTransaction && books.length > 1 && <>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Book</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {books.map((book) => <TouchableOpacity key={book.id} style={[styles.bookChip, { borderColor: book.id === bookId ? theme.colors.primary : theme.colors.border, backgroundColor: book.id === bookId ? theme.colors.primary : theme.colors.surfaceVariant }]} onPress={() => setBookId(book.id)} accessibilityRole="button" accessibilityState={{ selected: book.id === bookId }}><Text style={{ color: book.id === bookId ? theme.colors.onPrimary : theme.colors.text }}>{book.name}</Text></TouchableOpacity>)}
              </ScrollView>
            </>}
            <View style={styles.amountArea} accessibilityLabel="Transaction amount">
              <View style={styles.amountReadout}>
                <Text style={[styles.amountText, { color: theme.colors.text }]}>{amount || '0'}</Text>
                <Text style={[styles.amountCurrency, { color: theme.colors.textTertiary }]}>{books.find((book) => book.id === bookId)?.currencyCode ?? ''}</Text>
              </View>
              <Text style={[styles.amountHint, { color: theme.colors.textTertiary }]}>Amount</Text>
            </View>
            <View style={[styles.typeToggle, { backgroundColor: theme.colors.surfaceVariant }]}>
              {(['cash_out', 'cash_in'] as const).map((option) => {
                const selected = type === option;
                const label = option === 'cash_in' ? 'Cash In' : 'Cash Out';
                return <TouchableOpacity key={option} style={[styles.typeButton, selected && { backgroundColor: theme.colors.primary }]} onPress={() => setType(option)} accessibilityRole="button" accessibilityState={{ selected }}>
                  <Ionicons name={option === 'cash_in' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={18} color={selected ? theme.colors.onPrimary : theme.colors.text} />
                  <Text style={[styles.typeText, { color: selected ? theme.colors.onPrimary : theme.colors.text }]}>{option === 'cash_in' ? '+ ' : '− '}{label}</Text>
                </TouchableOpacity>;
              })}
            </View>
            <TouchableOpacity style={[styles.dateChip, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]} onPress={() => setDatePickerVisible((visible) => !visible)} accessibilityRole="button" accessibilityLabel={`Entry date ${selectedDateLabel}, change date`}>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} /><Text style={[styles.dateText, { color: theme.colors.text }]}>{selectedDateLabel}</Text><Ionicons name="chevron-down" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>
            {datePickerVisible && <View style={[styles.datePicker, { backgroundColor: theme.colors.surfaceVariant }]}>
              <TouchableOpacity style={styles.dateControl} onPress={() => shiftDate(-1)} accessibilityRole="button" accessibilityLabel="Previous day"><Ionicons name="chevron-back" size={22} color={theme.colors.text} /></TouchableOpacity>
              <View style={styles.dateCenter}><Text style={[styles.dateText, { color: theme.colors.text }]}>{dateLabel(entryDate)}</Text><TouchableOpacity style={styles.todayControl} onPress={() => setEntryDate(today())} accessibilityRole="button"><Text style={[styles.todayText, { color: theme.colors.text }]}>Today</Text></TouchableOpacity></View>
              <TouchableOpacity style={styles.dateControl} onPress={() => shiftDate(1)} accessibilityRole="button" accessibilityLabel="Next day"><Ionicons name="chevron-forward" size={22} color={theme.colors.text} /></TouchableOpacity>
            </View>}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
            <View style={styles.categoryGrid}>{categories.map((item) => <TouchableOpacity key={item.name} style={[styles.categoryChip, { borderColor: item.name === category ? theme.colors.primary : theme.colors.border, backgroundColor: item.name === category ? theme.colors.primary : theme.colors.surface }]} onPress={() => { setCategory(item.name); setError(null); }} accessibilityRole="button" accessibilityState={{ selected: item.name === category }} accessibilityLabel={`Category ${item.name}`}>
              <Ionicons name={item.icon} size={18} color={item.name === category ? theme.colors.onPrimary : theme.colors.textSecondary} />
              <Text style={[styles.categoryText, { color: item.name === category ? theme.colors.onPrimary : theme.colors.text }]}>{item.name}</Text>
            </TouchableOpacity>)}</View>
            <TouchableOpacity style={styles.noteToggle} onPress={() => setNoteVisible((shown) => !shown)} accessibilityRole="button" accessibilityState={{ expanded: noteVisible }}><Ionicons name={noteVisible ? 'remove-circle-outline' : 'add-circle-outline'} size={18} color={theme.colors.textSecondary} /><Text style={[styles.noteToggleText, { color: theme.colors.textSecondary }]}>{noteVisible ? 'Remove note' : 'Add a note (optional)'}</Text></TouchableOpacity>
            {noteVisible && <TextInput style={[inputStyle, styles.noteInput]} value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={theme.colors.textTertiary} multiline accessibilityLabel="Note (optional)" />}
            {!!error && <Text style={[styles.error, { color: theme.colors.error }]} accessibilityRole="alert">{error}</Text>}
            <View style={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9','.','0','backspace'].map((key) => <Pressable key={key} style={({ pressed }) => [styles.key, { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface }]} onPress={() => pressKey(key)} accessibilityRole="button" accessibilityLabel={key === 'backspace' ? 'Delete last amount digit' : key === '.' ? 'Decimal point' : `Digit ${key}`}>
                {key === 'backspace' ? <Ionicons name="backspace-outline" size={23} color={theme.colors.text} /> : <Text style={[styles.keyText, { color: theme.colors.text }]}>{key}</Text>}
              </Pressable>)}
            </View>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: saving ? 0.7 : 1 }]} onPress={() => void save()} disabled={saving} accessibilityRole="button" accessibilityLabel="Save transaction">
              {saving ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={[styles.saveText, { color: theme.colors.onPrimary }]}>{editingTransaction ? 'Save changes' : 'Save'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008' },
  sheet: { maxHeight: '94%', borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, paddingBottom: theme.spacing.lg },
  handleArea: { alignItems: 'center', paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs },
  handle: { width: 38, height: 4, borderRadius: 4 },
  header: { height: 56, paddingHorizontal: theme.spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: theme.typeSize.title, fontWeight: '700' },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl, gap: theme.spacing.sm },
  amountArea: { alignItems: 'center', paddingVertical: 12 },
  amountReadout: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountText: { fontSize: 48, lineHeight: 54, fontWeight: '800', letterSpacing: -1.5 },
  amountCurrency: { fontSize: theme.typeSize.caption, fontWeight: '700', letterSpacing: 0.6, alignSelf: 'flex-end', marginBottom: theme.spacing.md },
  amountHint: { fontSize: theme.typeSize.caption, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  typeToggle: { flexDirection: 'row', padding: theme.spacing.xs, borderRadius: theme.radius.md, gap: theme.spacing.xs },
  typeButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.sm },
  typeText: { fontWeight: '700', fontSize: theme.typeSize.small },
  label: { fontSize: theme.typeSize.caption, fontWeight: '600', marginTop: theme.spacing.xs },
  chips: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xxs },
  bookChip: { minHeight: 44, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  categoryChip: { minHeight: 44, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderRadius: theme.radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs },
  categoryText: { fontSize: theme.typeSize.caption, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, fontSize: theme.typeSize.body },
  noteInput: { minHeight: 64, textAlignVertical: 'top', paddingTop: theme.spacing.md },
  dateChip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, borderWidth: 1 },
  dateText: { flex: 1, fontSize: theme.typeSize.small, fontWeight: '600' },
  datePicker: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.xs },
  dateControl: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  dateCenter: { alignItems: 'center' },
  todayControl: { minHeight: 44, justifyContent: 'center' },
  todayText: { fontSize: theme.typeSize.caption, fontWeight: '700' },
  noteToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  noteToggleText: { fontSize: theme.typeSize.small, fontWeight: '600' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center', paddingTop: theme.spacing.xs },
  key: { width: '30%', minHeight: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: theme.typeSize.subtitle, fontWeight: '600' },
  error: { fontSize: theme.typeSize.small },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, marginTop: theme.spacing.xs },
  saveText: { fontSize: theme.typeSize.body, fontWeight: '700' },
});
