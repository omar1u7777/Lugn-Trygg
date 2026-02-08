import type { Auth } from "firebase/auth";
import type { Messaging } from "firebase/messaging";

type AuthModule = typeof import("firebase/auth");
type MessagingModule = typeof import("firebase/messaging");

interface FirebaseAuthBundle {
  firebaseAuth: Auth;
  authModule: AuthModule;
}

interface FirebaseMessagingBundle {
  firebaseMessaging: Messaging;
  messagingModule: MessagingModule;
}

let authBundlePromise: Promise<FirebaseAuthBundle> | null = null;
let messagingBundlePromise: Promise<FirebaseMessagingBundle> | null = null;

const loadFirebaseConfigModule = () => import("../firebase-config");

export const loadFirebaseAuthBundle = async (): Promise<FirebaseAuthBundle> => {
  if (!authBundlePromise) {
    authBundlePromise = Promise.all([
      import("firebase/auth"),
      loadFirebaseConfigModule(),
    ]).then(([authModule, firebaseConfig]) => ({
      authModule,
      firebaseAuth: firebaseConfig.auth,
    }));
  }

  return authBundlePromise;
};

export const loadFirebaseMessagingBundle = async (): Promise<FirebaseMessagingBundle> => {
  if (!messagingBundlePromise) {
    messagingBundlePromise = Promise.all([
      import("firebase/messaging"),
      loadFirebaseConfigModule(),
    ]).then(([messagingModule, firebaseConfig]) => ({
      messagingModule,
      firebaseMessaging: messagingModule.getMessaging(firebaseConfig.app),
    }));
  }

  return messagingBundlePromise;
};
