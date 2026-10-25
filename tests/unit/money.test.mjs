import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, parseMoneyAmount } from '../../src/services/money.ts';

test('parses Postgres numeric values and rejects non-finite amounts', () => {
  assert.equal(parseMoneyAmount('1234.50'), 1234.5);
  assert.equal(parseMoneyAmount(10), 10);
  assert.throws(() => parseMoneyAmount('not-money'), /valid number/i);
});

test('formats currency using the ISO currency fraction digits', () => {
  assert.match(formatMoney('1234.5', 'USD'), /1,234\.50/);
  assert.match(formatMoney('1234.5', 'JPY'), /1,235/);
  assert.doesNotMatch(formatMoney('1234.5', 'JPY'), /\.\d/);
  assert.match(formatMoney('1234.5', 'KWD'), /1,234\.500/);
});

test('rejects malformed currency codes and non-finite amounts', () => {
  assert.throws(() => formatMoney(1, 'US'), /three-letter ISO/i);
  assert.throws(() => formatMoney(Number.NaN, 'USD'), /valid number/i);
});
