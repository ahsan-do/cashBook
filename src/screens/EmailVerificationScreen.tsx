import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
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
    setIsVerifying(true);
    try {
      await reloadUser();
      const verified = await checkEmailVerification();
      if (verified || isEmailVerified) {
        Alert.alert('Email Verified', 'Your email is confirmed. You can now use Cashbook.');
      } else {
        Alert.alert(
          'Not Verified Yet',
          'Open the confirmation link from your email, then return here and check again.'
        );
      }
    } catch (error: any) {
      Alert.alert('Could Not Check Email', error?.message || 'Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await resendVerificationEmail(email);
      setCooldownSeconds(30);
      setShowLinkError(false);
      Alert.alert('Email Sent', 'A new confirmation email has been sent.');
    } catch (error: any) {
      Alert.alert('Could Not Send Email', error?.message || 'Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      clearAuthLinkMessage();
      await logout();
    } catch (error: any) {
      Alert.alert('Could Not Log Out', error?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={80} color={theme.colors.primaryVariant} />
        </View>

        <Text style={styles.title}>{session ? 'Verify Your Email' : 'Check Your Email'}</Text>
        <Text style={styles.subtitle}>We've sent a verification email to:</Text>
        <Text style={styles.email}>{email || 'your email address'}</Text>

        <Text style={styles.description}>
          {showLinkError && authLinkMessage
            ? authLinkMessage
            : 'Please check your inbox and click the verification link to activate your account.'}
        </Text>

        <View style={styles.buttonContainer}>
          {session && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleCheckVerification}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.buttonText}>I've Verified My Email</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleResendEmail}
            disabled={isResending || cooldownSeconds > 0}
          >
            {isResending ? (
              <ActivityIndicator color={theme.colors.primary} size="small" />
            ) : (
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                {cooldownSeconds > 0 ? `Resend Email (${cooldownSeconds}s)` : 'Resend Email'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.backButton]} onPress={handleBackToLogin}>
            <Text style={[styles.buttonText, styles.backButtonText]}>Back to Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips:</Text>
          <Text style={styles.tip}>• Check your spam/junk folder</Text>
          <Text style={styles.tip}>• Make sure you entered the correct email</Text>
          <Text style={styles.tip}>• Wait a few minutes for the email to arrive</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxxl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xxxl,
  },
  title: {
    fontSize: theme.typeSize.title,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typeSize.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  email: {
    fontSize: theme.typeSize.subtitle,
    fontWeight: '600',
    color: theme.colors.primaryVariant,
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.typeSize.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.huge,
  },
  buttonContainer: {
    width: '100%',
    gap: theme.spacing.lg,
  },
  button: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
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
  secondaryButtonText: {
    color: theme.colors.primaryVariant,
  },
  backButtonText: {
    color: theme.colors.textSecondary,
  },
  tipsContainer: {
    marginTop: theme.spacing.huge,
    paddingHorizontal: theme.spacing.xl,
  },
  tipsTitle: {
    fontSize: theme.typeSize.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  tip: {
    fontSize: theme.typeSize.small,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
});
