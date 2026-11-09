import { useCallback, useRef, useState } from 'react';
import { createPendingIdGuard } from '../utils/pendingIds';

type Transition = 'collapsed' | 'restored';
interface RemovalOptions {
  id: string;
  confirm: () => Promise<boolean>;
  action: () => Promise<void>;
  remove: () => void | Promise<void>;
  onSuccess?: () => void;
  onError: (error: unknown) => void;
}

export const useAnimatedRemoval = () => {
  const guard = useRef(createPendingIdGuard()).current;
  const activeRemovalId = useRef<string | null>(null);
  const waiters = useRef(new Map<string, { transition: Transition; resolve: () => void }>());
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());

  const onTransitionEnd = useCallback((id: string, collapsed: boolean) => {
    const waiter = waiters.current.get(id);
    const transition = collapsed ? 'collapsed' : 'restored';
    if (waiter?.transition === transition) {
      waiters.current.delete(id);
      waiter.resolve();
    }
  }, []);

  const waitFor = (id: string, transition: Transition) => new Promise<void>((resolve) => {
    waiters.current.set(id, { transition, resolve });
  });

  const removeWithConfirmation = useCallback(async ({ id, confirm, action, remove, onSuccess, onError }: RemovalOptions) => {
    if (activeRemovalId.current || !guard.begin(id)) return;
    activeRemovalId.current = id;
    try {
      if (!await confirm()) return;
      setPendingIds((current) => new Set(current).add(id));
      const collapsed = waitFor(id, 'collapsed');
      setRemovingIds((current) => new Set(current).add(id));
      try {
        await Promise.all([action(), collapsed]);
        await remove();
        onSuccess?.();
      } catch (error) {
        const restored = waitFor(id, 'restored');
        setRemovingIds((current) => { const next = new Set(current); next.delete(id); return next; });
        await restored;
        onError(error);
      }
    } finally {
      guard.finish(id);
      if (activeRemovalId.current === id) activeRemovalId.current = null;
      setPendingIds((current) => { const next = new Set(current); next.delete(id); return next; });
      setRemovingIds((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  }, [guard]);

  return {
    pendingIds,
    removingIds,
    onTransitionEnd,
    removeWithConfirmation,
  };
};
