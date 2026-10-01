import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import {
  auth,
  firebaseErrorMessage,
  isFirebaseConfigured,
  onAuthStateChanged,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutFirebase
} from '../services/firebase';

const AuthContext = createContext();

const SYNC_FALLBACK_MESSAGE =
  'Signed in with Google, but the backend could not verify the session. Check FIREBASE_PROJECT_ID in server/.env.';

const NOT_CONFIGURED_MESSAGE =
  'Google sign-in is not configured yet. Add the VITE_FIREBASE_* keys to client/.env, then restart the dev server.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Exchanges a Firebase ID token for the app's own JWT (plus the database
   * user record with its role), so every protected API keeps working.
   */
  const syncWithBackend = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await api.post('/auth/firebase', { idToken });

      const { token, user: syncedUser } = response.data;
      localStorage.setItem('token', token);
      setUser(syncedUser);
      return syncedUser;
    } catch (error) {
      console.error('Backend session sync failed:', error);
      throw error.response?.data?.message || SYNC_FALLBACK_MESSAGE;
    }
  };

  // Restore the session on load: the app JWT first, then bridge a still-active
  // Firebase session that does not have a backend token yet.
  useEffect(() => {
    let unsubscribe = () => {};

    async function restoreSession() {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          console.error('Failed to restore user session:', error);
          localStorage.removeItem('token');
        }
      }

      if (isFirebaseConfigured && auth) {
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!firebaseUser || localStorage.getItem('token')) return;
          try {
            await syncWithBackend(firebaseUser);
          } catch (error) {
            console.error('Firebase session sync failed:', error);
          }
        });
      }

      setLoading(false);
    }

    restoreSession();
    return () => unsubscribe();
  }, []);

  /**
   * Google is the only sign-in method. The Google identity is verified by
   * Firebase in the browser and re-verified by the API before a session is
   * issued, so the client never has to handle a password.
   */
  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw NOT_CONFIGURED_MESSAGE;
    }

    setLoading(true);
    try {
      const firebaseUser = await firebaseSignInWithGoogle();
      return await syncWithBackend(firebaseUser);
    } catch (error) {
      console.error('Google sign-in failed:', error);

      // Keep Firebase and the app in sync: if the backend rejected the token,
      // drop the half-open Firebase session instead of leaving it dangling.
      if (!error?.code) {
        signOutFirebase().catch(() => {});
      }

      if (error?.code) throw firebaseErrorMessage(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);

    if (isFirebaseConfigured) {
      signOutFirebase().catch((error) => console.error('Firebase sign-out failed:', error));
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    loading,
    isFirebaseConfigured,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
