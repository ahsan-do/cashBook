export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  category: string;
  description?: string;
  paidBy: string;
  splitBetween: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  invitedBy: string;
  invitedEmail: string;
  status?: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

export type Currency = 'PKR' | 'USD' | 'EUR';

export interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
  exchangeRate: number; // Rate relative to USD
}

export interface CurrencyContextType {
  selectedCurrency: Currency;
  currencies: CurrencyInfo[];
  setCurrency: (currency: Currency) => void;
  formatAmount: (amount: number) => string;
  convertAmount: (amount: number, fromCurrency: Currency, toCurrency: Currency) => number;
} 