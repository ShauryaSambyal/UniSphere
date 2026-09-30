import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, ArrowRight, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Dropdown from './Dropdown';

export default function LoginModal({ isOpen, onClose }) {
  const { login, register, loginWithGoogle, isFirebaseConfigured } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setError(err || 'Google sign-in failed');
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
                {isRegister ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="mt-1.5 text-sm font-normal text-muted">
                {isRegister
                  ? 'Join UniSphere to compare colleges and review them.'
                  : 'Sign in to access AI recommendations and saved chats.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm font-normal text-red-600">
                  {error}
                </div>
              )}

              {isRegister && (
                <div>
                  <label className="block pb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                    Full name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={15} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-lg border border-line bg-background py-2.5 pl-9 pr-3 text-sm font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block pb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={15} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-line bg-background py-2.5 pl-9 pr-3 text-sm font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong"
                  />
                </div>
              </div>

              <div>
                <label className="block pb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={15} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-line bg-background py-2.5 pl-9 pr-3 text-sm font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong"
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="block pb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                    I am a
                  </label>
                  <Dropdown
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'admin', label: 'Administrator' },
                    ]}
                    placeholder="Select a role"
                    triggerClassName="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2.5 text-left text-sm font-normal text-foreground transition-colors duration-150 hover:border-line-strong"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Processing…' : isRegister ? 'Create account' : 'Sign in'}
                {!loading && <ArrowRight size={14} />}
              </button>

              {isFirebaseConfigured && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-faint">or</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-card py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-line-strong active:scale-[0.98] disabled:opacity-50"
                  >
                    <Globe size={15} />
                    Continue with Google
                  </button>
                </>
              )}
            </form>

            {/* Toggle Action */}
            <div className="mt-6 border-t border-line pt-5 text-center text-xs font-normal text-muted">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setError('');
                  setIsRegister(!isRegister);
                }}
                className="cursor-pointer font-medium text-foreground underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-foreground"
              >
                {isRegister ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
