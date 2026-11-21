import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, radius = 8, style }) => {
  const { theme } = useTheme();
  const animation = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const [measuredWidth, setMeasuredWidth] = useState(typeof width === 'number' ? width : 120);

  useEffect(() => {
    if (reducedMotion) { animation.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(animation, { toValue: 1, duration: motion.duration.shimmer, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [animation, reducedMotion]);

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-measuredWidth, measuredWidth],
  });

  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[styles.clip, { width, height, borderRadius: radius, backgroundColor: theme.colors.surfaceVariant }, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.shimmer,
          { width: measuredWidth * 0.55, backgroundColor: theme.colors.surfaceRaised, transform: [{ translateX }] },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  shimmer: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.85 },
});
