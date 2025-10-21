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
  | 'VITE_ENCRYPTION_KEY';

const DEFAULTS: Record<SupportedEnvKeys, string | undefined> = {
  VITE_BACKEND_URL: 'http://localhost:5001',
  VITE_FIREBASE_API_KEY: 'AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY',
  VITE_FIREBASE_AUTH_DOMAIN: 'lugn-trygg-53d75.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'lugn-trygg-53d75',
  VITE_FIREBASE_STORAGE_BUCKET: 'lugn-trygg-53d75',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '111615148451906030622',
  VITE_FIREBASE_APP_ID: '1:111615148451:web:1b1b1b1b1b1b1b1b1b1b1b',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-1B1B1B1B1B',
  VITE_FIREBASE_VAPID_KEY: 'dummy-vapid-key',
  VITE_ENCRYPTION_KEY: undefined,
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
      // eslint-disable-next-line no-new-func
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

export const getBackendUrl = (): string => getEnvValue('VITE_BACKEND_URL') ?? 'http://localhost:5001';

export const getFirebaseConfig = () => ({
  apiKey: getEnvValue('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvValue('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvValue('VITE_FIREBASE_MEASUREMENT_ID'),
});

export const getFirebaseVapidKey = (): string | undefined => getEnvValue('VITE_FIREBASE_VAPID_KEY');

export const getEncryptionKey = (): string | undefined => getEnvValue('VITE_ENCRYPTION_KEY');

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
