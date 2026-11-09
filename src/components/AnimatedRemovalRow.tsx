import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';

interface AnimatedRemovalRowProps {
  id: string;
  removing: boolean;
  onTransitionEnd: (id: string, collapsed: boolean) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  verticalMargin?: number;
}

export const AnimatedRemovalRow: React.FC<AnimatedRemovalRowProps> = ({ id, removing, onTransitionEnd, children, style, verticalMargin = 0 }) => {
  const reducedMotion = useReducedMotion();
  const height = useRef(new Animated.Value(0)).current;
  const margin = useRef(new Animated.Value(verticalMargin)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const callback = useRef(onTransitionEnd);
  callback.current = onTransitionEnd;
  const removingRef = useRef(removing);
  removingRef.current = removing;

  const onLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (!nextHeight) return;
    if (measuredHeight === null) {
      setMeasuredHeight(nextHeight);
      height.setValue(removing ? 0 : nextHeight);
      margin.setValue(removing ? 0 : verticalMargin);
      opacity.setValue(removing ? 0 : 1);
    }
  };

  useEffect(() => {
    if (measuredHeight === null) return;
    const collapsed = removing;
    if (reducedMotion) {
      height.setValue(collapsed ? 0 : measuredHeight);
      margin.setValue(collapsed ? 0 : verticalMargin);
      opacity.setValue(collapsed ? 0 : 1);
      callback.current(id, collapsed);
      return;
    }
    const animations = [
      Animated.timing(height, { toValue: collapsed ? 0 : measuredHeight, duration: motion.duration.rowRemoval, easing: motion.easing.rowRemoval, useNativeDriver: false }),
      Animated.timing(margin, { toValue: collapsed ? 0 : verticalMargin, duration: motion.duration.rowRemoval, easing: motion.easing.rowRemoval, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: collapsed ? 0 : 1, duration: motion.duration.rowRemoval, easing: motion.easing.rowRemoval, useNativeDriver: true }),
    ];
    const animation = Animated.parallel(animations);
    animation.start(({ finished }) => {
      if (finished && removingRef.current === collapsed) callback.current(id, collapsed);
    });
    return () => animation.stop();
  }, [id, measuredHeight, removing, reducedMotion, height, margin, opacity, verticalMargin]);

  return <Animated.View style={[{ height: measuredHeight === null ? undefined : height, marginVertical: margin, overflow: 'hidden' }, style]}>
    <Animated.View style={{ opacity }}>
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  </Animated.View>;
};
