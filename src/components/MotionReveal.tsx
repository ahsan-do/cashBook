import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { motion } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface MotionRevealProps {
  children: React.ReactNode;
  delay?: number;
  exit?: boolean;
  style?: ViewStyle;
}

export const MotionReveal: React.FC<MotionRevealProps> = ({ children, delay = 0, exit = false, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      opacity.setValue(exit ? 0 : 1);
      translateY.setValue(0);
      return;
    }
    const animation = exit
      ? Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: motion.duration.quick, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -5, duration: motion.duration.quick, useNativeDriver: true }),
      ])
      : Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: motion.duration.standard, delay, easing: motion.easing.standard, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: motion.duration.standard, delay, easing: motion.easing.standard, useNativeDriver: true }),
      ]);
    animation.start();
    return () => animation.stop();
  }, [delay, exit, opacity, reduced, translateY]);
  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
};
