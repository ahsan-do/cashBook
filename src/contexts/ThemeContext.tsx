import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, Theme, ThemeContextType } from '../types';
import { darkColors, lightColors, themeTokens } from '../theme';

const THEME_MODE_KEY = 'theme_mode';

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
      ...themeTokens,
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
      ...themeTokens,
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
