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

  // mock sign-in: create a stable pseudo-UID so resume code isn't always the same
  try {
    const key = 'pt_mock_uid';
    let uid = null;
    if (typeof window !== 'undefined') {
      uid = window.localStorage.getItem(key);
      if (!uid) {
        uid = 'anon-' + Math.random().toString(36).slice(2, 10);
        window.localStorage.setItem(key, uid);
      }
    } else {
      uid = 'anon-' + Math.random().toString(36).slice(2, 10);
    }
    mockUser = { uid, isAnonymous: true };
  } catch {
    mockUser = { uid: 'anon-' + Math.random().toString(36).slice(2, 10), isAnonymous: true } as any;
  }

  for (const cb of Array.from(subscribers)) {
    try { cb(mockUser); } catch (e) { /* ignore subscriber errors */ }
  }

  return Promise.resolve({ user: mockUser });
}
