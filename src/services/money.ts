/** Parse a Postgres numeric JSON value without performing client-side arithmetic. */
export const parseMoneyAmount = (value: number | string): number => {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount)) {
    throw new Error('The amount is not a valid number.');
  }
  return amount;
};

/** Format using the currency's ISO 4217 fraction digits (for example JPY 0, KWD 3). */
export const formatMoney = (value: number | string, currencyCode: string): string => {
  const amount = parseMoneyAmount(value);
  const normalizedCode = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error('The currency code must be a three-letter ISO code.');
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCode,
    }).format(amount);
  } catch {
    throw new Error(`Unsupported currency code: ${normalizedCode}.`);
  }
};
