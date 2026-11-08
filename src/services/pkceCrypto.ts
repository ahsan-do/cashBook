export interface PkceCryptoPrimitives {
  digest: SubtleCrypto['digest'];
  getRandomValues: Crypto['getRandomValues'];
}

export interface PkceCryptoHost {
  crypto?: Crypto;
  TextEncoder?: typeof TextEncoder;
}

/** Installs only the WebCrypto primitives Supabase Auth needs for PKCE. */
export const installPkceCrypto = (
  host: PkceCryptoHost,
  primitives: PkceCryptoPrimitives
): Crypto => {
  if (typeof host.TextEncoder !== 'function') {
    throw new Error('TextEncoder is required for secure PKCE in this JavaScript runtime.');
  }

  const existingCrypto = host.crypto;
  const existingSubtle = existingCrypto?.subtle;
  const subtle = new Proxy(existingSubtle ?? {}, {
    get(target, property) {
      if (property === 'digest') return primitives.digest;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as SubtleCrypto;
  const crypto = new Proxy(existingCrypto ?? {}, {
    get(target, property) {
      if (property === 'getRandomValues') return primitives.getRandomValues;
      if (property === 'subtle') return subtle;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Crypto;

  Object.defineProperty(host, 'crypto', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: crypto,
  });

  if (typeof crypto.subtle.digest !== 'function' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure WebCrypto primitives could not be installed for PKCE.');
  }

  return crypto;
};
