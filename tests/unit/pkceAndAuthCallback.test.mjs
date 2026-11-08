import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { installPkceCrypto } from '../../src/services/pkceCrypto.ts';
import { parseAuthCallbackUrl } from '../../src/utils/authCallback.ts';

test('auth callback parser reads query and fragment values and reports malformed input', () => {
  assert.deepEqual(
    parseAuthCallbackUrl('cashbook://auth/callback?code=query-code'),
    { code: 'query-code' }
  );
  assert.deepEqual(
    parseAuthCallbackUrl('cashbook://auth/callback#code=fragment-code'),
    { code: 'fragment-code' }
  );
  assert.deepEqual(
    parseAuthCallbackUrl('cashbook://auth/callback#error=access_denied&error_description=User+cancelled'),
    { error: 'access_denied', errorDescription: 'User cancelled' }
  );
  assert.deepEqual(parseAuthCallbackUrl('not a url'), {
    error: 'invalid_callback_url',
    errorDescription: 'The sign-in redirect URL is invalid.',
  });
});

test('PKCE shim provides SHA-256 and Supabase generates the S256 challenge', async () => {
  assert.equal(typeof TextEncoder, 'function', 'Node provides the TextEncoder used by the React Native runtime');

  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalMathRandom = Math.random;
  const knownVerifier = 'ab'.repeat(56);
  const randomByteLengths = [];
  const randomValues = (typedArray) => {
    randomByteLengths.push(typedArray.byteLength);
    new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength).fill(0xab);
    return typedArray;
  };

  try {
    const crypto = installPkceCrypto(globalThis, {
      digest: webcrypto.subtle.digest.bind(webcrypto.subtle),
      getRandomValues: randomValues,
    });
    assert.equal(typeof crypto.subtle.digest, 'function');
    assert.equal(typeof crypto.getRandomValues, 'function');

    const abcDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
    assert.equal(
      Buffer.from(abcDigest).toString('hex'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );

    Math.random = () => { throw new Error('PKCE must not fall back to Math.random'); };
    const storage = {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    const supabase = createClient('https://cashbook-pkce-test.supabase.co', 'test-anon-key', {
      auth: {
        flowType: 'pkce',
        storage,
        storageKey: 'cashbook-pkce-test',
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'cashbook://auth/callback',
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    assert.equal(error, null);
    assert.ok(data.url);

    const authUrl = new URL(data.url);
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 's256');
    assert.deepEqual(randomByteLengths, [224, 16], 'Supabase uses the supplied secure random provider for its verifier and flow id');

    const expectedDigest = await webcrypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(knownVerifier)
    );
    assert.equal(
      authUrl.searchParams.get('code_challenge'),
      Buffer.from(expectedDigest).toString('base64url')
    );
  } finally {
    Math.random = originalMathRandom;
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
});
