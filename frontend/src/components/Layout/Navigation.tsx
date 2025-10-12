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
    <nav className="navbar">
      <Link to={isLoggedIn() ? "/dashboard" : "/"} className="app-name">
        🧘 {t('app.name')}
      </Link>

      <ul className="nav-links">
        {isLoggedIn() ? (
          <>
            <li>
              <Link
                to="/dashboard"
                className={isActive('/dashboard') ? 'active' : ''}
              >
                <i className="fas fa-tachometer-alt"></i> {t('nav.dashboard')}
              </Link>
            </li>
            <li>
              <Link
                to="/subscribe"
                className={isActive('/subscribe') ? 'active' : ''}
              >
                <i className="fas fa-crown"></i> {t('subscription.subscribe')}
              </Link>
            </li>
            <li>
              <Link
                to="/ai-stories"
                className={isActive('/ai-stories') ? 'active' : ''}
              >
                <i className="fas fa-book-open"></i> AI Stories
              </Link>
            </li>
            <li>
              <Link
                to="/analytics"
                className={isActive('/analytics') ? 'active' : ''}
              >
                <i className="fas fa-chart-line"></i> Analytics
              </Link>
            </li>
            <li className="user-info">
              <span className="user-greeting">
                <i className="fas fa-user"></i> Hej, {extractDisplayName(user?.email || '')}
              </span>
            </li>
            <li>
              <button onClick={logout} className="logout-btn">
                <i className="fas fa-sign-out-alt"></i> {t('nav.logout')}
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link
                to="/login"
                className={isActive('/login') ? 'active' : ''}
              >
                <i className="fas fa-sign-in-alt"></i> {t('auth.login')}
              </Link>
            </li>
            <li>
              <Link
                to="/register"
                className={isActive('/register') ? 'active' : ''}
              >
                <i className="fas fa-user-plus"></i> {t('auth.register')}
              </Link>
            </li>
            <li>
              <Link
                to="/subscribe"
                className={isActive('/subscribe') ? 'active' : ''}
              >
                <i className="fas fa-crown"></i> {t('subscription.subscribe')}
              </Link>
            </li>
          </>
        )}
        <li className="theme-toggle-item">
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            aria-label={isDarkMode ? t('settings.lightMode') : t('settings.darkMode')}
          >
            <i className={isDarkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
          </button>
        </li>
        <li className="language-switcher-item">
          <LanguageSwitcher />
        </li>
      </ul>
    </nav>
  );
};

export default Navigation;