import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import {
  auth,
  firebaseErrorMessage,
  isFirebaseConfigured,
  onAuthStateChanged,
  signInWithEmail,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutFirebase,
  signUpWithEmail
} from '../services/firebase';

const AuthContext = createContext();

const SYNC_FALLBACK_MESSAGE =
  'Signed in with Firebase, but the backend could not verify the session. Check FIREBASE_PROJECT_ID in server/.env.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Exchanges a Firebase ID token for the app's own JWT (plus the database
   * user record with its role), so every protected API keeps working.
   */
  const syncWithBackend = async (firebaseUser, profile = {}) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await api.post('/auth/firebase', {
        idToken,
        name: profile.name || firebaseUser.displayName || '',
        role: profile.role
      });

      const { token, user: syncedUser } = response.data;
      localStorage.setItem('token', token);
      setUser(syncedUser);
      return syncedUser;
    } catch (error) {
      console.error('Backend session sync failed:', error);
      throw error.response?.data?.message || SYNC_FALLBACK_MESSAGE;
    }
  };

  // Restore the session on load: JWT first, then bridge a still-active Firebase
  // session that does not have a backend token yet.
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

  const legacyLogin = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: loggedUser } = response.data;
      localStorage.setItem('token', token);
      setUser(loggedUser);
      return loggedUser;
    } catch (error) {
      console.error('Login failed:', error);
      throw error.response?.data?.message || 'Login failed';
    }
  };

  const legacyRegister = async (name, email, password, role) => {
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const { token, user: registeredUser } = response.data;
      localStorage.setItem('token', token);
      setUser(registeredUser);
      return registeredUser;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error.response?.data?.message || 'Registration failed';
    }
  };

  /**
   * Firebase email/password sign-in when configured. Accounts that only exist
   * in the local database (e.g. the seeded demo users) still work through the
   * built-in endpoint, so enabling Firebase never locks anyone out.
   */
  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        let firebaseUser;
        try {
          firebaseUser = await signInWithEmail(email, password);
        } catch (firebaseError) {
          try {
            return await legacyLogin(email, password);
          } catch {
            throw firebaseErrorMessage(firebaseError);
          }
        }
        return await syncWithBackend(firebaseUser);
      }

      return await legacyLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role = 'student') => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        const firebaseUser = await signUpWithEmail(name, email, password);
        return await syncWithBackend(firebaseUser, { name, role });
      }

      return await legacyRegister(name, email, password, role);
    } catch (error) {
      if (error?.code) throw firebaseErrorMessage(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw 'Google sign-in becomes available once the VITE_FIREBASE_* keys are added to client/.env.';
    }

    setLoading(true);
    try {
      const firebaseUser = await firebaseSignInWithGoogle();
      return await syncWithBackend(firebaseUser);
    } catch (error) {
      console.error('Google sign-in failed:', error);
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
    login,
    register,
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
