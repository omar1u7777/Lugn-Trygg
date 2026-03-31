import React, { memo, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { extractDisplayName } from "../../utils/nameUtils";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SparklesIcon, Bars3Icon } from "@heroicons/react/24/solid";
import MobileMenu from "./MobileMenu";
import ProfileDropdown from "./ProfileDropdown";
import LoadingSpinner from "../ui/LoadingSpinner";

// 🎨 Theme Toggle Button - Separerad komponent för DRY-princip
const ThemeToggleButton = memo<{ className?: string }>(({ className = "" }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900";
  
  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center justify-center w-11 h-11 bg-[#f2e4d4] dark:bg-slate-800 hover:bg-[#e8dcd0] dark:hover:bg-slate-700 text-[#6d645d] dark:text-gray-400 hover:text-[#2f2a24] dark:hover:text-white rounded-xl transition-all duration-200 ${focusRing} ${className}`}
      aria-label={isDarkMode ? t('navigation.switchToLight') : t('navigation.switchToDark')}
      title={isDarkMode ? t('settings.lightMode') : t('settings.darkMode')}
    >
      <span className={`text-lg transition-all ${isDarkMode ? "rotate-0" : "rotate-12"}`}>
        {isDarkMode ? "☀️" : "🌙"}
      </span>
    </button>
  );
});

ThemeToggleButton.displayName = "ThemeToggleButton";

// 👤 Authenticated Navigation - Separerad för prestanda
const AuthenticatedNav = memo(() => {
  const { plan, loading: subscriptionLoading } = useSubscription();
  const { t } = useTranslation();
  
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900";
  
  // ✅ useMemo för prestanda - förhindra onödiga beräkningar
  const isPremium = useMemo(() => 
    plan.tier === "premium" || plan.tier === "enterprise", 
    [plan.tier]
  );
  
  const planBadgeLabel = useMemo(() => 
    plan.tier === "enterprise" ? "Enterprise" : "Premium", 
    [plan.tier]
  );

  return (
    <>
      {/* Loading State */}
      {subscriptionLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
          <LoadingSpinner size="sm" />
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
        </div>
      ) : (
        <>
          {/* 🎯 Uppgradera-knapp - Förbättrad med specifika benefits */}
          {!isPremium && (
            <Link
              to="/upgrade"
              className={`hidden lg:flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-emerald-500/30 hover:border-emerald-500 dark:border-emerald-500/30 dark:hover:border-emerald-500 px-4 py-2 rounded-xl transition-all duration-200 min-h-[44px] group ${focusRing}`}
              aria-label={t('navigation.unlockUnlimited')}
            >
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {t('navigation.unlockUnlimited')}
              </span>
              <SparklesIcon className="w-4 h-4 text-emerald-500 group-hover:rotate-12 transition-transform" />
            </Link>
          )}
        </>
      )}

      {/* Profile Dropdown - Innehåller tema, språk, logout */}
      <ProfileDropdown isPremium={isPremium} planLabel={planBadgeLabel} />
    </>
  );
});

AuthenticatedNav.displayName = "AuthenticatedNav";

// 👤 Guest Navigation - Separerad för prestanda  
const GuestNav = memo(() => {
  const { t } = useTranslation();
  const location = useLocation();
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900";
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* 🔑 Logga in */}
      <Link
        to="/login"
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm flex-shrink-0 whitespace-nowrap min-h-[44px] ${focusRing} ${isActive("/login")
          ? "bg-[#2c8374] text-white"
          : "text-[#6d645d] dark:text-gray-400 hover:text-[#2f2a24] dark:hover:text-white hover:bg-[#f2e4d4] dark:hover:bg-slate-800"
        }`}
        aria-current={isActive("/login") ? "page" : undefined}
      >
        <span>🔑</span>
        <span>{t("auth.login")}</span>
      </Link>

      {/* ✨ Registrera */}
      <Link
        to="/register"
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm flex-shrink-0 whitespace-nowrap min-h-[44px] ${focusRing} ${isActive("/register")
          ? "bg-[#2c8374] text-white"
          : "text-[#6d645d] dark:text-gray-400 hover:text-[#2f2a24] dark:hover:text-white hover:bg-[#f2e4d4] dark:hover:bg-slate-800"
        }`}
        aria-current={isActive("/register") ? "page" : undefined}
      >
        <span>✨</span>
        <span>{t("auth.register")}</span>
      </Link>

      {/* 🌙 Tema */}
      <ThemeToggleButton className="flex-shrink-0" />

      {/* 🌍 Språk */}
      <div className="flex-shrink-0">
        <LanguageSwitcher />
      </div>
    </>
  );
});

GuestNav.displayName = "GuestNav";

/**
 * 🧘 Navigation Component - "Calm Technology" Design
 * 
 * Psykologiska principer:
 * - Minimerad kognitiv last genom prioritering
 * - Touch targets ≥ 44x44px (WCAG 2.5.5)
 * - Logout-bekräftelse för att förhindra misstag
 * - Progressive disclosure (settings i dropdown)
 * - Loading states för minskad osäkerhet
 * - Mobile menu istället för dold scroll
 */
const Navigation: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900';

  return (
    <>
      <nav
        id="navigation"
        role="navigation"
        aria-label={t('navigation.mainNav')}
        className="flex justify-between items-center bg-[#fff7f0]/95 dark:bg-slate-900/95 px-3 md:px-4 lg:px-5 py-3 w-full fixed top-0 left-0 lg:left-64 lg:w-[calc(100%-16rem)] z-[120] shadow-sm border-b border-[#f2e4d4] dark:border-slate-700 backdrop-blur-md transition-colors duration-300"
      >
        {/* 🧘 Logo - Alltid synlig */}
        <Link
          to={isLoggedIn ? "/dashboard" : "/"}
          className={`text-[#2f2a24] dark:text-white font-bold text-lg md:text-xl flex items-center gap-2 hover:text-[#2c8374] transition-all duration-200 group lg:hidden min-h-[44px] ${focusRing}`}
        >
          <span className="text-xl md:text-2xl group-hover:scale-110 transition-transform">🧘</span>
          <span className="text-[#2c8374] font-semibold text-sm sm:text-base whitespace-nowrap">
            Lugn & Trygg
          </span>
        </Link>

        {/* 📱 Desktop Navigation */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? <AuthenticatedNav /> : <GuestNav />}
        </div>

        {/* 📱 Mobile Hamburger Menu Button */}
        <button
          onClick={() => setShowMobileMenu(true)}
          className={`md:hidden flex items-center justify-center w-11 h-11 bg-[#f2e4d4] dark:bg-slate-800 hover:bg-[#e8dcd0] dark:hover:bg-slate-700 text-[#6d645d] dark:text-gray-400 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] ${focusRing}`}
          aria-label={t('navigation.openMenu')}
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)}>
        {isLoggedIn ? <AuthenticatedNav /> : <GuestNav />}
      </MobileMenu>
    </>
  );
};

export default Navigation;
