export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BookMemberRole = 'owner' | 'member';
export type TransactionType = 'cash_in' | 'cash_out';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

/** Application model for public.books; timestamps are ISO-8601 strings. */
export interface Book {
  id: string;
  name: string;
  description: string | null;
  currencyCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Role held by the signed-in user when returned from listMyBooks. */
  memberRole?: BookMemberRole;
}

/** Application model for public.transactions and book_transaction_page rows. */
export interface Transaction {
  id: string;
  bookId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Business date from the database's entry_date column (YYYY-MM-DD). */
  entryDate: string;
  /** Supplied by book_transaction_page, calculated across all active rows. */
  /** null for a newly inserted row until book_transaction_page returns it. */
  runningBalance: number | null;
}

export interface Invitation {
  id: string;
  bookId: string;
  invitedEmail: string;
  invitedBy: string;
  status: InvitationStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface PendingInvitation {
  id: string;
  bookName: string;
  inviterDisplayName: string;
  expiresAt: string;
}

export interface Member {
  bookId: string;
  userId: string;
  displayName: string;
  role: BookMemberRole;
  joinedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
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

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Primary colors
  primary: string;
  primaryVariant: string;
  onPrimary: string;
  
  // Secondary colors
  secondary: string;
  secondaryVariant: string;
  onSecondary: string;
  
  // Error colors
  error: string;
  onError: string;
  
  // Success colors
  success: string;
  onSuccess: string;
  
  // Warning colors
  warning: string;
  onWarning: string;
  
  // Border colors
  border: string;
  borderLight: string;
  
  // Shadow colors
  shadow: string;
  
  // Status bar
  statusBar: 'light' | 'dark';
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  spacing: Record<'none' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'huge', number>;
  radius: Record<'sm' | 'md' | 'lg' | 'xl' | 'pill', number>;
  typeSize: Record<'caption' | 'small' | 'body' | 'subtitle' | 'title' | 'display' | 'amount', number>;
}

export interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}
