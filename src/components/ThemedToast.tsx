import React from 'react';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';

export const ThemedToast: React.FC = () => {
  const { theme } = useTheme();
  const base = { borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border, minHeight: 64, width: '92%' as const, paddingVertical: theme.spacing.xs };
  const text1Style = { color: theme.colors.text, fontSize: theme.typeSize.body, fontWeight: '700' as const };
  const text2Style = { color: theme.colors.textSecondary, fontSize: theme.typeSize.small };
  const config = {
    success: (props: any) => <BaseToast {...props} style={[base, { borderLeftColor: theme.colors.success, borderLeftWidth: 5 }]} text1Style={text1Style} text2Style={text2Style} />,
    error: (props: any) => <ErrorToast {...props} style={[base, { borderLeftColor: theme.colors.error, borderLeftWidth: 5 }]} text1Style={text1Style} text2Style={text2Style} />,
    info: (props: any) => <BaseToast {...props} style={[base, { borderLeftColor: theme.colors.primary, borderLeftWidth: 5 }]} text1Style={text1Style} text2Style={text2Style} />,
  };
  return <Toast config={config} />;
};
