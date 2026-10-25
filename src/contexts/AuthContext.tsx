import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import type { EmailOtpType, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { User } from '../types';

const emailRedirectUrl = Linking.createURL('auth/callback');
const supportedOtpTypes = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

// Temporary compatibility shape for screens that previously read
// firebaseUser.emailVerified. Firebase itself is not used by this context.
interface LegacyVerificationUser {
  uid: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  authUser: SupabaseUser | null;
  firebaseUser: LegacyVerificationUser | null;
  isEmailVerified: boolean;
  authInitializing: boolean;
  authLinkMessage: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  sendEmailVerification: (email?: string) => Promise<void>;
  resendVerificationEmail: (email?: string) => Promise<void>;
  clearAuthLinkMessage: () => void;
  checkEmailVerification: () => Promise<boolean>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const appUserFromAuthUser = (authUser: SupabaseUser): User => {
  const metadata = authUser.user_metadata ?? {};
  const createdAt = authUser.created_at ? new Date(authUser.created_at) : new Date();

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    displayName:
      (typeof metadata.display_name === 'string' && metadata.display_name) ||
      (typeof metadata.full_name === 'string' && metadata.full_name) ||
      '',
    photoURL: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
    createdAt,
    updatedAt: authUser.updated_at ? new Date(authUser.updated_at) : createdAt,
  };
};

const queryValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authLinkMessage, setAuthLinkMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      if (!nextSession || nextSession.user.email_confirmed_at) {
        setPendingEmail(null);
      }
    };

    const completeEmailConfirmation = async (url: string) => {
      const parsed = Linking.parse(url);
      const path = [parsed.hostname, parsed.path]
        .filter(Boolean)
        .join('/')
        .replace(/^\/+/, '');
      if (path !== 'auth/callback') return;

      const params = parsed.queryParams ?? {};
      const fragmentParams = url.split('#')[1]?.split('&') ?? [];
      const getParam = (key: string) => {
        const fromQuery = queryValue(params[key]);
        if (fromQuery) return fromQuery;
        const pair = fragmentParams.find((part) => part.split('=')[0] === key);
        if (!pair) return undefined;
        try {
          return decodeURIComponent((pair.split('=').slice(1).join('=') || '').replace(/\+/g, ' '));
        } catch {
          return pair.split('=').slice(1).join('=');
        }
      };
      const code = getParam('code');
      const tokenHash = getParam('token_hash');
      const otpType = getParam('type');
      const callbackError = getParam('error_description') ?? getParam('error') ?? getParam('error_code');
      if (callbackError) {
        const errorCode = getParam('error_code');
        const isExpired = errorCode === 'otp_expired' || /expired|already been used|invalid.*link/i.test(callbackError);
        setAuthLinkMessage(
          isExpired
            ? 'This confirmation link has expired or has already been used. Request a new confirmation email to continue.'
            : `The confirmation link could not be completed: ${callbackError.replace(/\+/g, ' ')}`
        );
        return;
      }

      if (!code && tokenHash && otpType && supportedOtpTypes.has(otpType as EmailOtpType)) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as EmailOtpType,
        });
        if (error) {
          setAuthLinkMessage('This confirmation link has expired or has already been used. Request a new confirmation email to continue.');
          return;
        }
        applySession(data.session);
        return;
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setAuthLinkMessage('This confirmation link has expired or has already been used. Request a new confirmation email to continue.');
          return;
        }
        applySession(data.session);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    const linkListener = Linking.addEventListener('url', ({ url }) => {
      void completeEmailConfirmation(url).catch((error: unknown) => {
        console.error('Unable to complete the Supabase email confirmation link:', error);
        setAuthLinkMessage('The confirmation link could not be completed. Request a new confirmation email and try again.');
      });
    });

    const initializeAuth = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await completeEmailConfirmation(initialUrl);
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        applySession(data.session);
      } catch (error) {
        console.error('Unable to restore the Supabase session:', error);
        applySession(null);
      } finally {
        if (mounted) {
          setLoading(false);
          setAuthInitializing(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, []);

  const runWithLoading = async <T,>(action: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      return await action();
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) =>
    runWithLoading(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    });

  const signUp = async (email: string, password: string, displayName: string) =>
    runWithLoading(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: emailRedirectUrl,
        },
      });
      if (error) throw error;
      setPendingEmail(data.user?.email ?? email);
      if (data.session) {
        setSession(data.session);
        setAuthUser(data.session.user);
      }
      return Boolean(data.session);
    });

  const logout = async () =>
    runWithLoading(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPendingEmail(null);
    });

  const resendVerificationEmail = async (requestedEmail?: string) =>
    runWithLoading(async () => {
      const email = requestedEmail?.trim().toLowerCase() ?? authUser?.email ?? pendingEmail;
      if (!email) throw new Error('No email address is available for verification.');
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: emailRedirectUrl },
      });
      if (error) throw error;
    });

  const checkEmailVerification = async () =>
    runWithLoading(async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setAuthUser(data.user);
      setSession((currentSession) =>
        currentSession ? { ...currentSession, user: data.user } : currentSession
      );
      return Boolean(data.user.email_confirmed_at);
    });

  const reloadUser = async () =>
    runWithLoading(async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setAuthUser(data.user);
      setSession((currentSession) =>
        currentSession ? { ...currentSession, user: data.user } : currentSession
      );
    });

  const isEmailVerified = Boolean(authUser?.email_confirmed_at);
  const clearAuthLinkMessage = () => setAuthLinkMessage(null);
  const user = useMemo(() => (authUser ? appUserFromAuthUser(authUser) : null), [authUser]);
  const firebaseUser = useMemo(
    () =>
      authUser
        ? { uid: authUser.id, emailVerified: Boolean(authUser.email_confirmed_at) }
        : null,
    [authUser]
  );

  const value: AuthContextType = {
    user,
    session,
    authUser,
    firebaseUser,
    isEmailVerified,
    authInitializing,
    authLinkMessage,
    loading,
    signIn,
    signUp,
    logout,
    sendEmailVerification: resendVerificationEmail,
    resendVerificationEmail,
    clearAuthLinkMessage,
    checkEmailVerification,
    reloadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
