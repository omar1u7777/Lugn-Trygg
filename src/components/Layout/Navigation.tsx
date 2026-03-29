import React, { memo, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { extractDisplayName } from "../../utils/nameUtils";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SparklesIcon } from "@heroicons/react/24/solid";

// 🎨 Theme Toggle Button - Separerad komponent för DRY-princip
const ThemeToggleButton = memo<{ className?: string }>(({ className = "" }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900";
  
  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center justify-center w-11 h-11 bg-[#f2e4d4] dark:bg-slate-800 hover:bg-[#e8dcd0] dark:hover:bg-slate-700 text-[#6d645d] dark:text-gray-400 hover:text-[#2f2a24] dark:hover:text-white rounded-xl transition-all duration-200 ${focusRing} ${className}`}
      aria-label={isDarkMode ? "Byt till ljust läge" : "Byt till mörkt läge"}
      title={isDarkMode ? "Ljust läge" : "Mörkt läge"}
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
  const { logout, user } = useAuth();
  const { plan, loading: subscriptionLoading } = useSubscription();
  
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900";
  const userDisplayName = extractDisplayName(user?.email || "");
  
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
      {/* Separator */}
      <div className="hidden lg:block w-px h-7 bg-[#e8dcd0] dark:bg-slate-700 mx-1 flex-shrink-0"></div>

      {/* 💚 Välkomstmeddelande - Positiv förstärkning */}
      <div className="hidden lg:flex items-center gap-2 px-1 flex-shrink-0">
        {isPremium && (
          <span className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
            <SparklesIcon className="w-3 h-3" />
            {planBadgeLabel}
          </span>
        )}
        <span className="text-[#6d645d] dark:text-gray-400 text-sm whitespace-nowrap">
          Välkommen tillbaka, {userDisplayName} ✨
        </span>
      </div>

      {/* 🎯 Uppgradera-knapp - Ny mjukare färg och text */}
      {!isPremium && !subscriptionLoading && (
        <Link
          to="/upgrade"
          className={`hidden xl:flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm shadow-md hover:shadow-lg min-h-[44px] flex-shrink-0 ${focusRing}`}
          aria-label="Upptäck Premium"
        >
          <SparklesIcon className="w-4 h-4" />
          <span className="whitespace-nowrap">Upptäck Premium</span>
        </Link>
      )}

      {/* 🌙 Tema */}
      <ThemeToggleButton className="flex-shrink-0" />

      {/* 🌍 Språk */}
      <div className="flex-shrink-0">
        <LanguageSwitcher />
      </div>

      {/* 🚪 Avsluta session - Neutral färg för minskad ångest */}
      <button
        onClick={logout}
        className={`flex items-center gap-1.5 bg-slate-500 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-2.5 sm:px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm min-h-[44px] flex-shrink-0 ${focusRing}`}
        title="Avsluta session"
      >
        <span className="text-base">👋</span>
        <span className="hidden sm:inline whitespace-nowrap">Avsluta</span>
      </button>
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
        className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm flex-shrink-0 whitespace-nowrap ${focusRing} ${isActive("/login")
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
        className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm flex-shrink-0 whitespace-nowrap ${focusRing} ${isActive("/register")
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
 * - Positiv förstärkning i välkomstmeddelande
 * - Neutrala färger för ångestminskning
 * - Tydlig visuell hierarki
 */
const Navigation: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0] dark:focus-visible:ring-offset-slate-900';

  return (
    <nav
      id="navigation"
      role="navigation"
      aria-label="Huvudnavigation"
      className="flex justify-between items-center bg-[#fff7f0]/95 dark:bg-slate-900/95 px-2 sm:px-3 md:px-4 lg:px-5 py-3 w-full fixed top-0 left-0 lg:left-64 lg:w-[calc(100%-16rem)] z-[120] shadow-sm border-b border-[#f2e4d4] dark:border-slate-700 backdrop-blur-md transition-colors duration-300"
    >
      {/* 🧘 Logo - Alltid synlig */}
      <Link
        to={isLoggedIn ? "/dashboard" : "/"}
        className={`text-[#2f2a24] dark:text-white font-bold text-lg md:text-xl flex items-center gap-2 hover:text-[#2c8374] transition-all duration-200 group lg:hidden ${focusRing}`}
      >
        <span className="text-xl md:text-2xl group-hover:scale-110 transition-transform">🧘</span>
        <span className="text-[#2c8374] font-semibold text-sm sm:text-base whitespace-nowrap">
          Lugn & Trygg
        </span>
      </Link>

      {/* 📱 Navigation Links - med overflow-hantering */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 overflow-x-auto max-w-[70%] sm:max-w-none scrollbar-hide min-w-0">
        {isLoggedIn ? <AuthenticatedNav /> : <GuestNav />}
      </div>
    </nav>
  );
};

export default Navigation;
