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
import { AppTextProvider } from './src/components/AppText';
import { useFonts } from 'expo-font';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { FONT_FACE } from './src/theme/typography';
import { LoadingScreen } from './src/screens/LoadingScreen';

const AppContent = () => {
  const { theme } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    [FONT_FACE[400]]: Manrope_400Regular,
    [FONT_FACE[500]]: Manrope_500Medium,
    [FONT_FACE[600]]: Manrope_600SemiBold,
    [FONT_FACE[700]]: Manrope_700Bold,
  });

  if (!fontsLoaded && !fontError) return <LoadingScreen />;
  
  return (
    <AppTextProvider loaded={fontsLoaded && !fontError}>
      <StatusBar style={theme.colors.statusBar} />
      <DialogProvider>
        <AppNavigator />
        <ThemedToast />
      </DialogProvider>
    </AppTextProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <CurrencyProvider>
              <AppContent />
            </CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
