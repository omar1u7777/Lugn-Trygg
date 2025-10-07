import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Funktion för att säkerställa att miljövariabler är korrekt definierade
const getFirebaseConfig = () => {
  const config: { [key: string]: string } = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'dummy-api-key',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dummy.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dummy-project',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dummy-project.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:dummy',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-XXXXXXXXXX',
  };

  // Kontrollera om någon av de nödvändiga variablerna saknas
  const missingKeys = Object.keys(config).filter((key) => !config[key] || config[key].startsWith('dummy'));

  if (missingKeys.length > 0) {
    console.warn(`⚠️ Firebase-konfiguration saknas för följande nycklar: ${missingKeys.join(", ")}. Firebase-funktioner kommer inte att fungera.`);
  }

  return config;
};

// Initialisera Firebase-applikationen med den validerade konfigurationen
const firebaseConfig = getFirebaseConfig();

// Initialisera appen
const app = initializeApp(firebaseConfig);

// Initialisera Analytics om measurementId finns
let analytics: any = null;
if (firebaseConfig.measurementId && firebaseConfig.measurementId !== 'G-XXXXXXXXXX') {
  analytics = getAnalytics(app);
}

// Exportera de nödvändiga Firebase-tjänsterna
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { analytics };
