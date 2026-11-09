export interface PendingIdGuard {
  begin(id: string): boolean;
  finish(id: string): void;
  has(id: string): boolean;
}

/** Synchronous per-id lock for actions that must not start twice before React rerenders. */
export const createPendingIdGuard = (): PendingIdGuard => {
  const pending = new Set<string>();
  return {
    begin(id) {
      if (pending.has(id)) return false;
      pending.add(id);
      return true;
    },
    finish(id) { pending.delete(id); },
    has(id) { return pending.has(id); },
  };
};
