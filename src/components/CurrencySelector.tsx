import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTheme } from '../contexts/ThemeContext';
import { Currency } from '../types';

interface CurrencySelectorProps {
  visible: boolean;
  onClose: () => void;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ visible, onClose }) => {
  const { selectedCurrency, currencies, setCurrency } = useCurrency();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const handleCurrencySelect = (currency: Currency) => {
    setCurrency(currency);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          {
            backgroundColor: theme.colors.surface,
          },
        ]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Currency</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close currency selector" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.currencyList}>
            {currencies.map((currency) => (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.currencyItem,
                  {
                    backgroundColor: selectedCurrency === currency.code
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                    borderColor: theme.colors.border,
                  },
                  selectedCurrency === currency.code && styles.selectedCurrency
                ]}
                onPress={() => handleCurrencySelect(currency.code)}
              >
                <View style={styles.currencyInfo}>
                  <Text style={[
                    styles.currencySymbol,
                    {
                      color: selectedCurrency === currency.code
                        ? theme.colors.onPrimary
                        : theme.colors.text,
                    },
                  ]}>{currency.symbol}</Text>
                  <View style={styles.currencyDetails}>
                    <Text style={[
                      styles.currencyName,
                      {
                        color: selectedCurrency === currency.code
                          ? theme.colors.onPrimary
                          : theme.colors.text,
                      },
                    ]}>{currency.name}</Text>
                    <Text style={[
                      styles.currencyCode,
                      {
                        color: selectedCurrency === currency.code
                          ? theme.colors.onPrimary
                          : theme.colors.textSecondary,
                      },
                    ]}>{currency.code}</Text>
                  </View>
                </View>
                {selectedCurrency === currency.code && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.onPrimary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
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
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: theme.typeSize.title,
    fontWeight: 'bold',
  },
  currencyList: {
    gap: theme.spacing.md,
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  selectedCurrency: {
    borderWidth: 2,
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    fontSize: theme.typeSize.title,
    fontWeight: 'bold',
    marginRight: theme.spacing.lg,
  },
  currencyDetails: {
    flex: 1,
  },
  currencyName: {
    fontSize: theme.typeSize.body,
    fontWeight: '600',
    marginBottom: theme.spacing.xxs,
  },
  currencyCode: {
    fontSize: theme.typeSize.small,
  },
});
