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
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Group, Expense } from '../types';
import { groupService } from '../services/groupService';
import { expenseService } from '../services/expenseService';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [clearingExpenses, setClearingExpenses] = useState(false);

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
        console.log('HomeScreen: Fetched expenses:', expenses.length);
        
        // Filter out cash in entries (negative amounts) - only show cash out entries
        const cashOutExpenses = expenses.filter(expense => expense.amount > 0);
        console.log('HomeScreen: Cash out expenses after filtering:', cashOutExpenses.length);
        
        setRecentExpenses(cashOutExpenses.slice(0, 5)); // Show only 5 most recent cash out expenses
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
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetails', { group })}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.memberCount}>{group.members.length} members</Text>
        {group.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.displayName}!</Text>
            <Text style={styles.subtitle}>Here's your cashbook overview</Text>
          </View>
          {!loadingInvitations && invitationCount > 0 && (
            <TouchableOpacity
              style={styles.invitationButton}
              onPress={() => navigation.navigate('Invitations')}
            >
              <Ionicons name="mail" size={24} color="#2563eb" />
              <View style={styles.invitationBadge}>
                <Text style={styles.invitationCount}>{invitationCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Groups')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading your groups...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No groups yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Create a group to start tracking expenses
              </Text>
              <TouchableOpacity
                style={styles.createGroupButton}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={styles.createGroupButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {groups.slice(0, 3).map(renderGroupCard)}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            <View style={styles.sectionActions}>
              {recentExpenses.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearAllExpenses}
                  disabled={clearingExpenses}
                >
                  <Text style={[styles.clearButtonText, clearingExpenses && styles.clearButtonTextDisabled]}>
                    {clearingExpenses ? 'Clearing...' : 'Clear All'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {recentExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add expenses to your groups to see them here
              </Text>
            </View>
          ) : (
            <View>
              {recentExpenses.map((expense) => (
                <View key={expense.id} style={styles.expenseItem}>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseTitle}>{expense.title}</Text>
                    <Text style={styles.expenseCategory}>{expense.category}</Text>
                  </View>
                  <Text style={styles.expenseAmount}>
                    {formatAmount(expense.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  invitationButton: {
    position: 'relative',
  },
  invitationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  invitationCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    margin: 20,
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
  },
  seeAllText: {
    color: '#2563eb',
    fontWeight: '500',
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
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  groupCard: {
    backgroundColor: '#f8fafc',
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
    color: '#1f2937',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  groupDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  createGroupButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createGroupButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  clearButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  clearButtonTextDisabled: {
    color: '#d1d5db',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}); 