import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Expense } from '../types';

export const expenseService = {
  // Create a new expense
  async createExpense(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'expenses'), {
        ...expenseData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      throw new Error('Failed to create expense');
    }
  },

  // Get expenses for a specific group
  async getGroupExpenses(groupId: string): Promise<Expense[]> {
    try {
      console.log('Fetching expenses for group:', groupId);
      
      // Try with ordering first
      try {
        const q = query(
          collection(db, 'expenses'),
          where('groupId', '==', groupId),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        console.log('Found', querySnapshot.docs.length, 'expenses with ordering');
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Expense[];
      } catch (orderError: any) {
        console.log('Ordering failed, trying without orderBy:', orderError.message);
        
        // Fallback: query without ordering
        const q = query(
          collection(db, 'expenses'),
          where('groupId', '==', groupId)
        );
        const querySnapshot = await getDocs(q);
        console.log('Found', querySnapshot.docs.length, 'expenses without ordering');
        
        // Sort manually in JavaScript
        const expenses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Expense[];
        
        return expenses.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      }
    } catch (error: any) {
      console.error('Error in getGroupExpenses:', error);
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }
  },

  // Get expenses paid by a specific user
  async getUserExpenses(userId: string): Promise<Expense[]> {
    try {
      const q = query(
        collection(db, 'expenses'),
        where('paidBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Expense[];
    } catch (error) {
      throw new Error('Failed to fetch user expenses');
    }
  },

  // Get a specific expense by ID
  async getExpense(expenseId: string): Promise<Expense | null> {
    try {
      const docRef = doc(db, 'expenses', expenseId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Expense;
      }
      return null;
    } catch (error) {
      throw new Error('Failed to fetch expense');
    }
  },

  // Update expense
  async updateExpense(expenseId: string, updates: Partial<Expense>): Promise<void> {
    try {
      const docRef = doc(db, 'expenses', expenseId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw new Error('Failed to update expense');
    }
  },

  // Delete expense
  async deleteExpense(expenseId: string): Promise<void> {
    try {
      const docRef = doc(db, 'expenses', expenseId);
      await deleteDoc(docRef);
    } catch (error) {
      throw new Error('Failed to delete expense');
    }
  },

  // Get recent expenses across all user's groups
  async getRecentExpenses(userId: string, limit: number = 10): Promise<Expense[]> {
    try {
      console.log('Fetching recent expenses for user:', userId);
      
      // First get all groups where user is a member
      const { groupService } = await import('./groupService');
      const userGroups = await groupService.getUserGroups(userId);
      const groupIds = userGroups.map(group => group.id);

      console.log('User groups found:', groupIds.length);

      if (groupIds.length === 0) {
        console.log('No groups found, returning empty array');
        return [];
      }

      // If user has many groups, we need to handle this differently
      // Firestore 'in' operator is limited to 10 values
      if (groupIds.length > 10) {
        console.log('User has more than 10 groups, fetching expenses per group');
        // Fetch expenses from each group individually and combine
        const allExpenses: Expense[] = [];
        
        for (const groupId of groupIds) {
          try {
            const groupExpenses = await this.getGroupExpenses(groupId);
            allExpenses.push(...groupExpenses);
          } catch (error) {
            console.error(`Error fetching expenses for group ${groupId}:`, error);
            // Continue with other groups
          }
        }
        
        // Sort by creation date and return the most recent
        const sortedExpenses = allExpenses.sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        console.log(`Found ${sortedExpenses.length} total expenses, returning ${limit} most recent`);
        return sortedExpenses.slice(0, limit);
      }

      // For users with 10 or fewer groups, try the 'in' operator first
      console.log('Using "in" operator for groups:', groupIds);
      try {
        const q = query(
          collection(db, 'expenses'),
          where('groupId', 'in', groupIds),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const expenses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Expense[];

        console.log(`Found ${expenses.length} expenses, returning ${limit} most recent`);
        return expenses.slice(0, limit);
      } catch (orderError: any) {
        console.log('Ordering failed, trying without orderBy:', orderError.message);
        
        // Fallback: query without ordering
        const q = query(
          collection(db, 'expenses'),
          where('groupId', 'in', groupIds)
        );
        
        const querySnapshot = await getDocs(q);
        const expenses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Expense[];
        
        // Sort manually in JavaScript
        const sortedExpenses = expenses.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        console.log(`Found ${sortedExpenses.length} expenses without ordering, returning ${limit} most recent`);
        return sortedExpenses.slice(0, limit);
      }
    } catch (error: any) {
      console.error('Error in getRecentExpenses:', error);
      throw new Error(`Failed to fetch recent expenses: ${error.message}`);
    }
  },

  // Get expenses by category for a group
  async getExpensesByCategory(groupId: string): Promise<{ [category: string]: number }> {
    try {
      const expenses = await this.getGroupExpenses(groupId);
      const categoryTotals: { [category: string]: number } = {};

      expenses.forEach(expense => {
        if (categoryTotals[expense.category]) {
          categoryTotals[expense.category] += expense.amount;
        } else {
          categoryTotals[expense.category] = expense.amount;
        }
      });

      return categoryTotals;
    } catch (error) {
      throw new Error('Failed to fetch expenses by category');
    }
  },

  // Get total expenses for a group
  async getGroupTotalExpenses(groupId: string): Promise<number> {
    try {
      const expenses = await this.getGroupExpenses(groupId);
      return expenses.reduce((total, expense) => total + expense.amount, 0);
    } catch (error) {
      throw new Error('Failed to calculate total expenses');
    }
  },

  // Get expenses split between specific users
  async getExpensesSplitBetween(groupId: string, userIds: string[]): Promise<Expense[]> {
    try {
      const expenses = await this.getGroupExpenses(groupId);
      return expenses.filter(expense => 
        expense.splitBetween.some(userId => userIds.includes(userId))
      );
    } catch (error) {
      throw new Error('Failed to fetch split expenses');
    }
  },
}; 