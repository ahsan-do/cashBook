import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, radius = 8, style }) => {
  const { theme } = useTheme();
  const animation = useRef(new Animated.Value(0)).current;
  const [measuredWidth, setMeasuredWidth] = useState(typeof width === 'number' ? width : 120);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(animation, { toValue: 1, duration: 1100, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [animation]);

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-measuredWidth, measuredWidth],
  });

  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[styles.clip, { width, height, borderRadius: radius, backgroundColor: theme.colors.borderLight }, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.shimmer,
          { width: measuredWidth * 0.55, backgroundColor: theme.isDark ? '#3a3e35' : '#ffffff', transform: [{ translateX }] },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  shimmer: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.85 },
});
