import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, LogOut, ShieldAlert, Sparkles, HelpCircle, Layers, Compass, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';

const NAV_LINKS = [
  { to: '/', label: 'Explore', icon: Compass },
  { to: '/compare', label: 'Compare', icon: Layers },
  { to: '/chat', label: 'AI Assistant', icon: HelpCircle },
  { to: '/recommendations', label: 'Match Maker', icon: Sparkles },
];

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm transition-colors duration-200 ${
      isActive(path)
        ? 'text-foreground'
        : 'text-muted hover:text-foreground'
    }`;

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
                <Sparkles size={15} strokeWidth={2.2} />
              </span>
              <span>UniSphere</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={linkClass(to)}>
                  {isActive(to) && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-subtle"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon size={15} className="relative z-10" strokeWidth={2} />
                  <span className="relative z-10 font-medium">{label}</span>
                </Link>
              ))}
              {isAdmin && (
                <Link to="/admin" className={linkClass('/admin')}>
                  {isActive('/admin') && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-subtle"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <ShieldAlert size={15} className="relative z-10" strokeWidth={2} />
                  <span className="relative z-10 font-medium">Admin</span>
                </Link>
              )}
            </div>

            {/* Right Buttons */}
            <div className="hidden items-center gap-3 md:flex">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="text-right leading-tight">
                    <div className="text-sm font-semibold text-foreground">{user.name}</div>
                    <div className="text-xs capitalize text-muted">{user.role}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-foreground"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
                >
                  <LogIn size={15} />
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-lg border border-line p-2 text-muted"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden border-t border-line md:hidden"
            >
              <div className="space-y-1 p-4">
                {[...NAV_LINKS, ...(isAdmin ? [{ to: '/admin', label: 'Admin Dashboard', icon: ShieldAlert }] : [])].map(
                  ({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        isActive(to)
                          ? 'bg-subtle text-foreground'
                          : 'text-muted hover:bg-subtle hover:text-foreground'
                      }`}
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  )
                )}

                <hr className="my-3 border-line" />

                {isAuthenticated ? (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{user.name}</div>
                      <div className="text-xs text-muted">{user.email}</div>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted"
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
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background"
                  >
                    <LogIn size={15} />
                    Sign In
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Auth Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}
