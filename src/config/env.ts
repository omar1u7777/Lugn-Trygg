type SupportedEnvKeys =
  | 'VITE_BACKEND_URL'
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_FIREBASE_MEASUREMENT_ID'
  | 'VITE_FIREBASE_VAPID_KEY'
  | 'VITE_ENCRYPTION_KEY'
  | 'VITE_DASHBOARD_HERO_PUBLIC_ID'
  | 'VITE_WELLNESS_HERO_PUBLIC_ID'
  | 'VITE_JOURNAL_HERO_PUBLIC_ID'
  | 'VITE_ONBOARDING_HERO_PUBLIC_ID'
  | 'VITE_STRIPE_PUBLISHABLE_KEY';

// ⚠️ SECURITY: NO DEFAULT VALUES FOR SENSITIVE KEYS!
// All sensitive configuration MUST be set via environment variables.
// This prevents accidental exposure of credentials in source code.
const DEFAULTS: Record<SupportedEnvKeys, string | undefined> = {
  VITE_BACKEND_URL: 'http://localhost:5001',  // Development default
  VITE_FIREBASE_API_KEY: undefined,  // ✅ REQUIRED: Must be set via .env
  VITE_FIREBASE_AUTH_DOMAIN: undefined,  // ✅ REQUIRED: Must be set via .env
  VITE_FIREBASE_PROJECT_ID: undefined,  // ✅ REQUIRED: Must be set via .env
  VITE_FIREBASE_STORAGE_BUCKET: undefined,  // ✅ REQUIRED: Must be set via .env
  VITE_FIREBASE_MESSAGING_SENDER_ID: undefined,  // ✅ REQUIRED: Must be set via .env
  VITE_FIREBASE_APP_ID: undefined,  // ✅ REQUIRED: Must be set via .env
  VITE_FIREBASE_MEASUREMENT_ID: undefined,  // Optional: Analytics measurement ID
  VITE_FIREBASE_VAPID_KEY: undefined,  // Optional: Push notifications VAPID key
  VITE_ENCRYPTION_KEY: undefined,  // ✅ REQUIRED: Must be set via .env - NEVER hardcode!
  VITE_DASHBOARD_HERO_PUBLIC_ID: undefined,  // Optional Cloudinary public ID for dashboard hero
  VITE_WELLNESS_HERO_PUBLIC_ID: undefined,  // Optional Cloudinary public ID for wellness hero artwork
  VITE_JOURNAL_HERO_PUBLIC_ID: undefined,  // Optional Cloudinary public ID for journal hero artwork
  VITE_ONBOARDING_HERO_PUBLIC_ID: undefined,  // Optional Cloudinary public ID for onboarding hero artwork
  VITE_STRIPE_PUBLISHABLE_KEY: undefined,  // Optional: Stripe publishable key (pk_live_... or pk_test_...) for Stripe Elements
};

declare global {
  interface Window {
    __APP_ENV__?: Partial<Record<SupportedEnvKeys, string>>;
  }
}

// Helper: read a single key from import.meta.env.
// Uses explicit property access so Vite's source transform can detect each
// reference.  The previous dynamic-iteration approach (metaEnv[key]) was
// unreliable because Vite's dev-server transform sometimes failed to
// recognise the access, returning undefined for every key.
const readViteKey = (key: SupportedEnvKeys): string | undefined => {
  try {
    // In test environments import.meta.env is unavailable.
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return undefined;
    }
    // Explicit map so Vite statically replaces each reference:
    switch (key) {
      case 'VITE_BACKEND_URL':                   return import.meta.env.VITE_BACKEND_URL;
      case 'VITE_FIREBASE_API_KEY':              return import.meta.env.VITE_FIREBASE_API_KEY;
      case 'VITE_FIREBASE_AUTH_DOMAIN':          return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
      case 'VITE_FIREBASE_PROJECT_ID':           return import.meta.env.VITE_FIREBASE_PROJECT_ID;
      case 'VITE_FIREBASE_STORAGE_BUCKET':       return import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
      case 'VITE_FIREBASE_MESSAGING_SENDER_ID':  return import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
      case 'VITE_FIREBASE_APP_ID':               return import.meta.env.VITE_FIREBASE_APP_ID;
      case 'VITE_FIREBASE_MEASUREMENT_ID':       return import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
      case 'VITE_FIREBASE_VAPID_KEY':            return import.meta.env.VITE_FIREBASE_VAPID_KEY;
      case 'VITE_ENCRYPTION_KEY':                return import.meta.env.VITE_ENCRYPTION_KEY;
      case 'VITE_DASHBOARD_HERO_PUBLIC_ID':      return import.meta.env.VITE_DASHBOARD_HERO_PUBLIC_ID;
      case 'VITE_WELLNESS_HERO_PUBLIC_ID':       return import.meta.env.VITE_WELLNESS_HERO_PUBLIC_ID;
      case 'VITE_JOURNAL_HERO_PUBLIC_ID':        return import.meta.env.VITE_JOURNAL_HERO_PUBLIC_ID;
      case 'VITE_ONBOARDING_HERO_PUBLIC_ID':     return import.meta.env.VITE_ONBOARDING_HERO_PUBLIC_ID;
      case 'VITE_STRIPE_PUBLISHABLE_KEY':         return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      default:                                   return undefined;
    }
  } catch {
    return undefined;
  }
};

export const getEnvValue = (key: SupportedEnvKeys): string | undefined => {
  // 1. window.__APP_ENV__ (runtime injection for SSR / production)
  if (typeof window !== 'undefined' && window.__APP_ENV__?.[key]) {
    return window.__APP_ENV__[key];
  }

  // 2. import.meta.env (Vite dev & build – explicit per-key access)
  const viteVal = readViteKey(key);
  if (viteVal) return viteVal;

  // 3. process.env (Node / tests)
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }

  // 4. Coded defaults (e.g. VITE_BACKEND_URL → localhost:5001)
  return DEFAULTS[key];
};

// ✅ Validation: Ensure critical environment variables are set
const validateRequiredEnvVars = () => {
  const required: SupportedEnvKeys[] = [
    'VITE_BACKEND_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_ENCRYPTION_KEY',
  ];

  const missing = required.filter(key => {
    const value = getEnvValue(key);
    return !value || value === 'your-encryption-key-here' || value === 'undefined';
  });

  if (missing.length > 0 && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
    const errorMsg = `
❌ CRITICAL: Missing required environment variables!

Missing: ${missing.join(', ')}

Please create a .env file with:
${missing.map(key => `${key}=your-actual-value-here`).join('\n')}

See .env.example for template.
    `.trim();
    
    console.error(errorMsg);
    
    // In production, throw error to prevent app from running with invalid config
    if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
      throw new Error('Missing required environment variables. Check console for details.');
    }
  }
};

// Run validation on module load (but not during tests)
if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
  validateRequiredEnvVars();
}

export const getBackendUrl = (): string => {
  const url = getEnvValue('VITE_BACKEND_URL');
  if (!url) {
    throw new Error('VITE_BACKEND_URL is required but not set!');
  }
  return url;
};

export const getFirebaseConfig = () => {
  const config = {
    apiKey: getEnvValue('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvValue('VITE_FIREBASE_APP_ID'),
    measurementId: getEnvValue('VITE_FIREBASE_MEASUREMENT_ID'),
  };

  // Validate Firebase config has required fields
  if (!config.apiKey || !config.authDomain || !config.projectId) {
    throw new Error('Firebase configuration is incomplete. Check your .env file.');
  }

  return config;
};

export const getFirebaseVapidKey = (): string | undefined => getEnvValue('VITE_FIREBASE_VAPID_KEY');

/**
 * Returns the Stripe publishable key (pk_test_... or pk_live_...) from the environment.
 * Used by SubscriptionForm to show whether Stripe is configured.
 * Not strictly required for the Stripe Checkout (redirect) flow — only needed for Elements.
 */
export const getStripePublishableKey = (): string | undefined => getEnvValue('VITE_STRIPE_PUBLISHABLE_KEY');

// Lazily-generated fallback so the app can boot even
// when VITE_ENCRYPTION_KEY is missing from the environment.
let _generatedFallbackKey: string | null = null;

export const getEncryptionKey = (): string => {
  const key = getEnvValue('VITE_ENCRYPTION_KEY');
  // Reject common placeholder patterns
  if (key && key !== 'your-encryption-key-here' && !key.startsWith('your-')) {
    return key;
  }

  // In production, refuse to start with a missing key — encrypted data would be
  // permanently lost on every page refresh.
  const isProduction =
    typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
  if (isProduction) {
    throw new Error(
      '[C4] VITE_ENCRYPTION_KEY is not set in production. '
      + 'Encrypted data (journals, memories) will be unreadable. '
      + 'Generate a key with: python -c "import secrets; print(secrets.token_urlsafe(32))" '
      + 'and set VITE_ENCRYPTION_KEY in your frontend .env (same value as ENCRYPTION_KEY in backend).',
    );
  }

  // Development only: generate a per-session random key so the app can boot
  // without a .env file. Data encrypted with this key will NOT survive a page
  // refresh — this is intentional and acceptable in local development.
  if (!_generatedFallbackKey) {
    _generatedFallbackKey = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    console.warn(
      '[env] VITE_ENCRYPTION_KEY is not set – using a per-session random key (dev only). '
      + 'Set VITE_ENCRYPTION_KEY in your .env for persistent encrypted storage.',
    );
  }
  return _generatedFallbackKey;
};

const DEFAULT_DASHBOARD_HERO_PUBLIC_ID = 'hero-bild_pfcdsx';
const DEFAULT_WELLNESS_HERO_PUBLIC_ID = 'hero-bild_pfcdsx';
const DEFAULT_JOURNAL_HERO_PUBLIC_ID = 'hero-bild_pfcdsx';
const DEFAULT_ONBOARDING_HERO_PUBLIC_ID = 'hero-bild_pfcdsx';

export const getDashboardHeroImageId = (): string => {
  return getEnvValue('VITE_DASHBOARD_HERO_PUBLIC_ID') || DEFAULT_DASHBOARD_HERO_PUBLIC_ID;
};

export const getWellnessHeroImageId = (): string => {
  return getEnvValue('VITE_WELLNESS_HERO_PUBLIC_ID') || DEFAULT_WELLNESS_HERO_PUBLIC_ID;
};

export const getJournalHeroImageId = (): string => {
  return getEnvValue('VITE_JOURNAL_HERO_PUBLIC_ID') || DEFAULT_JOURNAL_HERO_PUBLIC_ID;
};

export const getOnboardingHeroImageId = (): string => {
  return getEnvValue('VITE_ONBOARDING_HERO_PUBLIC_ID') || DEFAULT_ONBOARDING_HERO_PUBLIC_ID;
};

export const isDevEnvironment = (): boolean => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }

  if (typeof window !== 'undefined') {
    const envFlag = window.__APP_ENV__?.VITE_BACKEND_URL;
    return (envFlag ?? '').includes('localhost');
  }

  return true;
};
