export type AuthCallbackResult =
  | { code: string }
  | { error: string; errorDescription: string };

const invalidUrlResult: AuthCallbackResult = {
  error: 'invalid_callback_url',
  errorDescription: 'The sign-in redirect URL is invalid.',
};

const callbackParameters = (rawUrl: string): URLSearchParams | null => {
  try {
    const url = new URL(rawUrl);
    const params = new URLSearchParams(url.search);
    const fragment = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    fragment.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
    return params;
  } catch {
    return null;
  }
};

export const getAuthCallbackParameter = (rawUrl: string, key: string): string | null =>
  callbackParameters(rawUrl)?.get(key) ?? null;

export const parseAuthCallbackUrl = (rawUrl: string): AuthCallbackResult => {
  const params = callbackParameters(rawUrl);
  if (!params) return { ...invalidUrlResult };

  const error = params.get('error') ?? params.get('error_code');
  const errorDescription = params.get('error_description') ?? params.get('error_reason');
  if (error || errorDescription) {
    return {
      error: error ?? 'oauth_error',
      errorDescription: errorDescription ?? error ?? 'The sign-in request failed.',
    };
  }

  const code = params.get('code');
  if (code) return { code };

  return {
    error: 'missing_code',
    errorDescription: 'The sign-in redirect did not include an authorization code.',
  };
};
