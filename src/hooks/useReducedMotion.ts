import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduced = false;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!subscription) {
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduced = value; notify(); }).catch(() => undefined);
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduced = value; notify(); });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) { subscription?.remove(); subscription = null; }
  };
};

export const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, () => reduced, () => false);
