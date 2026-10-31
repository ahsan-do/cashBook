import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface LoginScreenProps { navigation: any; }
type Field = 'email' | 'password';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const { signIn } = useAuth();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const errors: Partial<Record<Field, string>> = {};
    if (!normalizedEmail) errors.email = 'Enter your email address.';
    if (!password) errors.password = 'Enter your password.';
    setFieldError(errors);
    setFormError('');
    setEmailNotConfirmed(false);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      await signIn(normalizedEmail, password);
    } catch (error: any) {
      const unconfirmed = error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message || '');
      setEmailNotConfirmed(unconfirmed);
      setFormError(unconfirmed
        ? 'Confirm your email before signing in. You can resend the confirmation email below.'
        : error?.message || 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: Field) => [
    styles.input,
    { backgroundColor: theme.colors.surface, borderColor: fieldError[field] ? theme.colors.error : focused === field ? theme.colors.primaryVariant : theme.colors.border, color: theme.colors.text },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.content}>
            <View style={styles.brandMark}><Ionicons name="wallet-outline" size={26} color={theme.colors.onPrimary} /></View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to see your cash books.</Text>

            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={inputStyle('email')} value={email} onChangeText={(value) => { setEmail(value); setFieldError((current) => ({ ...current, email: undefined })); }}
                  placeholder="you@example.com" placeholderTextColor={theme.colors.textTertiary} keyboardType="email-address"
                  autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" returnKeyType="next"
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} onSubmitEditing={() => passwordRef.current?.focus()}
                  editable={!loading} accessibilityLabel="Email address" accessibilityState={{ disabled: loading }}
                />
                {!!fieldError.email && <Text style={styles.fieldError}>{fieldError.email}</Text>}
              </View>

              <View>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.passwordWrap, { backgroundColor: theme.colors.surface, borderColor: fieldError.password ? theme.colors.error : focused === 'password' ? theme.colors.primaryVariant : theme.colors.border }]}>
                  <TextInput
                    ref={passwordRef} style={[styles.passwordInput, { color: theme.colors.text }]} value={password}
                    onChangeText={(value) => { setPassword(value); setFieldError((current) => ({ ...current, password: undefined })); }}
                    placeholder="Your password" placeholderTextColor={theme.colors.textTertiary} secureTextEntry={!showPassword}
                    autoCapitalize="none" autoCorrect={false} textContentType="password" autoComplete="current-password"
                    returnKeyType="done" onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} onSubmitEditing={() => void handleLogin()}
                    editable={!loading} accessibilityLabel="Password" accessibilityState={{ disabled: loading }}
                  />
                  <TouchableOpacity style={styles.visibilityButton} onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityState={{ disabled: loading }} disabled={loading}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {!!fieldError.password && <Text style={styles.fieldError}>{fieldError.password}</Text>}
              </View>

              {!!formError && <View>
                <Text style={styles.formError} accessibilityRole="alert">{formError}</Text>
                {emailNotConfirmed && <TouchableOpacity style={styles.resendLink} onPress={() => navigation.navigate('EmailVerification', { email: email.trim().toLowerCase() })} accessibilityRole="button"><Text style={styles.link}>Resend confirmation email</Text></TouchableOpacity>}
              </View>}

              <TouchableOpacity style={[styles.primaryButton, { opacity: loading ? 0.8 : 1 }]} onPress={() => void handleLogin()} disabled={loading} accessibilityRole="button" accessibilityLabel="Sign in">
                {loading ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
              </TouchableOpacity>
              <View style={styles.footer}><Text style={styles.footerText}>New to Cashbook? </Text><TouchableOpacity style={styles.textButton} onPress={() => navigation.navigate('SignUp')} accessibilityRole="button"><Text style={styles.link}>Create account</Text></TouchableOpacity></View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.xxxl },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brandMark: { width: 54, height: 54, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xl },
  title: { color: theme.colors.text, fontSize: theme.typeSize.display, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.typeSize.body, marginTop: theme.spacing.sm, marginBottom: theme.spacing.xxxl },
  form: { gap: theme.spacing.lg },
  label: { color: theme.colors.text, fontSize: theme.typeSize.small, fontWeight: '700', marginBottom: theme.spacing.sm },
  input: { minHeight: 54, borderWidth: 1.5, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, fontSize: theme.typeSize.body },
  passwordWrap: { minHeight: 54, borderWidth: 1.5, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, minHeight: 50, paddingHorizontal: theme.spacing.lg, fontSize: theme.typeSize.body },
  visibilityButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  fieldError: { color: theme.colors.error, fontSize: theme.typeSize.caption, marginTop: theme.spacing.xs },
  formError: { color: theme.colors.error, fontSize: theme.typeSize.small, lineHeight: 20 },
  resendLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  primaryButton: { minHeight: 56, borderRadius: theme.radius.md, marginTop: theme.spacing.sm, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: theme.colors.onPrimary, fontSize: theme.typeSize.body, fontWeight: '800' },
  footer: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md },
  footerText: { color: theme.colors.textSecondary, fontSize: theme.typeSize.small },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs },
  link: { color: theme.colors.primaryVariant, fontWeight: '700', fontSize: theme.typeSize.small },
});
