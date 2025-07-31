# Theme System Documentation

## Overview

The Cashbook app now supports a comprehensive theme system with three modes:
- **Light Theme**: Bright colors for daytime use
- **Dark Theme**: Dark colors for nighttime use  
- **System Default**: Automatically follows the device's system theme setting

## Features

### Theme Modes
- **Light Theme**: Optimized for bright environments with high contrast
- **Dark Theme**: Reduces eye strain in low-light conditions
- **System Default**: Automatically switches based on device settings

### Persistent Storage
- Theme preferences are saved to AsyncStorage
- Settings persist across app restarts
- Smooth transitions between themes

### Comprehensive Color System
The theme system includes colors for:
- Background colors (background, surface, surfaceVariant)
- Text colors (text, textSecondary, textTertiary)
- Primary colors (primary, primaryVariant, onPrimary)
- Secondary colors (secondary, secondaryVariant, onSecondary)
- Status colors (error, success, warning)
- Border and shadow colors
- Status bar styling

## Implementation

### Core Files

#### 1. Theme Types (`src/types/index.ts`)
```typescript
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  primary: string;
  // ... more color definitions
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
}
```

#### 2. Theme Context (`src/contexts/ThemeContext.tsx`)
- Manages theme state and persistence
- Provides theme switching functionality
- Handles system theme detection
- Exports `useTheme` hook for components

#### 3. Theme Settings Screen (`src/screens/ThemeSettingsScreen.tsx`)
- Dedicated screen for theme selection
- Visual theme previews
- Clear descriptions for each mode

### Usage in Components

#### Basic Usage
```typescript
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { theme, themeMode, setThemeMode, toggleTheme } = useTheme();
  
  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>
        Hello World
      </Text>
    </View>
  );
};
```

#### Theme Toggle Component
```typescript
import { ThemeToggle } from '../components/ThemeToggle';

// Quick toggle between light/dark
<ThemeToggle size={24} />
```

### Navigation Integration

The theme system is integrated with React Navigation:
- Tab bar colors adapt to theme
- Status bar style changes automatically
- All navigation elements use theme colors

### Updated Screens

The following screens have been updated to use the theme system:
- **HomeScreen**: Main dashboard with theme-aware styling
- **ProfileScreen**: Settings screen with theme options
- **ThemeSettingsScreen**: Dedicated theme configuration
- **CurrencySelector**: Modal with theme support

## Color Palette

### Light Theme Colors
- Background: `#f9fafb` (Light gray)
- Surface: `#ffffff` (White)
- Text: `#1f2937` (Dark gray)
- Primary: `#2563eb` (Blue)
- Error: `#dc2626` (Red)

### Dark Theme Colors
- Background: `#111827` (Dark gray)
- Surface: `#1f2937` (Medium dark gray)
- Text: `#f9fafb` (Light gray)
- Primary: `#3b82f6` (Lighter blue)
- Error: `#ef4444` (Lighter red)

## Best Practices

### 1. Always Use Theme Colors
```typescript
// ✅ Good
<Text style={{ color: theme.colors.text }}>Content</Text>

// ❌ Bad
<Text style={{ color: '#000000' }}>Content</Text>
```

### 2. Use Semantic Color Names
```typescript
// ✅ Good
backgroundColor: theme.colors.surface
color: theme.colors.textSecondary

// ❌ Bad
backgroundColor: theme.colors.background
color: theme.colors.text
```

### 3. Handle Loading States
```typescript
const { theme, isLoading } = useTheme();

if (isLoading) {
  return <LoadingComponent />;
}
```

### 4. Test Both Themes
Always test your components in both light and dark themes to ensure proper contrast and readability.

## Future Enhancements

Potential improvements for the theme system:
- Custom color schemes
- High contrast mode
- Reduced motion support
- Color blindness accessibility
- Seasonal themes
- User-defined color preferences

## Troubleshooting

### Common Issues

1. **Theme not updating**: Ensure the component is wrapped in `ThemeProvider`
2. **Colors not changing**: Check that you're using `theme.colors` instead of hardcoded colors
3. **System theme not working**: Verify `useColorScheme` is working on the device

### Debug Mode
Add console logs to check theme state:
```typescript
console.log('Current theme:', themeMode);
console.log('Is dark:', theme.isDark);
``` 