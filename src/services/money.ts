/** Parse a Postgres numeric JSON value without performing client-side arithmetic. */
export const parseMoneyAmount = (value: number | string): number => {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount)) {
    throw new Error('The amount is not a valid number.');
  }
  return amount;
};

export type GroupingStyle = '3-2-2' | '3-3';

/** Insert comma separators without relying on locale grouping rules. */
export const formatGrouped = (integerDigits: string, groupingStyle: GroupingStyle): string => {
  if (!/^\d*$/.test(integerDigits)) throw new Error('Integer digits must contain only numbers.');
  if (groupingStyle === '3-3') return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (integerDigits.length <= 3) return integerDigits;
  const lastThree = integerDigits.slice(-3);
  let prefix = integerDigits.slice(0, -3);
  const chunks: string[] = [];
  while (prefix.length > 2) {
    chunks.unshift(prefix.slice(-2));
    prefix = prefix.slice(0, -2);
  }
  if (prefix) chunks.unshift(prefix);
  return `${chunks.join(',')},${lastThree}`;
};

export interface FormattedAmountInput {
  raw: string;
  display: string;
  ignoredInput: boolean;
}

/** Normalize keypad input while retaining useful partial values such as "12.". */
export const formatAmountInput = (rawString: string, currencyCode: string): FormattedAmountInput => {
  const groupingStyle: GroupingStyle = ['PKR', 'INR'].includes(currencyCode.trim().toUpperCase()) ? '3-2-2' : '3-3';
  let digits = '';
  let decimalSeen = false;
  let fraction = '';
  let ignoredInput = false;
  for (const character of rawString) {
    if (character >= '0' && character <= '9') {
      if (decimalSeen) {
        if (fraction.length < 2) fraction += character;
        else ignoredInput = true;
      } else if (digits.length < 12) digits += character;
      else ignoredInput = true;
    } else if (character === '.' && !decimalSeen) decimalSeen = true;
    else ignoredInput = true;
  }
  if (decimalSeen && digits.length === 0) digits = '0';
  digits = digits.replace(/^0+(?=\d)/, '');
  if (!digits) digits = '0';
  const raw = `${digits}${decimalSeen ? `.${fraction}` : ''}`;
  const [integerPart, decimalPart] = raw.split('.');
  return { raw, display: `${formatGrouped(integerPart, groupingStyle)}${decimalPart === undefined ? '' : `.${decimalPart}`}`, ignoredInput };
};

export interface MoneyParts {
  major: string;
  minor: string;
  negative: boolean;
}

export const formatMoneyParts = (value: number | string, currencyCode: string): MoneyParts => {
  const amount = parseMoneyAmount(value);
  const normalizedCode = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) throw new Error('The currency code must be a three-letter ISO code.');
  let formatter: Intl.NumberFormat;
  try { formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCode }); }
  catch { throw new Error(`Unsupported currency code: ${normalizedCode}.`); }
  const digits = ['PKR', 'INR'].includes(normalizedCode) ? 2 : formatter.resolvedOptions().maximumFractionDigits;
  const [integer, minor = ''] = Math.abs(amount).toFixed(digits).split('.');
  return { major: formatGrouped(integer, ['PKR', 'INR'].includes(normalizedCode) ? '3-2-2' : '3-3'), minor, negative: amount < 0 };
};

/** Format using the currency's ISO 4217 fraction digits (for example JPY 0, KWD 3). */
export const formatMoney = (value: number | string, currencyCode: string): string => {
  const amount = parseMoneyAmount(value);
  const normalizedCode = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error('The currency code must be a three-letter ISO code.');
  }

  const parts = formatMoneyParts(amount, normalizedCode);
  const numberText = `${parts.major}${parts.minor ? `.${parts.minor}` : ''}`;
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCode });
  const digits = ['PKR', 'INR'].includes(normalizedCode) ? 2 : formatter.resolvedOptions().maximumFractionDigits;
  const templateFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCode, minimumFractionDigits: digits, maximumFractionDigits: digits });
  const template = templateFormatter.formatToParts(parts.negative ? -1.01 : 1.01);
  let insertedNumber = false;
  return template.map((part) => {
    if (part.type === 'integer') {
      if (insertedNumber) return '';
      insertedNumber = true;
      return numberText;
    }
    if (part.type === 'group' || part.type === 'decimal' || part.type === 'fraction') return '';
    return part.value;
  }).join('');
};
