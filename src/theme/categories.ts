import { Ionicons } from '@expo/vector-icons';

export const categoryOptions: Array<{ name: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { name: 'Food', icon: 'restaurant-outline' },
  { name: 'Rent', icon: 'home-outline' },
  { name: 'Bills', icon: 'receipt-outline' },
  { name: 'Transport', icon: 'bus-outline' },
  { name: 'Shopping', icon: 'cart-outline' },
  { name: 'Health', icon: 'medkit-outline' },
  { name: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export const categoryIcon = (category: string): keyof typeof Ionicons.glyphMap =>
  categoryOptions.find((option) => option.name.toLowerCase() === category.trim().toLowerCase())?.icon ?? 'pricetag-outline';
