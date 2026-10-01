import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, TerminalSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Keys the app reads at build time. Listed in the UI so the setup step is
// obvious when client/.env has not been filled in yet.
const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-4 w-4">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 2-1.5 5-4.4 7l-.1.3 6.4 4.9.4.1c4.1-3.7 6.8-9.3 6.8-15.5z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.6 5.1-.1.3C8.1 41 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.7-4.5v-.3l-6.7-5.2-.2.1C3 17.3 2 20.5 2 24s1 6.7 2.6 9.5l6.9-5z" />
      <path fill="#EA4335" d="M24 10.1c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.9 29.9 2 24 2 15.5 2 8.1 7 4.6 14.5l6.9 5.2c1.7-5.3 6.6-9.1 12.5-9.1z" />
    </svg>
  );
}

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogle, isFirebaseConfigured } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 14 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-line bg-card-elevated p-8 shadow-[0_32px_80px_-24px_rgba(26,26,26,0.28)]"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 cursor-pointer text-faint transition-colors duration-150 hover:text-foreground"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="mb-7">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                Sign in
              </h2>
              <p className="mt-1.5 text-sm font-normal text-muted">
                Continue with your Google account to unlock AI recommendations and saved comparisons.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm font-normal text-red-600">
                {error}
              </div>
            )}

            {isFirebaseConfigured ? (
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-foreground py-3 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] disabled:opacity-50"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background">
                  <GoogleMark />
                </span>
                {loading ? 'Connecting…' : 'Continue with Google'}
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong bg-subtle p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TerminalSquare size={15} />
                  Google sign-in needs Firebase keys
                </div>
                <p className="mt-2 text-xs font-normal leading-relaxed text-muted">
                  Add your Firebase web app credentials to <code className="font-mono text-[11px] text-foreground">client/.env</code>,
                  then restart the dev server:
                </p>
                <ul className="mt-3 space-y-1">
                  {REQUIRED_KEYS.map((key) => (
                    <li key={key} className="font-mono text-[11px] text-muted">
                      {key}=
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs font-normal leading-relaxed text-muted">
                  Also set <code className="font-mono text-[11px] text-foreground">FIREBASE_PROJECT_ID</code> in{' '}
                  <code className="font-mono text-[11px] text-foreground">server/.env</code> so the API can verify the token.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 border-t border-line pt-5 text-xs font-normal text-muted">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-faint" />
              <span>
                Authentication is handled by Firebase. UniSphere never sees or stores your Google password.
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
