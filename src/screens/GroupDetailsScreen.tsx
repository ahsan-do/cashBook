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
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
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
        console.log('Fetching user names for IDs:', ids);
        const names = await getUserDisplayNames(ids);
        setUserNames(names);
      }
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      Alert.alert('Error', `Failed to load expenses: ${error.message}`);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseTitle || !expenseAmount) {
      Alert.alert('Error', 'Please fill in title and amount');
      return;
    }

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
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

      // Reset form
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseCategory('General');
      setExpenseDescription('');
      setShowAddExpense(false);

      // Refresh expenses
      await fetchExpenses();

      Alert.alert('Success', 'Expense added successfully!');
    } catch (error: any) {
      Alert.alert('Error', `Failed to add expense: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCashIn = async () => {
    if (!cashInTitle || !cashInAmount) {
      Alert.alert('Error', 'Please fill in title and amount');
      return;
    }

    const amount = parseFloat(cashInAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
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

      // Reset form
      setCashInTitle('');
      setCashInAmount('');
      setCashInDescription('');
      setShowCashIn(false);

      // Refresh expenses
      await fetchExpenses();

      Alert.alert('Success', 'Cash in added successfully!');
    } catch (error: any) {
      Alert.alert('Error', `Failed to add cash in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
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
      Alert.alert('Success', 'Invitation sent successfully!');
    } catch (error: any) {
      console.error('Error adding member:', error);
      Alert.alert('Error', `Failed to send invitation: ${error.message}`);
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
      Alert.alert('Error', 'Please fill in title and amount');
      return;
    }

    try {
      setLoading(true);
      const amount = parseFloat(editExpenseAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
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
      Alert.alert('Success', 'Expense updated successfully!');
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', `Failed to update expense: ${error.message}`);
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
              Alert.alert('Success', 'Expense deleted successfully!');
            } catch (error: any) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', `Failed to delete expense: ${error.message}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

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
              isCashIn ? styles.cashInCard : styles.cashOutCard,
              {
                transform: [{
                  translateX: getOrCreateAnimation(expense.id)
                }]
              }
            ]}
          >
            {/* Top row: Date and Time */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.expenseDate}>
                {expense.createdAt.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </Text>
              <Text style={styles.expenseTime}>
                {expense.createdAt.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </Text>
            </View>
            
            {/* Second row: Title and Amount */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.expenseTitle}>{expense.title}</Text>
              <Text style={[styles.expenseAmount, isCashIn ? styles.cashInAmount : styles.cashOutAmount]}>
                {isCashIn ? '+' : '-'}{formatAmount(displayAmount)}
              </Text>
            </View>
            
            {/* Third row: User */}
            <Text style={styles.expenseMeta}>
              Entered by {userName}
            </Text>
            
            {/* Description if exists */}
            {expense.description ? (
              <Text style={styles.expenseDescription}>{expense.description}</Text>
            ) : null}
            
            {/* Balance at bottom */}
            <Text style={styles.expenseBalance}>Balance after: {formatAmount(expense.runningBalance)}</Text>
          </Animated.View>
        </PanGestureHandler>
      );
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Group Info */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description && (
            <Text style={styles.groupDescription}>{group.description}</Text>
          )}
          <Text style={styles.memberCount}>{group.members.length} members</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.summaryLabel}>Net Balance</Text>
              <Text style={[styles.summaryAmount, { color: netBalance >= 0 ? '#059669' : '#dc2626' }]}>
                {formatAmount(netBalance)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.summaryLabel}>Total In (+)</Text>
              <Text style={[styles.summaryAmount, { color: '#059669' }]}>
                {formatAmount(totalCashIn)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.summaryLabel}>Total Out (-)</Text>
              <Text style={[styles.summaryAmount, { color: '#dc2626' }]}>
                {formatAmount(totalCashOut)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cashInButton]}
            onPress={() => setShowCashIn(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#059669" />
            <Text style={styles.actionButtonText}>Cash In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cashOutButton]}
            onPress={() => setShowAddExpense(true)}
          >
            <Ionicons name="remove-circle-outline" size={24} color="#dc2626" />
            <Text style={styles.actionButtonText}>Cash Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.addMemberButton]}
            onPress={() => setShowAddMember(true)}
          >
            <Ionicons name="person-add-outline" size={24} color="#2563eb" />
            <Text style={styles.actionButtonText}>Add Member</Text>
          </TouchableOpacity>
          
        </View>

        {/* Expenses List */}
        <View style={styles.expensesSection}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading expenses...</Text>
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setShowAddExpense(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="What was this expense for?"
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryContainer}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        expenseCategory === category && styles.categoryChipSelected,
                      ]}
                      onPress={() => setExpenseCategory(category)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          expenseCategory === category && styles.categoryChipTextSelected,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add any additional details..."
                  value={expenseDescription}
                  onChangeText={setExpenseDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleAddExpense}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cash In</Text>
              <TouchableOpacity onPress={() => setShowCashIn(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="What is this cash in for?"
                  value={cashInTitle}
                  onChangeText={setCashInTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={cashInAmount}
                  onChangeText={setCashInAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add any additional details..."
                  value={cashInDescription}
                  onChangeText={setCashInDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleCashIn}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Member</Text>
              <TouchableOpacity onPress={() => setShowAddMember(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleAddMember}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setShowEditExpense(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter expense title"
                  value={editExpenseTitle}
                  onChangeText={setEditExpenseTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter amount"
                  value={editExpenseAmount}
                  onChangeText={setEditExpenseAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryContainer}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        editExpenseCategory === category && styles.categoryChipSelected,
                      ]}
                      onPress={() => setEditExpenseCategory(category)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          editExpenseCategory === category && styles.categoryChipTextSelected,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
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
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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
  groupInfo: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
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
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
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
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cashInButton: {
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  cashOutButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  addMemberButton: {
    borderWidth: 1,
    borderColor: '#dbeafe',
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
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  expenseItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cashInCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#059669',
  },
  cashOutCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#dc2626',
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  expenseDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cashInAmount: {
    color: '#059669',
  },
  cashOutAmount: {
    color: '#dc2626',
  },
  expenseDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 0,
  },
  expenseTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 0,
  },
  expenseMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  expenseBalance: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#374151',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#6b7280',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
}); 