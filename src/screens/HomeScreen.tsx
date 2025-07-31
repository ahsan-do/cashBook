import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTheme } from '../contexts/ThemeContext';
import { Group, Expense } from '../types';
import { groupService } from '../services/groupService';
import { expenseService } from '../services/expenseService';

interface HomeScreenProps {
  navigation: any;
}

const CLEARED_EXPENSES_KEY = 'cleared_expenses';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { theme } = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [clearingExpenses, setClearingExpenses] = useState(false);

  // Get cleared expense IDs from AsyncStorage
  const getClearedExpenseIds = async (): Promise<string[]> => {
    try {
      const clearedExpenses = await AsyncStorage.getItem(CLEARED_EXPENSES_KEY);
      return clearedExpenses ? JSON.parse(clearedExpenses) : [];
    } catch (error) {
      console.error('Error getting cleared expenses:', error);
      return [];
    }
  };

  // Save cleared expense IDs to AsyncStorage
  const saveClearedExpenseIds = async (expenseIds: string[]): Promise<void> => {
    try {
      // Limit the number of cleared expense IDs to prevent unlimited growth
      // Keep only the last 1000 cleared expense IDs
      const limitedExpenseIds = expenseIds.slice(-1000);
      await AsyncStorage.setItem(CLEARED_EXPENSES_KEY, JSON.stringify(limitedExpenseIds));
    } catch (error) {
      console.error('Error saving cleared expenses:', error);
    }
  };

  // Clear all stored cleared expense IDs (for reset functionality)
  const clearStoredClearedExpenses = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CLEARED_EXPENSES_KEY);
    } catch (error) {
      console.error('Error clearing stored cleared expenses:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const userGroups = await groupService.getUserGroups(user!.id);
      setGroups(userGroups);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchRecentExpenses = async () => {
    try {
      if (user?.id) {
        console.log('HomeScreen: Fetching recent expenses for user:', user.id);
        const expenses = await expenseService.getRecentExpenses(user.id, 10); // Fetch more to filter
        
        // Get cleared expense IDs
        const clearedExpenseIds = await getClearedExpenseIds();
        console.log('HomeScreen: Cleared expense IDs:', clearedExpenseIds);
        
        // Filter out cleared expenses and cash in entries (negative amounts)
        const filteredExpenses = expenses.filter(expense => 
          expense.amount > 0 && !clearedExpenseIds.includes(expense.id)
        );
        
        console.log('HomeScreen: Filtered expenses:', filteredExpenses.length);
        
        setRecentExpenses(filteredExpenses.slice(0, 5)); // Show only 5 most recent cash out expenses
      }
    } catch (error: any) {
      console.error('HomeScreen: Error fetching recent expenses:', error);
      // Don't show alert for this error as it's not critical
      // Just log it and continue with empty expenses
      setRecentExpenses([]);
    }
  };

  const fetchInvitationCount = async () => {
    if (!user?.email) return;
    try {
      setLoadingInvitations(true);
      const invitations = await groupService.getPendingInvitations(user.email);
      setInvitationCount(invitations.length);
    } catch (error: any) {
      console.error('Error fetching invitation count:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const clearAllExpenses = async () => {
    Alert.alert(
      'Clear All Expenses',
      'Are you sure you want to clear all recent expenses? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearingExpenses(true);
            try {
              // Get current cleared expense IDs
              const currentClearedIds = await getClearedExpenseIds();
              
              // Add current expense IDs to cleared list
              const expenseIdsToClear = recentExpenses.map(expense => expense.id);
              const updatedClearedIds = [...currentClearedIds, ...expenseIdsToClear];
              
              // Save updated cleared expense IDs
              await saveClearedExpenseIds(updatedClearedIds);
              
              // Clear the recent expenses from state
              setRecentExpenses([]);
              Alert.alert('Success', 'Recent expenses cleared successfully!');
            } catch (error: any) {
              console.error('Error clearing expenses:', error);
              Alert.alert('Error', 'Failed to clear expenses');
            } finally {
              setClearingExpenses(false);
            }
          },
        },
      ]
    );
  };

  // Clear a single expense
  const clearSingleExpense = async (expenseId: string) => {
    try {
      // Get current cleared expense IDs
      const currentClearedIds = await getClearedExpenseIds();
      
      // Add the expense ID to cleared list if not already there
      if (!currentClearedIds.includes(expenseId)) {
        const updatedClearedIds = [...currentClearedIds, expenseId];
        await saveClearedExpenseIds(updatedClearedIds);
      }
      
      // Remove from current state
      setRecentExpenses(prev => prev.filter(expense => expense.id !== expenseId));
    } catch (error: any) {
      console.error('Error clearing single expense:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchGroups(), fetchRecentExpenses(), fetchInvitationCount()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchGroups(), fetchRecentExpenses(), fetchInvitationCount()]);
      setLoading(false);
    };
    initializeData();
  }, [user?.id, user?.email]);

  const renderGroupCard = (group: Group) => (
    <TouchableOpacity
      key={group.id}
      style={[
        styles.groupCard,
        {
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
      onPress={() => navigation.navigate('GroupDetails', { group })}
    >
      <View style={styles.groupInfo}>
        <Text style={[styles.groupName, { color: theme.colors.text }]}>{group.name}</Text>
        <Text style={[styles.memberCount, { color: theme.colors.textSecondary }]}>{group.members.length} members</Text>
        {group.description && (
          <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>{group.description}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Hello, {user?.displayName}!</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Here's your cashbook overview</Text>
          </View>
          {!loadingInvitations && invitationCount > 0 && (
            <TouchableOpacity
              style={styles.invitationButton}
              onPress={() => navigation.navigate('Invitations')}
            >
              <Ionicons name="mail" size={24} color={theme.colors.primary} />
              <View style={[styles.invitationBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={[styles.invitationCount, { color: theme.colors.onError }]}>{invitationCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Groups</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Groups')}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading your groups...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No groups yet</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textTertiary }]}>
                Create a group to start tracking expenses
              </Text>
              <TouchableOpacity
                style={[styles.createGroupButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={[styles.createGroupButtonText, { color: theme.colors.onPrimary }]}>Create Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {groups.slice(0, 3).map(renderGroupCard)}
            </ScrollView>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              onLongPress={async () => {
                Alert.alert(
                  'Reset Cleared Expenses',
                  'This will show all expenses again, including previously cleared ones. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Reset', 
                      style: 'destructive',
                      onPress: async () => {
                        await clearStoredClearedExpenses();
                        await fetchRecentExpenses();
                        Alert.alert('Success', 'Cleared expenses have been reset!');
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
            </TouchableOpacity>
            <View style={styles.sectionActions}>
              {recentExpenses.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearButton, { backgroundColor: theme.colors.error }]}
                  onPress={clearAllExpenses}
                  disabled={clearingExpenses}
                >
                  <Text style={[
                    styles.clearButtonText,
                    { color: theme.colors.onError },
                    clearingExpenses && styles.clearButtonTextDisabled
                  ]}>
                    {clearingExpenses ? 'Clearing...' : 'Clear All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {recentExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No expenses yet</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textTertiary }]}>
                Add expenses to your groups to see them here
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.hintText, { color: theme.colors.textTertiary }]}>💡 Long press an expense to remove it</Text>
            <View>
              {recentExpenses.map((expense) => (
                <TouchableOpacity
                  key={expense.id}
                  style={[
                    styles.expenseItem,
                    { borderBottomColor: theme.colors.borderLight }
                  ]}
                  onLongPress={() => {
                    Alert.alert(
                      'Clear Expense',
                      `Remove "${expense.title}" from recent expenses?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Clear', 
                          style: 'destructive',
                          onPress: () => clearSingleExpense(expense.id)
                        }
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>{expense.title}</Text>
                    <Text style={[styles.expenseCategory, { color: theme.colors.textSecondary }]}>{expense.category}</Text>
                  </View>
                  <Text style={[styles.expenseAmount, { color: theme.colors.error }]}>
                    {formatAmount(expense.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  invitationButton: {
    position: 'relative',
  },
  invitationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  invitationCount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    margin: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllText: {
    fontWeight: '500',
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
    marginBottom: 16,
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    fontWeight: '600',
  },
  groupCard: {
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 140,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
  },
  groupDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseCategory: {
    fontSize: 14,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  createGroupButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createGroupButtonText: {
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  clearButtonText: {
    fontWeight: '600',
  },
  clearButtonTextDisabled: {
    opacity: 0.5,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
}); 