/// <reference types="vite/client" />

//  Definiera miljövariabler som används i frontend-applikationen
interface ImportMetaEnv extends Readonly<Record<string, string | undefined>> {
  //  Backend API-adress (Obligatorisk)
  readonly VITE_API_BASE_URL: string; // 🔗 API-url som frontend använder för att kommunicera med backend

  //  Firebase konfiguration
  readonly VITE_FIREBASE_API_KEY: string; //  API-nyckel för Firebase
  readonly VITE_FIREBASE_AUTH_DOMAIN: string; //  Autentiseringsdomän
  readonly VITE_FIREBASE_PROJECT_ID: string; //  Firebase Projekt-ID
  readonly VITE_FIREBASE_STORAGE_BUCKET: string; //  Lagringsplats i Firebase
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string; //  Messaging ID för push-notiser
  readonly VITE_FIREBASE_APP_ID: string; // 🔹 Firebase App ID

  //  Firebase Analytics (valfritt)
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string; //  Google Analytics ID, används om aktiverat

  //  Miljö (Development, Staging, Production)
  readonly VITE_ENVIRONMENT: "development" | "staging" | "production"; //  Indikerar vilken miljö som körs
}

//  Säkerställ att ImportMeta innehåller dessa miljövariabler
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
