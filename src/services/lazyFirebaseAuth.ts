import type { Auth } from "firebase/auth"

interface FirebaseAuthBundle {
  firebaseAuth: Auth
  authModule: typeof import("firebase/auth")
}

let firebaseAuthBundlePromise: Promise<FirebaseAuthBundle> | null = null

export const loadFirebaseAuthBundle = async (): Promise<FirebaseAuthBundle> => {
  if (!firebaseAuthBundlePromise) {
    firebaseAuthBundlePromise = Promise.all([
      import("firebase/auth"),
      import("../firebase-config"),
    ]).then(([authModule, firebaseConfig]) => ({
      authModule,
      firebaseAuth: firebaseConfig.auth,
    }))
  }

  return firebaseAuthBundlePromise
}
