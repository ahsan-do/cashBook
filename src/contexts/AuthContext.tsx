import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { EmailOtpType, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { getAuthCallbackParameter, parseAuthCallbackUrl } from '../utils/authCallback';
import { User } from '../types';

const emailRedirectUrl = Linking.createURL('auth/callback');
const oauthRedirectUrl = 'cashbook://auth/callback';
const supportedOtpTypes = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  authUser: SupabaseUser | null;
  isEmailVerified: boolean;
  authInitializing: boolean;
  authLinkMessage: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authLinkMessage, setAuthLinkMessage] = useState<string | null>(null);
  const oauthFlowActive = useRef(false);
  const mounted = useRef(true);

  const applySession = useCallback((nextSession: Session | null) => {
    if (!mounted.current) return;
    setSession(nextSession);
    setAuthUser(nextSession?.user ?? null);
    if (!nextSession || nextSession.user.email_confirmed_at) {
      setPendingEmail(null);
    }
  }, []);

  const completeAuthCallback = useCallback(async (url: string, publishMessage = true) => {
    const parsedLink = Linking.parse(url);
    const path = [parsedLink.hostname, parsedLink.path]
      .filter(Boolean)
      .join('/')
      .replace(/^\/+/, '');
    if (path !== 'auth/callback') return { ignored: true as const };

    const callback = parseAuthCallbackUrl(url);
    const tokenHash = getAuthCallbackParameter(url, 'token_hash');
    const otpType = getAuthCallbackParameter(url, 'type');
    const handleError = (code: string, description: string) => {
      const message = code === 'otp_expired' || /expired|already been used|invalid.*link/i.test(description)
        ? 'This confirmation link has expired or has already been used. Request a new confirmation email to continue.'
        : `The sign-in link could not be completed: ${description}`;
      if (publishMessage) setAuthLinkMessage(message);
      return { error: message };
    };

    if ('error' in callback && callback.error !== 'missing_code') {
      return handleError(callback.error, callback.errorDescription);
    }

    if (tokenHash && otpType && supportedOtpTypes.has(otpType as EmailOtpType)) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as EmailOtpType,
      });
      if (error) return handleError(error.code ?? 'otp_error', error.message);
      applySession(data.session);
      setAuthLinkMessage(null);
      return {};
    }

    if ('error' in callback) return handleError(callback.error, callback.errorDescription);

    const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
    if (error) return handleError(error.code ?? 'exchange_error', error.message);
    applySession(data.session);
    setAuthLinkMessage(null);
    return {};
  }, [applySession]);

  useEffect(() => {
    mounted.current = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    const linkListener = Linking.addEventListener('url', ({ url }) => {
      if (oauthFlowActive.current) return;
      void completeAuthCallback(url).catch((error: unknown) => {
        console.error('Unable to complete the Supabase auth link:', error);
        setAuthLinkMessage('The confirmation link could not be completed. Request a new confirmation email and try again.');
      });
    });

    const initializeAuth = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await completeAuthCallback(initialUrl);
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        applySession(data.session);
      } catch (error) {
        console.error('Unable to restore the Supabase session:', error);
        applySession(null);
      } finally {
        if (mounted.current) {
          setLoading(false);
          setAuthInitializing(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      mounted.current = false;
      authListener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, [applySession, completeAuthCallback]);

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

  const signInWithGoogle = async () =>
    runWithLoading(async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: oauthRedirectUrl,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in could not be started. Please try again.');

      const challengeMethod = new URL(data.url).searchParams.get('code_challenge_method');
      
      if (challengeMethod !== 's256') {
        throw new Error('Secure Google sign-in could not be started. Please try again.');
      }

      oauthFlowActive.current = true;
      try {
        const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectUrl);
        if (result.type === 'cancel' || result.type === 'dismiss') return;
        if (result.type !== 'success' || !result.url) {
          throw new Error('Google sign-in did not return a valid response. Please try again.');
        }

        const callbackResult = await completeAuthCallback(result.url, false);
        if ('error' in callbackResult) throw new Error(callbackResult.error);
        if ('ignored' in callbackResult) {
          throw new Error('Google sign-in returned an unexpected redirect. Please try again.');
        }
      } finally {
        oauthFlowActive.current = false;
      }
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
  const value: AuthContextType = {
    user,
    session,
    authUser,
    isEmailVerified,
    authInitializing,
    authLinkMessage,
    loading,
    signIn,
    signInWithGoogle,
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
