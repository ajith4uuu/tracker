import { getAuth } from "@firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Read environment variables safely
const env: any = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : {};
const firebaseApiKey = env.VITE_FIREBASE_API_KEY;

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

let FirebaseApp: any = null;
let FirebaseDB: any = null;
let FirebaseAuth: any = null;
let FirebaseStorage: any = null;

if (firebaseApiKey) {
  try {
    FirebaseApp = initializeApp(firebaseConfig);

    FirebaseDB = getFirestore(FirebaseApp);
    FirebaseAuth = getAuth(FirebaseApp);
    FirebaseStorage = getStorage(FirebaseApp);
  } catch (error) {
    // Initialization failed (invalid config / runtime issue) — keep app running without Firebase
    // Log for debugging but do not throw to avoid crashing the whole app
    // eslint-disable-next-line no-console
    console.warn('Firebase initialization failed:', error);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn('Firebase API key not provided. Skipping Firebase initialization.');
}

export { FirebaseDB, FirebaseAuth, FirebaseStorage };
