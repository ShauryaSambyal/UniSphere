import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';

const env = import.meta.env;

const BUNDLED_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDlgv5EAu48EWb_SI1aNkINV5uorAFa-90',
  authDomain: 'unisphere-ae503.firebaseapp.com',
  projectId: 'unisphere-ae503',
  storageBucket: 'unisphere-ae503.firebasestorage.app',
  messagingSenderId: '875621569702',
  appId: '1:875621569702:web:07524372adc159ed0e1067'
};

const projectId = env.VITE_FIREBASE_PROJECT_ID || BUNDLED_FIREBASE_CONFIG.projectId;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || BUNDLED_FIREBASE_CONFIG.apiKey,
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : ''),
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || BUNDLED_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || BUNDLED_FIREBASE_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || BUNDLED_FIREBASE_CONFIG.appId
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let firebaseAuth = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    firebaseAuth = getAuth(app);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    firebaseAuth = null;
  }
}

export const auth = firebaseAuth;

export function firebaseErrorMessage(error) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/account-exists-with-different-credential':
      return 'That email is already linked to a different sign-in method.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in your Firebase project yet.';
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized in Firebase. Add it under Authentication settings.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase API key is invalid. Check the VITE_FIREBASE_* values.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase. Check your connection.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutFirebase() {
  if (auth) await signOut(auth);
}

export { onAuthStateChanged };
