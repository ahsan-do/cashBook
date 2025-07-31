import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, Theme, ThemeContextType, ThemeColors } from '../types';

const THEME_MODE_KEY = 'theme_mode';

// Light theme colors
const lightColors: ThemeColors = {
  // Background colors
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceVariant: '#f8fafc',
  
  // Text colors
  text: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  
  // Primary colors
  primary: '#2563eb',
  primaryVariant: '#1d4ed8',
  onPrimary: '#ffffff',
  
  // Secondary colors
  secondary: '#10b981',
  secondaryVariant: '#059669',
  onSecondary: '#ffffff',
  
  // Error colors
  error: '#dc2626',
  onError: '#ffffff',
  
  // Success colors
  success: '#10b981',
  onSuccess: '#ffffff',
  
  // Warning colors
  warning: '#f59e0b',
  onWarning: '#ffffff',
  
  // Border colors
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  
  // Shadow colors
  shadow: '#000000',
  
  // Status bar
  statusBar: 'dark' as const,
};

// Dark theme colors
const darkColors: ThemeColors = {
  // Background colors
  background: '#111827',
  surface: '#1f2937',
  surfaceVariant: '#374151',
  
  // Text colors
  text: '#f9fafb',
  textSecondary: '#d1d5db',
  textTertiary: '#9ca3af',
  
  // Primary colors
  primary: '#3b82f6',
  primaryVariant: '#60a5fa',
  onPrimary: '#ffffff',
  
  // Secondary colors
  secondary: '#10b981',
  secondaryVariant: '#34d399',
  onSecondary: '#ffffff',
  
  // Error colors
  error: '#ef4444',
  onError: '#ffffff',
  
  // Success colors
  success: '#10b981',
  onSuccess: '#ffffff',
  
  // Warning colors
  warning: '#f59e0b',
  onWarning: '#ffffff',
  
  // Border colors
  border: '#374151',
  borderLight: '#4b5563',
  
  // Shadow colors
  shadow: '#000000',
  
  // Status bar
  statusBar: 'light' as const,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme mode from AsyncStorage
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (savedThemeMode && ['light', 'dark', 'system'].includes(savedThemeMode)) {
          setThemeModeState(savedThemeMode as ThemeMode);
        } else {
          // Default to system if no saved preference
          setThemeModeState('system');
        }
      } catch (error) {
        console.error('Error loading theme mode:', error);
        // Fallback to system theme on error
        setThemeModeState('system');
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeMode();
  }, []);

  // Save theme mode to AsyncStorage
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  // Toggle between light and dark themes
  const toggleTheme = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
  };

  // Determine the actual theme based on mode and system preference
  const getActualTheme = (): Theme => {
    let isDark = false;
    
    switch (themeMode) {
      case 'light':
        isDark = false;
        break;
      case 'dark':
        isDark = true;
        break;
      case 'system':
        // Handle cases where systemColorScheme might be null or undefined
        isDark = systemColorScheme === 'dark';
        break;
      default:
        // Fallback to system theme
        isDark = systemColorScheme === 'dark';
        break;
    }

    return {
      colors: isDark ? darkColors : lightColors,
      isDark,
    };
  };

  const theme = getActualTheme();

  const value: ThemeContextType = {
    theme,
    themeMode,
    setThemeMode,
    toggleTheme,
  };

  if (isLoading) {
    // Show system theme during loading instead of always light
    const loadingTheme = {
      colors: systemColorScheme === 'dark' ? darkColors : lightColors,
      isDark: systemColorScheme === 'dark',
    };
    
    return (
      <ThemeContext.Provider value={{
        theme: loadingTheme,
        themeMode: 'system',
        setThemeMode,
        toggleTheme,
      }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 