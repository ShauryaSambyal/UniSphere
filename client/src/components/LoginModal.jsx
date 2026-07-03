import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-lg dark:border-white/5 dark:bg-darkbg-card/90"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="mb-6 text-center">
              <h2 className="font-sans text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {isRegister
                  ? 'Join UniSphere to compare colleges and review them'
                  : 'Sign in to access AI recommendations and chat details'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                  {error}
                </div>
              )}

              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    Full Name
                  </label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-xl border border-gray-200 bg-white/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-brand-accent transition-all duration-200"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-gray-200 bg-white/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-brand-accent transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Password
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-200 bg-white/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-brand-accent transition-all duration-200"
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    I am a
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-darkbg-base dark:text-white dark:focus:border-brand-accent transition-all duration-200"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-light to-brand-accent py-3 text-sm font-semibold text-white shadow-lg shadow-brand-light/25 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
              >
                {loading ? 'Processing...' : isRegister ? 'Sign Up' : 'Sign In'}
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Toggle Action */}
            <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setError('');
                  setIsRegister(!isRegister);
                }}
                className="font-semibold text-brand-light hover:underline dark:text-brand-accent"
              >
                {isRegister ? 'Sign In' : 'Sign Up now'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
