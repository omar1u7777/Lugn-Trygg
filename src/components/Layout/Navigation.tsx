import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { extractDisplayName } from "../../utils/nameUtils";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SparklesIcon } from "@heroicons/react/24/solid";

/**
 * Navigation Component - Ren och professionell svensk navigering
 * 
 * Visar olika menyer beroende på prenumerationsnivå:
 * - Gratis: 4 grundfunktioner
 * - Premium: 6 funktioner + premium-badge
 * 
 * Alla texter på svenska. Ingen dropdown-meny - allt synligt direkt.
 */
const Navigation: React.FC = () => {
  const { isLoggedIn, logout, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { plan, loading: subscriptionLoading, hasFeature } = useSubscription();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) => location.pathname === path;
  const isPremium = plan.tier === 'premium' || plan.tier === 'enterprise';
  const planBadgeLabel = plan.tier === 'enterprise' ? 'Enterprise' : 'Premium';

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2c8374] focus-visible:ring-offset-[#fff7f0]';

  return (
    <nav
      id="navigation"
      role="navigation"
      aria-label="Huvudnavigation"
      className="flex justify-between items-center bg-[#fff7f0]/95 px-3 md:px-6 py-3 w-full fixed top-0 left-0 z-[100] shadow-sm border-b border-[#f2e4d4] backdrop-blur-md"
    >
      {/* Logo */}
      <Link
        to={isLoggedIn ? "/dashboard" : "/"}
        className={`text-[#2f2a24] font-bold text-lg md:text-xl flex items-center gap-2 hover:text-[#2c8374] transition-all duration-200 group lg:hidden ${focusRing}`}
      >
        <span className="text-xl md:text-2xl group-hover:scale-110 transition-transform">🧘</span>
        <span className="text-[#2c8374] font-semibold hidden sm:inline">
          Lugn & Trygg
        </span>
      </Link>

      {/* Navigation Links */}
      <div className="flex items-center gap-1 md:gap-2">
        {isLoggedIn ? (
          <>
            {/* Separator */}
            <div className="hidden md:block w-px h-7 bg-[#e8dcd0] mx-1"></div>

            {/* Användarnamn och Premium-badge - endast stora skärmar */}
            <div className="hidden xl:flex items-center gap-2 px-2">
              {isPremium && (
                <span className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                  <SparklesIcon className="w-3 h-3" />
                  {planBadgeLabel}
                </span>
              )}
              <span className="text-[#6d645d] text-sm">
                Hej, {extractDisplayName(user?.email || '')}
              </span>
            </div>

            {/* Uppgradera-knapp för gratisanvändare */}
            {!isPremium && !subscriptionLoading && (
              <Link
                to="/upgrade"
                className={`hidden md:flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm shadow-md hover:shadow-lg ${focusRing}`}
                aria-label="Uppgradera till premium"
              >
                <SparklesIcon className="w-4 h-4" />
                <span>Uppgradera</span>
              </Link>
            )}

            {/* Tema-knapp */}
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center w-9 h-9 bg-[#f2e4d4] hover:bg-[#e8dcd0] text-[#6d645d] hover:text-[#2f2a24] rounded-xl transition-all duration-200 ${focusRing}`}
              aria-label={isDarkMode ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
              title={isDarkMode ? 'Ljust läge' : 'Mörkt läge'}
            >
              <span className="text-base">{isDarkMode ? '☀️' : '🌙'}</span>
            </button>

            {/* Språkväljare */}
            <LanguageSwitcher />

            {/* Logga ut-knapp */}
            <button
              onClick={logout}
              className={`flex items-center gap-1.5 bg-[#c08a5d] hover:bg-[#8f6a4a] text-white px-2.5 md:px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm ${focusRing}`}
              title="Logga ut"
            >
              <span className="text-base">🚪</span>
              <span className="hidden sm:inline">Logga ut</span>
            </button>
          </>
        ) : (
          <>
            {/* Ej inloggad - visa logga in och registrera */}
            <Link
              to="/login"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm ${focusRing} ${isActive('/login')
                ? 'bg-[#2c8374] text-white'
                : 'text-[#6d645d] hover:text-[#2f2a24] hover:bg-[#f2e4d4]'
                }`}
              aria-current={isActive('/login') ? 'page' : undefined}
            >
              <span>🔑</span>
              <span>{t('auth.login')}</span>
            </Link>

            <Link
              to="/register"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition-all duration-200 text-sm ${focusRing} ${isActive('/register')
                ? 'bg-[#2c8374] text-white'
                : 'text-[#6d645d] hover:text-[#2f2a24] hover:bg-[#f2e4d4]'
                }`}
              aria-current={isActive('/register') ? 'page' : undefined}
            >
              <span>✨</span>
              <span>{t('auth.register')}</span>
            </Link>

            {/* Tema */}
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center w-9 h-9 bg-[#f2e4d4] hover:bg-[#e8dcd0] text-[#6d645d] hover:text-[#2f2a24] rounded-xl transition-all duration-200 ${focusRing}`}
              aria-label={isDarkMode ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
            >
              <span className="text-base">{isDarkMode ? '☀️' : '🌙'}</span>
            </button>

            {/* Språk */}
            <LanguageSwitcher />
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
