import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface EmailVerificationScreenProps {
  navigation: any;
  route: any;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ route }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const {
    user,
    session,
    isEmailVerified,
    resendVerificationEmail,
    checkEmailVerification,
    reloadUser,
    logout,
    authLinkMessage,
    clearAuthLinkMessage,
  } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showLinkError, setShowLinkError] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const email = route.params?.email || user?.email;

  useEffect(() => {
    if (!cooldownSeconds) return;
    const timer = setInterval(() => {
      setCooldownSeconds((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    // AuthContext consumes the confirmation URL. Refresh when the app resumes
    // so a confirmation completed in the browser is reflected in auth state.
    const refreshIfSignedIn = () => {
      if (sessionRef.current) void reloadUser().catch(() => undefined);
    };
    refreshIfSignedIn();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfSignedIn();
    });
    return () => listener.remove();
  }, []);

  const handleCheckVerification = async () => {
    setActionError('');
    setStatusMessage('');
    setIsVerifying(true);
    try {
      await reloadUser();
      const verified = await checkEmailVerification();
      if (verified || isEmailVerified) {
        setStatusMessage('Your email is confirmed. You can now use Cashbook.');
      } else {
        setStatusMessage('Open the confirmation link from your email, then return here and check again.');
      }
    } catch (error: any) {
      setActionError(error?.message || 'Could not check your email. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    setActionError('');
    setStatusMessage('');
    setIsResending(true);
    try {
      await resendVerificationEmail(email);
      setCooldownSeconds(30);
      setShowLinkError(false);
      setStatusMessage('A new confirmation email has been sent.');
    } catch (error: any) {
      setActionError(error?.message || 'Could not send the email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = async () => {
    setActionError('');
    setIsLoggingOut(true);
    try {
      clearAuthLinkMessage();
      await logout();
    } catch (error: any) {
      setActionError(error?.message || 'Could not log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.brandMark}><Ionicons name="mail-outline" size={26} color={theme.colors.onPrimary} /></View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>One quick step to get your cash book ready.</Text>
        <Text style={styles.email}>{email || 'your email address'}</Text>

        <Text style={styles.description}>
          {showLinkError && authLinkMessage
            ? authLinkMessage
            : 'Open the confirmation link in your inbox, then return to Cashbook.'}
        </Text>
        {!!statusMessage && <Text style={styles.statusMessage} accessibilityRole="alert">{statusMessage}</Text>}
        {!!actionError && <Text style={styles.actionError} accessibilityRole="alert">{actionError}</Text>}

        <View style={styles.buttonContainer}>
          {session && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleCheckVerification}
              disabled={isVerifying || isResending || isLoggingOut}
              accessibilityRole="button"
            >
              {isVerifying ? (
                <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.buttonText}>I've Verified My Email</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, session ? styles.secondaryButton : styles.primaryButton]}
            onPress={handleResendEmail}
            disabled={isResending || isVerifying || isLoggingOut || cooldownSeconds > 0}
            accessibilityRole="button"
            accessibilityLabel={cooldownSeconds > 0 ? `Resend email available in ${cooldownSeconds} seconds` : 'Resend confirmation email'}
          >
            {isResending ? (
              <ActivityIndicator color={session ? theme.colors.primaryVariant : theme.colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.buttonText, session ? styles.secondaryButtonText : styles.buttonTextPrimary]}>
                {cooldownSeconds > 0 ? `Resend Email (${cooldownSeconds}s)` : 'Resend Email'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => void handleBackToLogin()} disabled={isLoggingOut || isResending || isVerifying} accessibilityRole="button" accessibilityLabel="Back to login">
            {isLoggingOut ? <ActivityIndicator color={theme.colors.textSecondary} /> : <Text style={[styles.buttonText, styles.backButtonText]}>Back to login</Text>}
          </TouchableOpacity>
        </View>

      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.xxxl },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brandMark: { width: 54, height: 54, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xl },
  title: {
    fontSize: theme.typeSize.display,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typeSize.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  email: {
    fontSize: theme.typeSize.title,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  description: {
    fontSize: theme.typeSize.body,
    color: theme.colors.textSecondary,
    lineHeight: 23,
    marginBottom: theme.spacing.lg,
  },
  statusMessage: { color: theme.colors.success, fontSize: theme.typeSize.small, lineHeight: 20, marginBottom: theme.spacing.md },
  actionError: { color: theme.colors.error, fontSize: theme.typeSize.small, lineHeight: 20, marginBottom: theme.spacing.md },
  buttonContainer: {
    width: '100%',
    gap: theme.spacing.lg,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  backButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: theme.typeSize.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  buttonTextPrimary: { color: theme.colors.onPrimary },
  secondaryButtonText: {
    color: theme.colors.primaryVariant,
  },
  backButtonText: {
    color: theme.colors.textSecondary,
  },
});
