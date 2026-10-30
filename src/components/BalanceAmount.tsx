import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { formatMoney, parseMoneyAmount } from '../services/money';

interface BalanceAmountProps {
  amount: number | string;
  currencyCode: string;
  compact?: boolean;
  accessibilityLabel?: string;
}

export const BalanceAmount: React.FC<BalanceAmountProps> = ({ amount, currencyCode, compact = false, accessibilityLabel }) => {
  const { theme } = useTheme();
  const parts = useMemo(() => {
    const value = parseMoneyAmount(amount);
    const absolute = Math.abs(value);
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode.trim().toUpperCase() }).formatToParts(absolute);
    const major = formatted.filter((part) => part.type === 'integer' || part.type === 'group').map((part) => part.value).join('');
    const minor = formatted.filter((part) => part.type === 'fraction').map((part) => part.value).join('');
    return { major: `${value < 0 ? '−' : ''}${major}`, minor };
  }, [amount, currencyCode]);
  const styles = useMemo(() => makeStyles(theme, compact), [theme, compact]);

  return <View style={styles.container} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? `${formatMoney(amount, currencyCode)} ${currencyCode}`}>
    <View style={styles.amountLine}>
      <Text style={[styles.major, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{parts.major}</Text>
      {parts.minor ? <Text style={[styles.minor, { color: theme.colors.text }]}>{`.${parts.minor}`}</Text> : null}
    </View>
    <Text style={[styles.currency, { color: theme.colors.textTertiary }]}>{currencyCode.toUpperCase()}</Text>
  </View>;
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme'], compact: boolean) => {
  const majorSize = compact ? theme.typeSize.title + 6 : theme.typeSize.amount;
  return StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'flex-start', gap: compact ? 5 : 8 },
    amountLine: { flexDirection: 'row', alignItems: 'flex-start' },
    major: { fontSize: majorSize, lineHeight: majorSize + 6, fontWeight: '800', letterSpacing: compact ? -0.7 : -1.2 },
    minor: { fontSize: Math.round(majorSize * 0.5), lineHeight: Math.round(majorSize * 0.6), fontWeight: '700', marginTop: compact ? 2 : 3 },
    currency: { fontSize: theme.typeSize.caption - (compact ? 2 : 1), fontWeight: '700', letterSpacing: 0.7, marginTop: compact ? 10 : 13 },
  });
};
