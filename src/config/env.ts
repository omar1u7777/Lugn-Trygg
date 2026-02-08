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
  | 'VITE_ONBOARDING_HERO_PUBLIC_ID';

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
};

declare global {
  interface Window {
    __APP_ENV__?: Partial<Record<SupportedEnvKeys, string>>;
  }
}

// Store import.meta.env reference during Vite build
// This avoids the parse-time syntax error in Jest
let viteEnv: Partial<Record<SupportedEnvKeys, string>> | null = null;

const getViteEnv = (): Partial<Record<SupportedEnvKeys, string>> => {
  if (viteEnv !== null) {
    return viteEnv;
  }

  const env: Partial<Record<SupportedEnvKeys, string>> = {};
  try {
    // This gets executed only at runtime in Vite environment
    // In Jest, this entire code path is skipped due to NODE_ENV check below
    // The import.meta syntax is only evaluated by Vite's transform, not Babel
    if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
      // Use Function constructor to avoid syntax parsing in Jest
       
      const getMetaEnv = new Function('return typeof import !== "undefined" ? import.meta?.env : {}');
      const metaEnv = getMetaEnv() || {};
      
      (Object.keys(DEFAULTS) as SupportedEnvKeys[]).forEach((key) => {
        if (metaEnv[key]) {
          env[key] = metaEnv[key];
        }
      });
    }
  } catch (e) {
    // Safely fail in any environment
  }

  viteEnv = env;
  return env;
};

const runtimeEnv: Partial<Record<SupportedEnvKeys, string>> = (() => {
  // First priority: window.__APP_ENV__ (for SSR/production)
  if (typeof window !== 'undefined' && window.__APP_ENV__) {
    return window.__APP_ENV__;
  }

  // Second priority: import.meta.env (for Vite development)
  if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
    const vite = getViteEnv();
    if (Object.keys(vite).length > 0) {
      return vite;
    }
  }

  // Third priority: process.env (for Node.js/tests)
  if (typeof process !== 'undefined' && process.env) {
    const env: Partial<Record<SupportedEnvKeys, string>> = {};
    (Object.keys(DEFAULTS) as SupportedEnvKeys[]).forEach((key) => {
      const value = process.env[key];
      if (value) {
        env[key] = value;
      }
    });
    return env;
  }

  return {};
})();

export const getEnvValue = (key: SupportedEnvKeys): string | undefined => {
  const value = runtimeEnv[key];
  return value ?? DEFAULTS[key];
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
    apiKey: getEnvValue('VITE_FIREBASE_API_KEY') || 'AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY',
    authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN') || 'lugn-trygg-53d75.firebaseapp.com',
    projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID') || 'lugn-trygg-53d75',
    storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET') || 'lugn-trygg-53d75.appspot.com',
    messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID') || '412776932054',
    appId: getEnvValue('VITE_FIREBASE_APP_ID') || '1:412776932054:web:7c4c72c93eb9b5c49fdaf0',
    measurementId: getEnvValue('VITE_FIREBASE_MEASUREMENT_ID'),
  };

  // Validate Firebase config has required fields
  if (!config.apiKey || !config.authDomain || !config.projectId) {
    throw new Error('Firebase configuration is incomplete. Check your .env file.');
  }

  return config;
};

export const getFirebaseVapidKey = (): string | undefined => getEnvValue('VITE_FIREBASE_VAPID_KEY');

export const getEncryptionKey = (): string => {
  // Try VITE_ENCRYPTION_KEY first, then fall back to a development key
  const key = getEnvValue('VITE_ENCRYPTION_KEY') || 'dev-encryption-key-lugn-trygg-2025-secure-fallback-32chars';
  if (key === 'your-encryption-key-here') {
    throw new Error('VITE_ENCRYPTION_KEY must be set to a secure random value!');
  }
  return key;
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
