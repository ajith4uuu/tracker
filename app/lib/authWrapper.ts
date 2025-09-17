import { FirebaseAuth } from "../firebaseConfig";

// In real mode, we delegate to firebase/auth. In dev/no-config mode, provide a small mock implementation
let usingFirebase = !!FirebaseAuth;

// Real implementations will be lazily imported when needed
let realOnAuthStateChanged: any = null;
let realSignInAnonymously: any = null;

if (usingFirebase) {
  // dynamic import so module resolution happens at runtime
  import('firebase/auth').then(mod => {
    realOnAuthStateChanged = mod.onAuthStateChanged;
    realSignInAnonymously = mod.signInAnonymously;
  }).catch((e) => {
    console.warn('Failed to load firebase/auth module:', e);
    usingFirebase = false;
  });
}

// Mock state for local/dev fallback
let mockUser: any = null;
const subscribers = new Set<Function>();

export function subscribeAuth(callback: (user: any) => void) {
  if (usingFirebase && realOnAuthStateChanged && FirebaseAuth) {
    try {
      return realOnAuthStateChanged(FirebaseAuth, callback);
    } catch (e) {
      console.warn('Error using real onAuthStateChanged, falling back to mock:', e);
    }
  }

  // mock: register subscriber and notify current state asynchronously
  subscribers.add(callback);
  setTimeout(() => callback(mockUser), 0);

  return () => subscribers.delete(callback);
}

export async function signInAnonymously() {
  if (usingFirebase && realSignInAnonymously && FirebaseAuth) {
    try {
      return realSignInAnonymously(FirebaseAuth);
    } catch (e) {
      console.warn('Error using real signInAnonymously, falling back to mock:', e);
    }
  }

  // mock sign-in: create a fake user and notify subscribers
  mockUser = { uid: 'dev-anon', isAnonymous: true };
  for (const cb of Array.from(subscribers)) {
    try { cb(mockUser); } catch (e) { /* ignore subscriber errors */ }
  }

  return Promise.resolve({ user: mockUser });
}
