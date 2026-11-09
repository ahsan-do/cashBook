import React, { useRef, useState } from 'react';
import { Animated, Pressable, PressableProps } from 'react-native';
import { motion } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { resolvePressableStyle } from '../utils/resolvePressableStyle';

interface MotionPressableProps extends PressableProps {}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const MotionPressable: React.FC<MotionPressableProps> = ({ children, style, onPressIn, onPressOut, disabled, ...props }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const pressIn = (event: any) => {
    onPressIn?.(event);
    setPressed(true);
    if (!reduced && !disabled) Animated.spring(scale, { toValue: 0.97, ...motion.spring, useNativeDriver: true }).start();
  };
  const pressOut = (event: any) => {
    onPressOut?.(event);
    setPressed(false);
    if (!reduced) Animated.spring(scale, { toValue: 1, ...motion.spring, useNativeDriver: true }).start();
  };
  const outerStyle = resolvePressableStyle(style, { pressed });
  return <AnimatedPressable
    {...props}
    disabled={disabled}
    style={[outerStyle, { transform: [{ scale: reduced ? 1 : scale }] }]}
    onPressIn={pressIn}
    onPressOut={pressOut}
  >{children}</AnimatedPressable>;
};
