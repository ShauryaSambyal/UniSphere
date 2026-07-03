import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, LogIn, LogOut, ShieldAlert, Sparkles, HelpCircle, Layers, Compass, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LoginModal from './LoginModal';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) => `
    flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
    ${isActive(path)
      ? 'bg-gradient-to-r from-brand-light/10 to-brand-accent/10 text-brand-light dark:text-brand-accent border border-brand-light/20'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'
    }
  `;

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b border-gray-200/50 bg-white/70 backdrop-blur-md dark:border-white/5 dark:bg-darkbg-base/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-sans text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-light via-brand-accent to-brand-purple bg-clip-text text-transparent">
              <Sparkles className="text-brand-light dark:text-brand-accent animate-pulse" size={24} />
              <span>UniSphere</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <Link to="/" className={linkClass('/')}>
                <Compass size={16} />
                Explore
              </Link>
              <Link to="/compare" className={linkClass('/compare')}>
                <Layers size={16} />
                Compare
              </Link>
              <Link to="/chat" className={linkClass('/chat')}>
                <HelpCircle size={16} />
                AI Assistant
              </Link>
              <Link to="/recommendations" className={linkClass('/recommendations')}>
                <Sparkles size={16} />
                Match Maker
              </Link>
              {isAdmin && (
                <Link to="/admin" className={linkClass('/admin')}>
                  <ShieldAlert size={16} />
                  Admin
                </Link>
              )}
            </div>

            {/* Right Buttons */}
            <div className="hidden md:flex items-center gap-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-xl border border-gray-200/60 p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:border-white/10 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Auth Button */}
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">{user.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-all duration-200"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 active:scale-[0.98] transition-all duration-200"
                >
                  <LogIn size={16} />
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="flex items-center gap-3 md:hidden">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-xl border border-gray-200/60 p-2 text-gray-500 dark:border-white/10 dark:text-gray-400"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-xl border border-gray-200/60 p-2 text-gray-500 dark:border-white/10 dark:text-gray-400"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white/95 p-4 dark:border-white/5 dark:bg-darkbg-base/95 space-y-2">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/')}>
              <Compass size={16} />
              Explore Colleges
            </Link>
            <Link to="/compare" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/compare')}>
              <Layers size={16} />
              Compare Colleges
            </Link>
            <Link to="/chat" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/chat')}>
              <HelpCircle size={16} />
              AI Assistant
            </Link>
            <Link to="/recommendations" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/recommendations')}>
              <Sparkles size={16} />
              Match Maker
            </Link>
            {isAdmin && (
              <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className={linkClass('/admin')}>
                <ShieldAlert size={16} />
                Admin Dashboard
              </Link>
            )}

            <hr className="border-gray-200 dark:border-white/10 my-2" />

            {isAuthenticated ? (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">{user.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 dark:border-white/10 dark:text-gray-300"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsLoginOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-gray-900"
              >
                <LogIn size={16} />
                Sign In
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}
