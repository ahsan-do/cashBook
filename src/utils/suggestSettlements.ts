import type { MemberBalance } from '../types';

export interface SuggestedSettlement {
  fromUser: string;
  fromName: string;
  toUser: string;
  toName: string;
  amount: number;
}

/** Build a minimal deterministic payment list from database-computed balances. */
export const suggestSettlements = (balances: Pick<MemberBalance, 'userId' | 'displayName' | 'balance'>[]): SuggestedSettlement[] => {
  const members = balances
    .map((member) => ({ ...member, cents: Math.round(member.balance * 100) }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
  const memo = new Map<string, SuggestedSettlement[] | null>();

  const solve = (): SuggestedSettlement[] | null => {
    const first = members.findIndex((member) => member.cents !== 0);
    if (first < 0) return [];
    const key = members.map((member) => member.cents).join(',');
    if (memo.has(key)) return memo.get(key)!;
    const source = members[first];
    let best: SuggestedSettlement[] | null = null;
    const triedAmounts = new Set<number>();

    for (let targetIndex = first + 1; targetIndex < members.length; targetIndex += 1) {
      const target = members[targetIndex];
      if (target.cents === 0 || Math.sign(target.cents) === Math.sign(source.cents)) continue;
      const amountCents = Math.min(Math.abs(source.cents), Math.abs(target.cents));
      if (triedAmounts.has(amountCents)) continue;
      triedAmounts.add(amountCents);
      const sourceBefore = source.cents;
      const targetBefore = target.cents;
      source.cents += source.cents > 0 ? -amountCents : amountCents;
      target.cents += target.cents > 0 ? -amountCents : amountCents;
      const remaining = solve();
      source.cents = sourceBefore;
      target.cents = targetBefore;
      if (remaining === null) continue;
      const payment: SuggestedSettlement = sourceBefore < 0
        ? { fromUser: source.userId, fromName: source.displayName, toUser: target.userId, toName: target.displayName, amount: amountCents / 100 }
        : { fromUser: target.userId, fromName: target.displayName, toUser: source.userId, toName: source.displayName, amount: amountCents / 100 };
      const candidate = [payment, ...remaining];
      if (best === null || candidate.length < best.length) best = candidate;
      if (sourceBefore + targetBefore === 0) break;
    }
    memo.set(key, best);
    return best;
  };

  return solve() ?? [];
};
