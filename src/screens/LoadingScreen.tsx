import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export const LoadingScreen = () => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.mark, { backgroundColor: theme.colors.primary, opacity, transform: [{ scale }] }]}>
          <Ionicons name="wallet-outline" size={32} color={theme.colors.onPrimary} />
        </Animated.View>
        <Text style={[styles.name, { color: theme.colors.text }]}>Cashbook</Text>
        <Text style={[styles.caption, { color: theme.colors.textSecondary }]}>Your money, in view</Text>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: theme.spacing.huge + 32, height: theme.spacing.huge + 32, borderRadius: theme.radius.xl, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: theme.spacing.xl, fontSize: theme.typeSize.title + 6, lineHeight: theme.typeSize.title + 12, fontWeight: '800', letterSpacing: -0.7 },
  caption: { marginTop: theme.spacing.xs + 2, fontSize: theme.typeSize.small, fontWeight: '500' },
});
