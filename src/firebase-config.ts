import { initializeApp, FirebaseApp } from "firebase/app";
import type { FirebaseOptions } from "firebase/app";
import type { Analytics } from 'firebase/analytics';
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig as loadFirebaseConfig } from "./config/env";
import { logger } from "./utils/logger";

// CRITICAL FIX: Wrap Firebase initialization in try-catch to prevent crashes
// Initialization happens at module load but errors are caught gracefully
let _app: FirebaseApp | undefined;
let _analytics: Analytics | undefined;

const initFirebase = (): { auth: ReturnType<typeof getAuth>; db: ReturnType<typeof getFirestore>; storage: ReturnType<typeof getStorage> } | null => {
  try {
    const firebaseConfig = loadFirebaseConfig();

    if (import.meta.env.DEV) {
      logger.debug('Firebase Configuration Loaded', {
        apiKey: firebaseConfig.apiKey?.substring(0, 10) + '...',
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
      });
    }

    const firebaseOptions: FirebaseOptions = {
      apiKey: firebaseConfig.apiKey ?? "dummy-api-key",
      authDomain: firebaseConfig.authDomain ?? "localhost",
      projectId: firebaseConfig.projectId ?? "dummy-project",
      storageBucket: firebaseConfig.storageBucket ?? "dummy-project.appspot.com",
      messagingSenderId: firebaseConfig.messagingSenderId ?? "123456789",
      appId: firebaseConfig.appId ?? "1:123456789:web:dummy",
      ...(firebaseConfig.measurementId
        ? { measurementId: firebaseConfig.measurementId }
        : {}),
    };

    _app = initializeApp(firebaseOptions);
    
    if (firebaseConfig.measurementId && firebaseConfig.measurementId !== 'G-XXXXXXXXXX') {
      try {
        _analytics = getAnalytics(_app);
      } catch (error) {
        logger.warn('Firebase Analytics initialization failed', { error });
      }
    }
    
    return {
      auth: getAuth(_app),
      db: getFirestore(_app),
      storage: getStorage(_app),
    };
  } catch (error) {
    logger.error('Failed to initialize Firebase', error);
    return null;
  }
};

// Export services - if initialization failed, create mock objects to prevent crashes
// The mock objects will only throw when their methods are actually called
const createMockAuth = () => ({
  currentUser: null,
  onAuthStateChanged: () => () => {},
  signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase not initialized')),
  createUserWithEmailAndPassword: () => Promise.reject(new Error('Firebase not initialized')),
  signOut: () => Promise.reject(new Error('Firebase not initialized')),
});

const createMockFirestore = () => ({
  collection: () => ({ doc: () => ({ get: () => Promise.reject(new Error('Firebase not initialized')) }) }),
  doc: () => ({ get: () => Promise.reject(new Error('Firebase not initialized')) }),
});

const createMockStorage = () => ({
  ref: () => ({ child: () => ({ put: () => Promise.reject(new Error('Firebase not initialized')) }) }),
});

const firebaseServices = initFirebase();

// Export services - use mocks if initialization failed
export const auth = firebaseServices?.auth ?? createMockAuth();
export const db = firebaseServices?.db ?? createMockFirestore();
export const storage = firebaseServices?.storage ?? createMockStorage();
export const app = _app;
export const analytics = _analytics ?? null;
