import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAmountInput, formatGrouped, formatMoney, formatMoneyParts, parseMoneyAmount } from '../../src/services/money.ts';

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

test('groups western and South Asian integer digits by hand', () => {
  const values = ['0', '999', '1000', '99999', '100000', '1234567', '123456789012'];
  const western = ['0', '999', '1,000', '99,999', '100,000', '1,234,567', '123,456,789,012'];
  const southAsian = ['0', '999', '1,000', '99,999', '1,00,000', '12,34,567', '1,23,45,67,89,012'];
  values.forEach((value, index) => {
    assert.equal(formatGrouped(value, '3-3'), western[index]);
    assert.equal(formatGrouped(value, '3-2-2'), southAsian[index]);
  });
  assert.equal(formatMoney('1234567.5', 'PKR'), 'PKR 12,34,567.50');
  assert.equal(formatMoney('1234567.5', 'USD'), '$1,234,567.50');
  assert.deepEqual(formatMoneyParts('-1234567.5', 'INR'), { major: '12,34,567', minor: '50', negative: true });
});

test('preserves partial quick-add input and normalizes malformed digits', () => {
  const cases = [
    ['0', '0', '0', false],
    ['00', '0', '0', false],
    ['12.', '12.', '12.', false],
    ['12.5', '12.5', '12.5', false],
    ['.5', '0.5', '0.5', false],
    ['1234.567', '1234.56', '1,234.56', true],
  ];
  for (const [input, raw, display, ignored] of cases) assert.deepEqual(formatAmountInput(input, 'USD'), { raw, display, ignoredInput: ignored });
  const limited = formatAmountInput('1234567890123', 'PKR');
  assert.equal(limited.raw, '123456789012');
  assert.equal(limited.display, '1,23,45,67,89,012');
  assert.equal(limited.ignoredInput, true);
  assert.equal(formatAmountInput('-4', 'USD').raw, '4');
  assert.equal(formatAmountInput('-4', 'USD').ignoredInput, true);
});
