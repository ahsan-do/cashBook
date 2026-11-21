import { AppText as Text } from './AppText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { formatMoney, formatMoneyParts, parseMoneyAmount } from '../services/money';
import { motion } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { TABULAR_NUMS } from '../theme/typography';

interface BalanceAmountProps {
  amount: number | string;
  currencyCode: string;
  compact?: boolean;
  accessibilityLabel?: string;
}

export const BalanceAmount: React.FC<BalanceAmountProps> = ({ amount, currencyCode, compact = false, accessibilityLabel }) => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const target = parseMoneyAmount(amount);
  const [displayAmount, setDisplayAmount] = useState(target);
  const previousAmount = useRef(target);
  const firstUpdate = useRef(true);
  useEffect(() => {
    const from = previousAmount.current;
    previousAmount.current = target;
    if (firstUpdate.current) { firstUpdate.current = false; return; }
    if (reducedMotion || from === target) { setDisplayAmount(target); return; }
    let startTime: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / motion.duration.balance);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);
  const parts = useMemo(() => {
    const formatted = formatMoneyParts(displayAmount, currencyCode);
    return { major: `${formatted.negative ? '−' : ''}${formatted.major}`, minor: formatted.minor };
  }, [displayAmount, currencyCode]);
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
    major: { fontSize: majorSize, lineHeight: majorSize + 6, fontWeight: '800', letterSpacing: compact ? -0.7 : -1.2, fontVariant: [...TABULAR_NUMS] },
    minor: { fontSize: Math.round(majorSize * 0.5), lineHeight: Math.round(majorSize * 0.6), fontWeight: '700', marginTop: compact ? 2 : 3, fontVariant: [...TABULAR_NUMS] },
    currency: { fontSize: theme.typeSize.caption - (compact ? 2 : 1), fontWeight: '700', letterSpacing: 0.7, marginTop: compact ? 10 : 13 },
  });
};
