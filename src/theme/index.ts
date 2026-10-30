import { ThemeColors } from '../types';

export const lightColors: ThemeColors = {
  background: '#f2f3ee',
  surface: '#ffffff',
  surfaceVariant: '#f8f9f5',
  text: '#11130f',
  textSecondary: '#55584f',
  textTertiary: '#73766c',
  primary: '#c8f169',
  primaryVariant: '#496b0d',
  onPrimary: '#11130f',
  secondary: '#c8f169',
  secondaryVariant: '#496b0d',
  onSecondary: '#11130f',
  error: '#c74e47',
  onError: '#ffffff',
  success: '#087f72',
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
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;
export const typeSize = { caption: 12, small: 14, body: 16, subtitle: 18, title: 22, display: 32, amount: 40 } as const;

export const themeTokens = { spacing, radius, typeSize } as const;
