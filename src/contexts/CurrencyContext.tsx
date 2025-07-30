import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Currency, CurrencyInfo, CurrencyContextType } from '../types';

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Currency data with exchange rates (relative to USD)
const currencies: CurrencyInfo[] = [
  {
    code: 'PKR',
    symbol: '₨',
    name: 'Pakistani Rupee',
    exchangeRate: 0.0036, // 1 USD = ~278 PKR (approximate)
  },
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    exchangeRate: 1.0,
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    exchangeRate: 1.09, // 1 USD = ~0.92 EUR (approximate)
  },
];

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('PKR');

  const setCurrency = (currency: Currency) => {
    setSelectedCurrency(currency);
  };

  const formatAmount = (amount: number): string => {
    const currency = currencies.find(c => c.code === selectedCurrency);
    if (!currency) return `${amount.toFixed(2)}`;

    // Format based on currency
    switch (selectedCurrency) {
      case 'PKR':
        return `${currency.symbol}${amount.toLocaleString('en-PK', { 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 0 
        })}`;
      case 'USD':
        return `${currency.symbol}${amount.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
      case 'EUR':
        return `${currency.symbol}${amount.toLocaleString('de-DE', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
      default:
        return `${currency.symbol}${amount.toFixed(2)}`;
    }
  };

  const convertAmount = (amount: number, fromCurrency: Currency, toCurrency: Currency): number => {
    if (fromCurrency === toCurrency) return amount;

    const fromRate = currencies.find(c => c.code === fromCurrency)?.exchangeRate || 1;
    const toRate = currencies.find(c => c.code === toCurrency)?.exchangeRate || 1;

    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  };

  const value: CurrencyContextType = {
    selectedCurrency,
    currencies,
    setCurrency,
    formatAmount,
    convertAmount,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}; 