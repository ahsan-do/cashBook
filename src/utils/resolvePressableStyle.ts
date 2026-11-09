import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

export const resolvePressableStyle = (
  style: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>) | undefined,
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> => typeof style === 'function' ? style(state) : style;
