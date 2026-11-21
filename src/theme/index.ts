import { ThemeColors } from '../types';

export const lightColors: ThemeColors = {
  background: '#f0f1ec',
  surface: '#ffffff',
  surfaceVariant: '#e8ebe2',
  surfaceRaised: '#f7f8f3',
  incomeTint: 'rgba(8, 127, 114, 0.10)',
  expenseTint: 'rgba(199, 78, 71, 0.10)',
  backdrop: 'rgba(12, 15, 10, 0.48)',
  text: '#11130f',
  textSecondary: '#55584f',
  textTertiary: '#64675e',
  primary: '#c8f169',
  primaryVariant: '#496b0d',
  onPrimary: '#11130f',
  secondary: '#c8f169',
  secondaryVariant: '#496b0d',
  onSecondary: '#11130f',
  error: '#b03832',
  onError: '#ffffff',
  success: '#006b60',
  onSuccess: '#ffffff',
  warning: '#8b5e00',
  onWarning: '#ffffff',
  border: '#dfe1d8',
  borderLight: '#eaebe5',
  shadow: '#11130f',
  statusBar: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#11130f',
  surface: '#1b1e19',
  surfaceVariant: '#252821',
  surfaceRaised: '#2d3129',
  incomeTint: 'rgba(93, 212, 194, 0.14)',
  expenseTint: 'rgba(255, 129, 119, 0.14)',
  backdrop: 'rgba(0, 0, 0, 0.62)',
  text: '#f7f8f4',
  textSecondary: '#c4c8bc',
  textTertiary: '#9ca193',
  primary: '#c8f169',
  primaryVariant: '#d7fa8d',
  onPrimary: '#11130f',
  secondary: '#c8f169',
  secondaryVariant: '#d7fa8d',
  onSecondary: '#11130f',
  error: '#ff8177',
  onError: '#30110f',
  success: '#5dd4c2',
  onSuccess: '#092520',
  warning: '#ffd166',
  onWarning: '#332600',
  border: '#3a3e35',
  borderLight: '#2e322b',
  shadow: '#000000',
  statusBar: 'light',
};

export const spacing = { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, card: 24, pill: 999 } as const;
export const typeSize = { caption: 12, small: 14, body: 16, subtitle: 18, title: 22, display: 32, amount: 40 } as const;

export const themeTokens = { spacing, radius, typeSize } as const;
