import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { extractDisplayName } from "../../utils/nameUtils";
import LanguageSwitcher from "../LanguageSwitcher";

const Navigation: React.FC = () => {
  const { isLoggedIn, logout, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 w-full fixed top-0 left-0 z-50 shadow-xl border-b border-slate-700/50">
      <Link
        to={isLoggedIn() ? "/dashboard" : "/"}
        className="text-white font-bold text-xl flex items-center gap-3 hover:text-primary-300 transition-colors duration-200"
      >
        <span className="text-2xl">🧘</span>
        {t('app.name')}
      </Link>

      <ul className="flex items-center gap-4 ml-auto">
        {isLoggedIn() ? (
          <>
            <li>
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/dashboard')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-tachometer-alt"></i>
                <span className="hidden sm:inline">{t('nav.dashboard')}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/subscribe"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/subscribe')
                    ? 'bg-secondary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-crown text-yellow-400"></i>
                <span className="hidden sm:inline">{t('subscription.subscribe')}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/ai-stories"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/ai-stories')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-book-open"></i>
                <span className="hidden sm:inline">AI Stories</span>
              </Link>
            </li>
            <li>
              <Link
                to="/analytics"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/analytics')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-chart-line"></i>
                <span className="hidden sm:inline">Analytics</span>
              </Link>
            </li>
            <li>
              <Link
                to="/integrations"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/integrations')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span className="text-lg">❤️</span>
                <span className="hidden sm:inline">Integration</span>
              </Link>
            </li>
            <li>
              <Link
                to="/referral"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/referral')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span className="text-lg">🤝</span>
                <span className="hidden sm:inline">Referral</span>
              </Link>
            </li>
            <li>
              <Link
                to="/feedback"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/feedback')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span className="text-lg">💬</span>
                <span className="hidden sm:inline">Feedback</span>
              </Link>
            </li>
            <li className="hidden md:flex items-center">
              <span className="flex items-center gap-2 bg-slate-700/50 text-slate-300 px-3 py-2 rounded-full text-sm">
                <i className="fas fa-user text-primary-400"></i>
                Hej, {extractDisplayName(user?.email || '')}
              </span>
            </li>
            <li>
              <button
                onClick={logout}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-red-500/25"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span className="hidden sm:inline">{t('nav.logout')}</span>
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link
                to="/login"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/login')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-sign-in-alt"></i>
                <span className="hidden sm:inline">{t('auth.login')}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/register"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/register')
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-user-plus"></i>
                <span className="hidden sm:inline">{t('auth.register')}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/subscribe"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/subscribe')
                    ? 'bg-secondary-500 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-crown text-yellow-400"></i>
                <span className="hidden sm:inline">{t('subscription.subscribe')}</span>
              </Link>
            </li>
          </>
        )}

        {/* Theme Toggle */}
        <li>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all duration-200"
            aria-label={isDarkMode ? t('settings.lightMode') : t('settings.darkMode')}
          >
            <i className={`fas ${isDarkMode ? 'fa-sun text-yellow-400' : 'fa-moon'}`}></i>
          </button>
        </li>

        {/* Language Switcher */}
        <li>
          <LanguageSwitcher />
        </li>
      </ul>
    </nav>
  );
};

export default Navigation;