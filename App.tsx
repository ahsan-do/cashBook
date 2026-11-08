import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { CurrencyProvider } from './src/contexts/CurrencyContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { DialogProvider } from './src/contexts/DialogContext';
import { ThemedToast } from './src/components/ThemedToast';

const AppContent = () => {
  const { theme } = useTheme();
  
  return (
    <>
      <StatusBar style={theme.colors.statusBar} />
      <AppNavigator />
      <ThemedToast />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <DialogProvider>
              <CurrencyProvider>
                <AppContent />
              </CurrencyProvider>
            </DialogProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
