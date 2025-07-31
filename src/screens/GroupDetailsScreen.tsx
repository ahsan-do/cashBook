import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTheme } from '../contexts/ThemeContext';
import { Group, Expense } from '../types';
import { groupService } from '../services/groupService';
import { expenseService } from '../services/expenseService';
import { getUserDisplayNames } from '../services/groupService';

interface GroupDetailsScreenProps {
  navigation: any;
  route: any;
}

export const GroupDetailsScreen: React.FC<GroupDetailsScreenProps> = ({ navigation, route }) => {
  const { group } = route.params;
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { theme } = useTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showCashIn, setShowCashIn] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // New expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('General');
  const [expenseDescription, setExpenseDescription] = useState('');

  // Cash in form state
  const [cashInTitle, setCashInTitle] = useState('');
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInDescription, setCashInDescription] = useState('');

  // Edit/Delete state
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseCategory, setEditExpenseCategory] = useState('General');
  const [editExpenseDescription, setEditExpenseDescription] = useState('');

  // Group edit/delete state
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState(group.name);
  const [editGroupDescription, setEditGroupDescription] = useState(group.description || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Swipe gesture state
  const [swipeAnimations, setSwipeAnimations] = useState<{ [key: string]: Animated.Value }>({});

  const categories = [
    'General', 'Food', 'Transport', 'Entertainment', 'Shopping', 
    'Bills', 'Healthcare', 'Education', 'Other'
  ];

  useEffect(() => {
    fetchExpenses();
  }, [group.id]);



  const fetchExpenses = async () => {
    try {
      console.log('Starting to fetch expenses for group:', group.id);
      const groupExpenses = await expenseService.getGroupExpenses(group.id);
      console.log('Successfully fetched', groupExpenses.length, 'expenses');
      
      setExpenses(groupExpenses);
      
      // Calculate totals
      const cashInTotal = groupExpenses
        .filter(expense => expense.amount < 0)
        .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
      
      const cashOutTotal = groupExpenses
        .filter(expense => expense.amount > 0)
        .reduce((sum, expense) => sum + expense.amount, 0);
      
      const net = cashInTotal - cashOutTotal;
      
      setTotalCashIn(cashInTotal);
      setTotalCashOut(cashOutTotal);
      setNetBalance(net);
      setTotalExpenses(groupExpenses.length); // Keep this for compatibility
      
      // Fetch user names for all paidBy IDs
      if (groupExpenses.length > 0) {
        const ids = groupExpenses.map(e => e.paidBy);
        const names = await getUserDisplayNames(ids);
        setUserNames(names);
      }
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to load expenses: ${error.message}`,
      });
    }
  };

  const handleAddExpense = async () => {
    if (!expenseTitle || !expenseAmount) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in title and amount',
      });
      return;
    }

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid amount',
      });
      return;
    }

    setLoading(true);
    try {
      await expenseService.createExpense({
        groupId: group.id,
        title: expenseTitle,
        amount,
        category: expenseCategory,
        description: expenseDescription,
        paidBy: user!.id,
        splitBetween: group.members, // Split between all members
      });

      // Show success message immediately
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Expense added successfully!',
      });

      // Reset form
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseCategory('General');
      setExpenseDescription('');
      setShowAddExpense(false);

      // Refresh expenses
      await fetchExpenses();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to add expense: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCashIn = async () => {
    if (!cashInTitle || !cashInAmount) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in title and amount',
      });
      return;
    }

    const amount = parseFloat(cashInAmount);
    if (isNaN(amount) || amount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid amount',
      });
      return;
    }

    setLoading(true);
    try {
      await expenseService.createExpense({
        groupId: group.id,
        title: cashInTitle,
        amount: -amount, // Negative amount for cash in
        category: 'Cash In',
        description: cashInDescription,
        paidBy: user!.id,
        splitBetween: group.members, // Split between all members
      });

      // Show success message immediately
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Cash in added successfully!',
      });

      // Reset form
      setCashInTitle('');
      setCashInAmount('');
      setCashInDescription('');
      setShowCashIn(false);

      // Refresh expenses
      await fetchExpenses();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to add cash in: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter an email address',
      });
      return;
    }

    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'User not authenticated',
      });
      return;
    }

    try {
      setLoading(true);
      await groupService.createInvitation({
        groupId: group.id,
        invitedBy: user.id,
        invitedEmail: newMemberEmail,
      });
      setNewMemberEmail('');
      setShowAddMember(false);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Invitation sent successfully!',
      });
    } catch (error: any) {
      console.error('Error adding member:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to send invitation: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditExpenseTitle(expense.title);
    setEditExpenseAmount(Math.abs(expense.amount).toString());
    setEditExpenseCategory(expense.category || 'General');
    setEditExpenseDescription(expense.description || '');
    setShowEditExpense(true);
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !editExpenseTitle || !editExpenseAmount) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in title and amount',
      });
      return;
    }

    try {
      setLoading(true);
      const amount = parseFloat(editExpenseAmount);
      if (isNaN(amount) || amount <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please enter a valid amount',
        });
        return;
      }

      // Preserve the original sign (cash in vs cash out)
      const finalAmount = editingExpense.amount < 0 ? -amount : amount;

      await expenseService.updateExpense(editingExpense.id, {
        title: editExpenseTitle,
        amount: finalAmount,
        category: editExpenseCategory,
        description: editExpenseDescription,
      });

      setShowEditExpense(false);
      setEditingExpense(null);
      await fetchExpenses(); // Refresh the expenses
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Expense updated successfully!',
      });
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to update expense: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await expenseService.deleteExpense(expense.id);
              await fetchExpenses(); // Refresh the expenses
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Expense deleted successfully!',
              });
            } catch (error: any) {
              console.error('Error deleting expense:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Failed to delete expense: ${error.message}`,
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Group management functions
  const handleEditGroup = async () => {
    if (!editGroupName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Group name is required',
      });
      return;
    }

    try {
      setLoading(true);
      await groupService.updateGroup(group.id, {
        name: editGroupName.trim(),
        description: editGroupDescription.trim() || undefined,
      });
      
      // Update the group in route params
      route.params.group.name = editGroupName.trim();
      route.params.group.description = editGroupDescription.trim() || undefined;
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Group updated successfully',
      });
      setShowEditGroup(false);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      setLoading(true);
      await groupService.deleteGroup(group.id);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Group deleted successfully',
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const isGroupOwner = user?.id === group.createdBy;

  const getOrCreateAnimation = (expenseId: string) => {
    if (!swipeAnimations[expenseId]) {
      const newAnimation = new Animated.Value(0);
      setSwipeAnimations(prev => ({ ...prev, [expenseId]: newAnimation }));
      return newAnimation;
    }
    return swipeAnimations[expenseId];
  };

  const onGestureEvent = (expenseId: string) => {
    const translateX = getOrCreateAnimation(expenseId);
    
    return Animated.event(
      [{ nativeEvent: { translationX: translateX } }],
      { useNativeDriver: true }
    );
  };

  const onHandlerStateChange = (expenseId: string, expense: Expense) => {
    const translateX = getOrCreateAnimation(expenseId);
    
    return (event: any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
        const { translationX } = event.nativeEvent;
        
        // Swipe left (negative translation) - Edit
        if (translationX < -50) {
          handleEditExpense(expense);
        }
        // Swipe right (positive translation) - Delete
        else if (translationX > 50) {
          handleDeleteExpense(expense);
        }
        
        // Reset animation
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    };
  };

  const renderExpenseCards = () => {
    // First, sort by time (oldest to newest) to calculate running balance correctly
    const chronologicalExpenses = [...expenses].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Calculate running balance for each expense
    let runningBalance = 0;
    const expensesWithBalance = chronologicalExpenses.map(expense => {
      runningBalance += expense.amount;
      return { ...expense, runningBalance };
    });
    
    // Now sort by time (newest to oldest) for display
    const sortedForDisplay = expensesWithBalance.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return sortedForDisplay.map((expense) => {
      const isCashIn = expense.amount < 0;
      const displayAmount = Math.abs(expense.amount);
      const userName = userNames[expense.paidBy] || expense.paidBy;
      return (
        <PanGestureHandler
          key={expense.id}
          onGestureEvent={onGestureEvent(expense.id)}
          onHandlerStateChange={onHandlerStateChange(expense.id, expense)}
        >
          <Animated.View
            style={[
              styles.expenseItem,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderLight,
              },
              {
                transform: [{
                  translateX: getOrCreateAnimation(expense.id)
                }]
              }
            ]}
          >
            {/* Top row: Date and Time */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                {expense.createdAt.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </Text>
              <Text style={[styles.expenseTime, { color: theme.colors.textSecondary }]}>
                {expense.createdAt.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </Text>
            </View>
            
            {/* Second row: Title and Amount */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>{expense.title}</Text>
              <Text style={[
                styles.expenseAmount, 
                { color: isCashIn ? theme.colors.success : theme.colors.error }
              ]}>
                {isCashIn ? '+' : '-'}{formatAmount(displayAmount)}
              </Text>
            </View>
            
            {/* Third row: User */}
            <Text style={[styles.expenseMeta, { color: theme.colors.textSecondary }]}>
              Entered by {userName}
            </Text>
            
            {/* Description if exists */}
            {expense.description ? (
              <Text style={[styles.expenseDescription, { color: theme.colors.textSecondary }]}>{expense.description}</Text>
            ) : null}
            
            {/* Balance at bottom */}
            <Text style={[styles.expenseBalance, { color: theme.colors.textTertiary }]}>Balance after: {formatAmount(expense.runningBalance)}</Text>
          </Animated.View>
        </PanGestureHandler>
      );
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{group.name}</Text>
        {isGroupOwner && (
          <TouchableOpacity 
            onPress={() => setShowEditGroup(true)}
            style={styles.headerMenuButton}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        {!isGroupOwner && <View style={{ width: 24 }} />}
      </View>

      <ScrollView style={styles.content}>
        {/* Group Info */}
        <View style={[styles.groupInfo, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.groupName, { color: theme.colors.text }]}>{group.name}</Text>
          {group.description && (
            <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>{group.description}</Text>
          )}
          <Text style={[styles.memberCount, { color: theme.colors.textSecondary }]}>{group.members.length} members</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>Net Balance</Text>
              <Text style={[styles.summaryAmount, { color: netBalance >= 0 ? theme.colors.success : theme.colors.error }]}>
                {formatAmount(netBalance)}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>Total In (+)</Text>
              <Text style={[styles.summaryAmount, { color: theme.colors.success }]}>
                {formatAmount(totalCashIn)}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>Total Out (-)</Text>
              <Text style={[styles.summaryAmount, { color: theme.colors.error }]}>
                {formatAmount(totalCashOut)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowCashIn(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={theme.colors.success} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Cash In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowAddExpense(true)}
          >
            <Ionicons name="remove-circle-outline" size={24} color={theme.colors.error} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Cash Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowAddMember(true)}
          >
            <Ionicons name="person-add-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Add Member</Text>
          </TouchableOpacity>
          
        </View>

        {/* Expenses List */}
        <View style={styles.expensesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading expenses...</Text>
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No expenses yet</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
                Add your first expense to get started
              </Text>
            </View>
          ) : (
            renderExpenseCards()
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal
        visible={showAddExpense}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddExpense(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Expense</Text>
              <TouchableOpacity onPress={() => setShowAddExpense(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Title *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="What was this expense for?"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Amount *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
                <View style={[styles.categoryContainer, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        expenseCategory === category && { backgroundColor: theme.colors.primary }
                      ]}
                      onPress={() => setExpenseCategory(category)}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        { color: expenseCategory === category ? theme.colors.onPrimary : theme.colors.text }
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Description (Optional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Add any additional details..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={expenseDescription}
                  onChangeText={setExpenseDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: loading ? 0.6 : 1,
                  },
                ]}
                onPress={handleAddExpense}
                disabled={loading}
              >
                <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>
                  {loading ? 'Adding...' : 'Add Expense'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cash In Modal */}
      <Modal
        visible={showCashIn}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCashIn(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Cash In</Text>
              <TouchableOpacity onPress={() => setShowCashIn(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Title *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="What is this cash in for?"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={cashInTitle}
                  onChangeText={setCashInTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Amount *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={cashInAmount}
                  onChangeText={setCashInAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Description (Optional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Add any additional details..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={cashInDescription}
                  onChangeText={setCashInDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: loading ? 0.6 : 1,
                  },
                ]}
                onPress={handleCashIn}
                disabled={loading}
              >
                <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>
                  {loading ? 'Adding...' : 'Add Cash In'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddMember(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Invite Member</Text>
              <TouchableOpacity onPress={() => setShowAddMember(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Email Address *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Enter email address"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: loading ? 0.6 : 1,
                  },
                ]}
                onPress={handleAddMember}
                disabled={loading}
              >
                <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>
                  {loading ? 'Sending...' : 'Send Invitation'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal
        visible={showEditExpense}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditExpense(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setShowEditExpense(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Title *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="What was this expense for?"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={editExpenseTitle}
                  onChangeText={setEditExpenseTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Amount *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={editExpenseAmount}
                  onChangeText={setEditExpenseAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
                                  <View style={[styles.categoryContainer, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryButton,
                          editExpenseCategory === category && { backgroundColor: theme.colors.primary }
                        ]}
                        onPress={() => setEditExpenseCategory(category)}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          { color: editExpenseCategory === category ? theme.colors.onPrimary : theme.colors.text }
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add any additional details..."
                  value={editExpenseDescription}
                  onChangeText={setEditExpenseDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

                                <TouchableOpacity
                    style={[
                      styles.submitButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: loading ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleUpdateExpense}
                    disabled={loading}
                  >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Updating...' : 'Update Expense'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
              </Modal>

        {/* Edit Group Modal */}
        <Modal
          visible={showEditGroup}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowEditGroup(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Group</Text>
                <TouchableOpacity onPress={() => setShowEditGroup(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>Group Name *</Text>
                  <TextInput
                    style={[
                      styles.input,
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
                  <Text style={[styles.label, { color: theme.colors.text }]}>Description (Optional)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
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

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: loading ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleEditGroup}
                  disabled={loading}
                >
                  <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>
                    {loading ? 'Updating...' : 'Update Group'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: theme.colors.error, marginTop: 12 }]}
                  onPress={() => setShowDeleteConfirm(true)}
                >
                  <Text style={styles.submitButtonText}>Delete Group</Text>
                </TouchableOpacity>
              </ScrollView>
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
                <TouchableOpacity onPress={() => setShowDeleteConfirm(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.deleteMessage, { color: theme.colors.textSecondary }]}>
                Are you sure you want to delete "{group.name}"? This action cannot be undone and will delete all expenses in this group.
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
                  onPress={handleDeleteGroup}
                >
                  <Text style={[styles.deleteButtonText, { color: theme.colors.onError }]}>Delete</Text>
                </TouchableOpacity>
              </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  groupInfo: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 16,
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  expensesSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  expenseItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseCategory: {
    fontSize: 14,
    marginTop: 2,
  },
  expenseDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expenseDate: {
    fontSize: 12,
    marginTop: 0,
  },
  expenseTime: {
    fontSize: 12,
    marginTop: 0,
  },
  expenseMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  expenseBalance: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
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
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryButtonText: {
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  submitButtonText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
}); 