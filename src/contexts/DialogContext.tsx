import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeContext';
import { createDialogQueue } from '../utils/dialogQueue';

type Action = { label: string; destructive?: boolean; value: string };
type DialogRequest = { title: string; message: string; kind: 'confirm' | 'notify' | 'choose'; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; actions?: Action[]; selectedValue?: string };
interface DialogApi {
  confirm(options: Omit<DialogRequest, 'kind' | 'actions'>): Promise<boolean>;
  notify(options: { title: string; message: string }): Promise<void>;
  choose(options: { title: string; message: string; actions: Action[]; cancelLabel?: string }): Promise<string | null>;
}
const DialogContext = createContext<DialogApi | null>(null);

export const useDialog = () => {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used within DialogProvider');
  return value;
};

export const DialogProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { theme } = useTheme();
  const queue = useRef<ReturnType<typeof createDialogQueue<DialogRequest>> | null>(null);
  if (!queue.current) queue.current = createDialogQueue<DialogRequest>();
  const [active, setActive] = useState<DialogRequest | null>(queue.current.current);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const dismissing = useRef(false);

  useEffect(() => queue.current!.subscribe((request) => { setActive(request); dismissing.current = false; }), []);
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    setVisible(true);
    opacity.setValue(0); scale.setValue(0.96);
    Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 170, useNativeDriver: true }), Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 3, useNativeDriver: true })]).start();
  }, [active, opacity, scale]);

  const finish = useCallback((accepted: boolean, choice?: string) => {
    if (dismissing.current || !active) return;
    dismissing.current = true;
    const settle = () => {
      if (accepted && active.destructive) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      queue.current?.settle(choice ? true : accepted);
    };
    Animated.parallel([Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }), Animated.timing(scale, { toValue: 0.97, duration: 110, useNativeDriver: true })]).start(settle);
  }, [active, opacity, scale]);

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { finish(false); return true; });
    return () => subscription.remove();
  }, [active, finish]);

  const api = useMemo<DialogApi>(() => ({
    confirm: (options) => queue.current!.enqueue({ ...options, kind: 'confirm' }),
    notify: async (options) => { await queue.current!.enqueue({ ...options, kind: 'notify', confirmLabel: 'OK' }); },
    choose: async (options) => {
      const request: DialogRequest = { ...options, kind: 'choose' };
      const accepted = await queue.current!.enqueue(request);
      return accepted ? request.selectedValue ?? null : null;
    },
  }), []);

  // Choice requests resolve with their selected value through a lightweight wrapper.
  const onAction = (value: string) => {
    if (active?.kind === 'choose') {
      active.selectedValue = value;
      finish(true, value);
    } else finish(true);
  };
  const colors = theme.colors;
  return <DialogContext.Provider value={api}>
    {children}
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => finish(false)} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!active?.destructive) finish(false); }} accessibilityLabel="Dismiss dialog" />
        <Animated.View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface, opacity, transform: [{ scale }] }]}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.title, { color: colors.text }]}>{active?.title}</Text>
          {!!active?.message && <Text style={[styles.message, { color: colors.textSecondary }]}>{active.message}</Text>}
          {active?.kind === 'choose' ? <>
            {(active.actions ?? []).map((action) => <Pressable key={action.value} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => onAction(action.value)} style={[styles.button, { backgroundColor: action.destructive ? colors.error : colors.primary }]}><Text style={[styles.actionText, { color: action.destructive ? colors.onError : colors.onPrimary }]}>{action.label}</Text></Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel={active.cancelLabel || 'Cancel'} onPress={() => finish(false)} style={[styles.button, styles.cancel, { backgroundColor: colors.surfaceVariant }]}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>{active.cancelLabel || 'Cancel'}</Text></Pressable>
          </> : <View style={styles.buttons}>
            {active?.kind === 'confirm' && <Pressable accessibilityRole="button" accessibilityLabel={active.cancelLabel || 'Cancel'} onPress={() => finish(false)} style={[styles.button, styles.cancel, { backgroundColor: colors.surfaceVariant }]}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>{active.cancelLabel || 'Cancel'}</Text></Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel={active?.confirmLabel || 'OK'} onPress={() => onAction('confirm')} style={[styles.button, { backgroundColor: active?.destructive ? colors.error : colors.primary }]}><Text style={[styles.actionText, { color: active?.destructive ? colors.onError : colors.onPrimary }]}>{active?.confirmLabel || 'OK'}</Text></Pressable>
          </View>}
        </Animated.View>
      </View>
    </Modal>
  </DialogContext.Provider>;
};

const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 }, card: { width: '100%', maxWidth: 420, borderRadius: 24, padding: 24, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 18 }, title: { fontSize: 20, fontWeight: '700' }, message: { fontSize: 16, lineHeight: 23, marginTop: 10, marginBottom: 22 }, buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, button: { minHeight: 48, minWidth: 84, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, cancel: { marginTop: 0 }, actionText: { fontWeight: '700', fontSize: 15 }, cancelText: { fontWeight: '600', fontSize: 15 } });
