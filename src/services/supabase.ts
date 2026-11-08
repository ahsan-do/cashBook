import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';
import { createClient } from '@supabase/supabase-js';
import { installPkceCrypto, PkceCryptoHost } from './pkceCrypto';

installPkceCrypto(globalThis as unknown as PkceCryptoHost, {
  digest: (algorithm, data) => {
    if (algorithm !== 'SHA-256') {
      return Promise.reject(new Error(`Unsupported PKCE digest algorithm: ${algorithm}`));
    }
    return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
  },
  getRandomValues: ExpoCrypto.getRandomValues as Crypto['getRandomValues'],
});

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
