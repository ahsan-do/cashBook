import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface SignUpScreenProps { navigation: any; }
type Field = 'name' | 'email' | 'password' | 'confirmPassword';

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const { signUp, signInWithGoogle } = useAuth();
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const handleSignUp = async () => {
    const normalizedName = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const errors: Partial<Record<Field, string>> = {};
    if (!normalizedName) errors.name = 'Enter your name.';
    if (!normalizedEmail) errors.email = 'Enter your email address.';
    if (!password) errors.password = 'Create a password.';
    else if (password.length < 6) errors.password = 'Use at least 6 characters.';
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      const hasSession = await signUp(normalizedEmail, password, normalizedName);
      if (!hasSession) navigation.navigate('EmailVerification', { email: normalizedEmail });
    } catch (error: any) {
      setFormError(error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setFormError('');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setFormError(error?.message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (field: Field) => [styles.input, {
    backgroundColor: theme.colors.surface,
    borderColor: fieldErrors[field] ? theme.colors.error : focused === field ? theme.colors.primaryVariant : theme.colors.border,
    color: theme.colors.text,
  }];

  const clearError = (field: Field) => setFieldErrors((current) => ({ ...current, [field]: undefined }));
  const renderPasswordToggle = (label: string) => <TouchableOpacity style={styles.visibilityButton} onPress={() => setVisiblePasswords((value) => !value)} disabled={loading} accessibilityRole="button" accessibilityLabel={`${visiblePasswords ? 'Hide' : 'Show'} ${label}`}><Ionicons name={visiblePasswords ? 'eye-off-outline' : 'eye-outline'} size={21} color={theme.colors.textSecondary} /></TouchableOpacity>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.content}>
            <View style={styles.brandMark}><Ionicons name="wallet-outline" size={26} color={theme.colors.onPrimary} /></View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>A clearer view of your cash starts here.</Text>

            <View style={styles.form}>
              <TouchableOpacity style={styles.googleButton} onPress={() => void handleGoogleSignIn()} disabled={loading} accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{ disabled: loading }}>
                {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
              </TouchableOpacity>
              <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>or create an account with email</Text><View style={styles.divider} /></View>

              <View>
                <Text style={styles.label}>Name</Text>
                <TextInput style={fieldStyle('name')} value={displayName} onChangeText={(value) => { setDisplayName(value); clearError('name'); }} placeholder="Your name" placeholderTextColor={theme.colors.textTertiary} autoCapitalize="words" autoCorrect={false} textContentType="name" autoComplete="name" returnKeyType="next" onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} onSubmitEditing={() => emailRef.current?.focus()} editable={!loading} accessibilityLabel="Name" />
                {!!fieldErrors.name && <Text style={styles.fieldError}>{fieldErrors.name}</Text>}
              </View>
              <View>
                <Text style={styles.label}>Email</Text>
                <TextInput ref={emailRef} style={fieldStyle('email')} value={email} onChangeText={(value) => { setEmail(value); clearError('email'); }} placeholder="you@example.com" placeholderTextColor={theme.colors.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" returnKeyType="next" onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} onSubmitEditing={() => passwordRef.current?.focus()} editable={!loading} accessibilityLabel="Email address" />
                {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
              </View>
              <View>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.passwordWrap, { backgroundColor: theme.colors.surface, borderColor: fieldErrors.password ? theme.colors.error : focused === 'password' ? theme.colors.primaryVariant : theme.colors.border }]}>
                  <TextInput ref={passwordRef} style={[styles.passwordInput, { color: theme.colors.text }]} value={password} onChangeText={(value) => { setPassword(value); clearError('password'); }} placeholder="At least 6 characters" placeholderTextColor={theme.colors.textTertiary} secureTextEntry={!visiblePasswords} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" autoComplete="new-password" returnKeyType="next" onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} onSubmitEditing={() => confirmPasswordRef.current?.focus()} editable={!loading} accessibilityLabel="Password" />
                  {renderPasswordToggle('password')}
                </View>
                {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
              </View>
              <View>
                <Text style={styles.label}>Confirm password</Text>
                <View style={[styles.passwordWrap, { backgroundColor: theme.colors.surface, borderColor: fieldErrors.confirmPassword ? theme.colors.error : focused === 'confirmPassword' ? theme.colors.primaryVariant : theme.colors.border }]}>
                  <TextInput ref={confirmPasswordRef} style={[styles.passwordInput, { color: theme.colors.text }]} value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); clearError('confirmPassword'); }} placeholder="Enter it once more" placeholderTextColor={theme.colors.textTertiary} secureTextEntry={!visiblePasswords} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" autoComplete="new-password" returnKeyType="done" onFocus={() => setFocused('confirmPassword')} onBlur={() => setFocused(null)} onSubmitEditing={() => void handleSignUp()} editable={!loading} accessibilityLabel="Confirm password" />
                  {renderPasswordToggle('password')}
                </View>
                {!!fieldErrors.confirmPassword && <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>}
              </View>

              {!!formError && <Text style={styles.formError} accessibilityRole="alert">{formError}</Text>}
              <TouchableOpacity style={[styles.primaryButton, { opacity: loading ? 0.8 : 1 }]} onPress={() => void handleSignUp()} disabled={loading} accessibilityRole="button" accessibilityLabel="Create account">
                {loading ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Create account</Text>}
              </TouchableOpacity>
              <View style={styles.footer}><Text style={styles.footerText}>Already have an account? </Text><TouchableOpacity style={styles.textButton} onPress={() => navigation.navigate('Login')} accessibilityRole="button"><Text style={styles.link}>Sign in</Text></TouchableOpacity></View>
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
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.typeSize.body, marginTop: theme.spacing.sm, marginBottom: theme.spacing.xxl },
  form: { gap: theme.spacing.lg },
  googleButton: { minHeight: 52, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  googleButtonText: { color: theme.colors.text, fontSize: theme.typeSize.body, fontWeight: '700' },
  dividerRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  divider: { height: 1, flex: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textTertiary, fontSize: theme.typeSize.caption },
  label: { color: theme.colors.text, fontSize: theme.typeSize.small, fontWeight: '700', marginBottom: theme.spacing.sm },
  input: { minHeight: 54, borderWidth: 1.5, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, fontSize: theme.typeSize.body },
  passwordWrap: { minHeight: 54, borderWidth: 1.5, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, minHeight: 50, paddingHorizontal: theme.spacing.lg, fontSize: theme.typeSize.body },
  visibilityButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  fieldError: { color: theme.colors.error, fontSize: theme.typeSize.caption, marginTop: theme.spacing.xs },
  formError: { color: theme.colors.error, fontSize: theme.typeSize.small, lineHeight: 20 },
  primaryButton: { minHeight: 56, borderRadius: theme.radius.md, marginTop: theme.spacing.sm, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: theme.colors.onPrimary, fontSize: theme.typeSize.body, fontWeight: '800' },
  footer: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md },
  footerText: { color: theme.colors.textSecondary, fontSize: theme.typeSize.small },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs },
  link: { color: theme.colors.primaryVariant, fontWeight: '700', fontSize: theme.typeSize.small },
});
