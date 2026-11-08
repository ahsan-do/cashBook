export interface DialogQueue<T> {
  current: T | null;
  enqueue(value: T): Promise<boolean>;
  settle(accepted: boolean): void;
  subscribe(listener: (value: T | null) => void): () => void;
}

export function createDialogQueue<T>(): DialogQueue<T> {
  type Pending = { value: T; resolve: (accepted: boolean) => void };
  const waiting: Pending[] = [];
  const listeners = new Set<(value: T | null) => void>();
  let active: Pending | null = null;
  const publish = () => listeners.forEach((listener) => listener(active?.value ?? null));
  return {
    get current() { return active?.value ?? null; },
    enqueue(value) {
      return new Promise<boolean>((resolve) => {
        waiting.push({ value, resolve });
        if (!active) { active = waiting.shift()!; publish(); }
      });
    },
    settle(accepted) {
      if (!active) return;
      const finished = active;
      active = waiting.shift() ?? null;
      finished.resolve(accepted);
      publish();
    },
    subscribe(listener) { listeners.add(listener); listener(active?.value ?? null); return () => listeners.delete(listener); },
  };
}
