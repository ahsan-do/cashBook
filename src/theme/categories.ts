import type { TransactionType } from '../types';

type IoniconName = keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
export interface EntryCategory {
  name: string;
  icon: IoniconName;
  accessibilityLabel: string;
}

const category = (name: string, icon: IoniconName): EntryCategory => ({
  name,
  icon,
  accessibilityLabel: `${name} category`,
});

export const categoriesByType: Record<TransactionType, EntryCategory[]> = {
  cash_out: [
    category('Food', 'restaurant-outline'),
    category('Rent', 'home-outline'),
    category('Bills', 'receipt-outline'),
    category('Transport', 'bus-outline'),
    category('Shopping', 'cart-outline'),
    category('Health', 'medkit-outline'),
    category('Other', 'ellipsis-horizontal-circle-outline'),
  ],
  cash_in: [
    category('Salary', 'wallet-outline'),
    category('Business', 'briefcase-outline'),
    category('Rent received', 'home-outline'),
    category('Allowance', 'hand-left-outline'),
    category('Gift', 'gift-outline'),
    category('Refund', 'return-down-back-outline'),
    category('Contribution', 'people-outline'),
    category('Other', 'ellipsis-horizontal-circle-outline'),
  ],
};

export const categoryIcon = (name: string, type: TransactionType): IoniconName =>
  categoriesByType[type].find((item) => item.name.toLowerCase() === name.trim().toLowerCase())?.icon ?? 'pricetag-outline';

export const entryCategory = (name: string, type: TransactionType): EntryCategory =>
  categoriesByType[type].find((item) => item.name.toLowerCase() === name.trim().toLowerCase())
    ?? category(name, 'pricetag-outline');
