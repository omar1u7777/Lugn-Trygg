import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { extractDisplayName } from "../../utils/nameUtils";
import LanguageSwitcher from "../LanguageSwitcher";
import "../../styles/design-system.css";

const NavigationPro: React.FC = () => {
  const { isLoggedIn, logout, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path;

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const navItems = isLoggedIn() ? [
    { path: '/dashboard', icon: 'fa-tachometer-alt', label: t('nav.dashboard') },
    { path: '/ai-stories', icon: 'fa-book-open', label: 'AI Stories' },
    { path: '/analytics', icon: 'fa-chart-line', label: 'Analytics' },
    { path: '/integrations', icon: 'fa-heart', label: 'Integration', emoji: '❤️' },
    { path: '/referral', icon: 'fa-users', label: 'Referral', emoji: '🤝' },
    { path: '/feedback', icon: 'fa-comment-dots', label: 'Feedback', emoji: '💬' },
    { path: '/subscribe', icon: 'fa-crown', label: t('subscription.subscribe'), highlight: true },
  ] : [
    { path: '/login', icon: 'fa-sign-in-alt', label: t('auth.login') },
    { path: '/register', icon: 'fa-user-plus', label: t('auth.register') },
    { path: '/subscribe', icon: 'fa-crown', label: t('subscription.subscribe'), highlight: true },
  ];

  return (
    <>
      {/* Navigation Bar */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-slate-900/95 backdrop-blur-lg shadow-xl' 
            : 'bg-gradient-to-r from-slate-900 to-slate-800'
        } border-b border-slate-700/50`}
        style={{ height: 'var(--nav-height, 64px)' }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            {/* Logo */}
            <Link
              to={isLoggedIn() ? "/dashboard" : "/"}
              className="text-white font-bold text-xl flex items-center gap-3 hover:text-primary-300 transition-all duration-200 focus-ring"
            >
              <span className="text-2xl">🧘</span>
              <span className="hidden sm:inline">{t('app.name')}</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                    ${isActive(item.path)
                      ? item.highlight
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                        : 'bg-primary-500 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }
                  `}
                >
                  {item.emoji ? (
                    <span className="text-lg">{item.emoji}</span>
                  ) : (
                    <i className={`fas ${item.icon} ${item.highlight ? 'text-yellow-200' : ''}`}></i>
                  )}
                  <span>{item.label}</span>
                </Link>
              ))}

              {/* User Info (Desktop) */}
              {isLoggedIn() && (
                <div className="hidden xl:flex items-center gap-2 bg-slate-700/50 text-slate-300 px-3 py-2 rounded-full text-sm ml-2">
                  <i className="fas fa-user text-primary-400"></i>
                  <span>Hej, {extractDisplayName(user?.email || '')}</span>
                </div>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="btn-icon btn-ghost-pro ml-2"
                aria-label={isDarkMode ? t('settings.lightMode') : t('settings.darkMode')}
              >
                <i className={`fas ${isDarkMode ? 'fa-sun text-yellow-400' : 'fa-moon text-slate-400'}`}></i>
              </button>

              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Logout Button (Desktop) */}
              {isLoggedIn() && (
                <button
                  onClick={logout}
                  className="btn-danger-pro btn-sm ml-2"
                >
                  <i className="fas fa-sign-out-alt"></i>
                  <span className="hidden xl:inline">{t('nav.logout')}</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden btn-ghost-pro btn-icon"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden fade-in"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`
          fixed top-[64px] right-0 bottom-0 w-full max-w-sm bg-slate-900 z-40 lg:hidden
          transition-transform duration-300 ease-out overflow-y-auto
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="p-6 space-y-4">
          {/* User Info (Mobile) */}
          {isLoggedIn() && (
            <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-xl mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-white text-xl"></i>
              </div>
              <div>
                <p className="text-white font-medium">Hej,</p>
                <p className="text-slate-300 text-sm">{extractDisplayName(user?.email || '')}</p>
              </div>
            </div>
          )}

          {/* Mobile Nav Items */}
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  ${isActive(item.path)
                    ? item.highlight
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                      : 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                {item.emoji ? (
                  <span className="text-2xl">{item.emoji}</span>
                ) : (
                  <i className={`fas ${item.icon} text-lg ${item.highlight ? 'text-yellow-200' : ''}`}></i>
                )}
                <span className="text-base">{item.label}</span>
                {isActive(item.path) && (
                  <i className="fas fa-check ml-auto text-sm"></i>
                )}
              </Link>
            ))}
          </nav>

          {/* Mobile Actions */}
          <div className="pt-6 border-t border-slate-700 space-y-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all duration-200"
            >
              <i className={`fas ${isDarkMode ? 'fa-sun text-yellow-400' : 'fa-moon'} text-lg`}></i>
              <span>{isDarkMode ? t('settings.lightMode') : t('settings.darkMode')}</span>
            </button>

            {/* Language Switcher */}
            <div className="px-4">
              <LanguageSwitcher />
            </div>

            {/* Logout Button (Mobile) */}
            {isLoggedIn() && (
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full btn-danger-pro"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span>{t('nav.logout')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from hiding under fixed nav */}
      <div style={{ height: 'var(--nav-height, 64px)' }} aria-hidden="true" />
    </>
  );
};

export default NavigationPro;
