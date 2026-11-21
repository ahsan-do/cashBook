import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';
import { BRAND_COLORS, BRAND_MARK } from '../theme/brand';

export const LoadingScreen = () => {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) { pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: motion.duration.startupPulse, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: motion.duration.startupPulse, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mark, { opacity, transform: [{ scale }] }]}>
        <Ionicons name="wallet-outline" size={BRAND_MARK.loaderGlyphDp} color={BRAND_COLORS.darkPage} style={{ transform: [{ translateY: BRAND_MARK.opticalOffsetDp }] }} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND_COLORS.darkPage, alignItems: 'center', justifyContent: 'center' },
  mark: { width: BRAND_MARK.tileDp, height: BRAND_MARK.tileDp, borderRadius: BRAND_MARK.tileDp / 2, backgroundColor: BRAND_COLORS.limePrimary, alignItems: 'center', justifyContent: 'center' },
});
