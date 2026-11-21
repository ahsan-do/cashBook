export const FONT_FAMILY = 'CashbookManrope';

export const FONT_FACE = {
  400: `${FONT_FAMILY}-400`,
  500: `${FONT_FAMILY}-500`,
  600: `${FONT_FAMILY}-600`,
  700: `${FONT_FAMILY}-700`,
} as const;

export const FONT_WEIGHTS = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
export const TABULAR_NUMS = ['tabular-nums'] as const;

export const fontFaceForWeight = (weight: unknown): string => {
  if (weight === '500' || weight === 'medium') return FONT_FACE[500];
  if (weight === '600' || weight === 'semibold') return FONT_FACE[600];
  if (weight === '700' || weight === 'bold' || weight === '800' || weight === '900') return FONT_FACE[700];
  return FONT_FACE[400];
};
