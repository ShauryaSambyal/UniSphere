import { getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';

/**
 * Firebase configuration comes from client/.env (VITE_FIREBASE_*).
 * When the keys are missing, the app keeps working with the built-in JWT
 * auth instead of crashing on import.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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
    console.error('Firebase initialization failed. Falling back to built-in auth:', error);
    firebaseAuth = null;
  }
}

export const auth = firebaseAuth;

/**
 * Turns raw Firebase error codes into messages a student can understand.
 */
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
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in your Firebase project yet.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase API key is invalid. Check the VITE_FIREBASE_* values in client/.env.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase. Check your connection.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
}

export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signUpWithEmail(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }
  return credential.user;
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutFirebase() {
  if (auth) await signOut(auth);
}

export { onAuthStateChanged };
