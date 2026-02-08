import { initializeApp } from "firebase/app";
import type { FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig as loadFirebaseConfig } from "./config/env";
import { logger } from "./utils/logger";

// Initialisera Firebase-applikationen med den validerade konfigurationen
const firebaseConfig = loadFirebaseConfig();

// Production build: No console output for security
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

// Kontrollera om någon av de nödvändiga variablerna saknas
const missingKeys = Object.entries(firebaseConfig).filter(
  ([key, value]) => {
    // measurementId is optional, don't warn about it
    if (key === 'measurementId') return false;
    return !value || (typeof value === 'string' && value.startsWith("dummy"));
  }
);

if (missingKeys.length > 0 && import.meta.env.DEV) {
  logger.warn(
    `Firebase-konfiguration saknas för följande nycklar: ${missingKeys
      .map(([key]) => key)
      .join(", ")}. Firebase-funktioner kommer inte att fungera.`
  );
}

// Initialisera appen
const app = initializeApp(firebaseOptions);

// Initialisera Analytics om measurementId finns - DISABLED to prevent 403 errors
import type { Analytics } from 'firebase/analytics';
const analytics: Analytics | null = null;
// Analytics disabled to prevent permission errors in production
// if (firebaseConfig.measurementId && firebaseConfig.measurementId !== 'G-XXXXXXXXXX' && firebaseConfig.measurementId !== undefined) {
//   try {
//     analytics = getAnalytics(app);
//   } catch (error) {
//     logger.warn('Firebase Analytics initialization failed', { error });
//   }
// }

// Exportera de nödvändiga Firebase-tjänsterna
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app, analytics };
