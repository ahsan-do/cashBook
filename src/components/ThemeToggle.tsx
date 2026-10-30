import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  size?: number;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 24 }) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const styles = makeStyles(theme);

  const getIconName = () => {
    if (themeMode === 'system') {
      return theme.isDark ? 'moon' : 'sunny';
    }
    return themeMode === 'dark' ? 'moon' : 'sunny';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={`Theme setting: ${themeMode}`}
    >
      <Ionicons
        name={getIconName() as any}
        size={size}
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    minWidth: 44,
    minHeight: 44,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
