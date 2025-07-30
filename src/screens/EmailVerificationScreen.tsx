import React, { useState, useEffect } from 'react';
import {
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

interface EmailVerificationScreenProps {
  navigation: any;
  route: any;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ navigation, route }) => {
  const { user, firebaseUser, sendEmailVerification, checkEmailVerification, reloadUser } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationChecked, setVerificationChecked] = useState(false);

  const { email } = route.params || {};

  useEffect(() => {
    // Check if user is already verified
    if (firebaseUser?.emailVerified) {
      navigation.replace('MainTabs');
    }
  }, [firebaseUser, navigation]);

  const handleCheckVerification = async () => {
    setIsVerifying(true);
    try {
      await reloadUser();
      const isVerified = await checkEmailVerification();
      
      if (isVerified) {
        Alert.alert(
          'Email Verified!',
          'Your email has been successfully verified. You can now use all features of the app.',
          [
            {
              text: 'Continue',
              onPress: () => navigation.replace('MainTabs'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Not Verified Yet',
          'Your email has not been verified yet. Please check your inbox and click the verification link, then try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to check verification: ${error.message}`);
    } finally {
      setIsVerifying(false);
      setVerificationChecked(true);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await sendEmailVerification();
      Alert.alert(
        'Email Sent',
        'A new verification email has been sent to your inbox. Please check your email and click the verification link.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', `Failed to send verification email: ${error.message}`);
    } finally {
      setIsResending(false);
    }
  };

  const handleSkipForNow = () => {
    Alert.alert(
      'Skip Verification',
      'You can verify your email later from the Profile screen. Some features may be limited until you verify your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => navigation.replace('MainTabs'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={80} color="#2563eb" />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification email to:
        </Text>
        <Text style={styles.email}>{email || user?.email}</Text>

        <Text style={styles.description}>
          Please check your inbox and click the verification link to activate your account.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleCheckVerification}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>I've Verified My Email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleResendEmail}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : (
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Resend Verification Email
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={handleSkipForNow}
          >
            <Text style={[styles.buttonText, styles.skipButtonText]}>
              Skip for Now
            </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  skipButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButtonText: {
    color: '#2563eb',
  },
  skipButtonText: {
    color: '#6b7280',
  },
  tipsContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  tip: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
}); 