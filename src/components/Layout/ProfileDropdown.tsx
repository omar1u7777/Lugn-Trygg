import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  UserCircleIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon,
  ChevronDownIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { extractDisplayName } from '../../utils/nameUtils';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTheme } from '../../contexts/ThemeContext';

interface ProfileDropdownProps {
  isPremium?: boolean;
  planLabel?: string;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ isPremium, planLabel }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const userDisplayName = extractDisplayName(user?.email || '');
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900';

  // Stäng dropdown vid klick utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stäng vid ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleLogout = () => {
    if (window.confirm(t('navigation.confirmLogout'))) {
      logout();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-[#2c8374] dark:hover:border-[#2c8374] transition-all duration-200 min-h-[44px] ${focusRing}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <UserCircleIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-white hidden sm:inline max-w-[120px] truncate">
          {userDisplayName}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 animate-scale-in"
          role="menu"
        >
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {userDisplayName}
            </p>
            {isPremium && planLabel && (
              <span className="inline-flex items-center gap-1 mt-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                ✨ {planLabel}
              </span>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Profile Link */}
            <Link
              to="/profile"
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <UserCircleIcon className="w-5 h-5" />
              <span>{t('navigation.profile')}</span>
            </Link>

            {/* Settings Link */}
            <Link
              to="/settings"
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <Cog6ToothIcon className="w-5 h-5" />
              <span>{t('navigation.settings')}</span>
            </Link>

            <div className="border-t border-gray-200 dark:border-slate-700 my-2" />

            {/* Theme Toggle */}
            <button
              onClick={() => {
                toggleTheme();
                setIsOpen(false);
              }}
              className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              role="menuitem"
            >
              <span>{t('navigation.theme')}</span>
              <span className="text-lg">{isDarkMode ? '☀️' : '🌙'}</span>
            </button>

            {/* Language Switcher */}
            <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('navigation.language')}</span>
                <LanguageSwitcher compact />
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 my-2" />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              role="menuitem"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span>{t('navigation.pause')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
