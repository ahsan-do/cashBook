import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestSettlements } from '../../src/utils/suggestSettlements.ts';

test('matches two debtors to one creditor with the minimum payments', () => {
  const suggestions = suggestSettlements([
    { userId: 'a', displayName: 'A', balance: 80 },
    { userId: 'b', displayName: 'B', balance: -40 },
    { userId: 'c', displayName: 'C', balance: -40 },
  ]);
  assert.deepEqual(suggestions.map(({ fromUser, toUser, amount }) => ({ fromUser, toUser, amount })), [
    { fromUser: 'b', toUser: 'a', amount: 40 },
    { fromUser: 'c', toUser: 'a', amount: 40 },
  ]);
});

test('preserves decimal amounts to cents', () => {
  const suggestions = suggestSettlements([
    { userId: 'a', displayName: 'A', balance: 10.01 },
    { userId: 'b', displayName: 'B', balance: -3.34 },
    { userId: 'c', displayName: 'C', balance: -6.67 },
  ]);
  assert.deepEqual(suggestions.map((item) => item.amount), [3.34, 6.67]);
});

test('returns no suggestions when every balance is zero', () => {
  assert.deepEqual(suggestSettlements([
    { userId: 'a', displayName: 'A', balance: 0 },
    { userId: 'b', displayName: 'B', balance: 0 },
  ]), []);
});

test('uses two payments for one debtor and two creditors and conserves the balance', () => {
  const balances = [
    { userId: 'a', displayName: 'A', balance: 50 },
    { userId: 'b', displayName: 'B', balance: -60 },
    { userId: 'c', displayName: 'C', balance: 10 },
    { userId: 'd', displayName: 'D', balance: 0 },
  ];
  const suggestions = suggestSettlements(balances);
  assert.deepEqual(suggestions.map(({ fromUser, toUser, amount }) => ({ fromUser, toUser, amount })), [
    { fromUser: 'b', toUser: 'a', amount: 50 },
    { fromUser: 'b', toUser: 'c', amount: 10 },
  ]);
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions.reduce((sum, payment) => sum + payment.amount, 0), 60);
  assert.equal(suggestions.reduce((sum, payment) => sum + payment.amount, 0), balances.filter((member) => member.balance > 0).reduce((sum, member) => sum + member.balance, 0));
});
