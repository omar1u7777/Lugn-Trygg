import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { Link, useLocation, matchPath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  FREE_NAV_ITEMS,
  PREMIUM_NAV_ITEMS,
  SECONDARY_LINKS,
  type NavItem,
} from '../../config/navItems';
import {
  UserCircleIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import {
  UserCircleIcon as UserCircleIconSolid,
} from '@heroicons/react/24/solid';

const PREMIUM_PATHS = new Set(PREMIUM_NAV_ITEMS.map(i => i.path));

/** Helper that also expands when the user is on a nested premium route. */
const isPremiumPath = (pathname: string): boolean =>
  PREMIUM_PATHS.has(pathname) || PREMIUM_NAV_ITEMS.some(
    item => matchPath({ path: item.path, end: false }, pathname) !== null
  );


const BOTTOM_ITEMS: NavItem[] = [
  { path: '/profile', labelKey: 'sidebar.profile', labelDefault: 'Profil', icon: UserCircleIcon, iconActive: UserCircleIconSolid },
];

/**
 * Sidebar Navigation Component
 * 
 * Desktop-only sidebar with main navigation links.
 * Optimized with React.memo and useMemo for performance.
 * 
 * @component
 * @example
 * <Sidebar />
 */
const Sidebar: React.FC = memo(() => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isPremium } = useSubscription();

  // Centralized, robust active-state helper using React Router's matchPath.
  const isActiveRoute = useCallback(
    (path: string, allowNested = false) => matchPath({ path, end: !allowNested }, location.pathname) !== null,
    [location.pathname]
  );

  // Auto-expand premium section when the user navigates to a premium route (including nested children).
  const [isPremiumExpanded, setIsPremiumExpanded] = useState(() => isPremiumPath(location.pathname));
  useEffect(() => {
    if (isPremiumPath(location.pathname)) {
      setIsPremiumExpanded(true);
    }
  }, [location.pathname]);

  // Memoize the data, not the JSX.
  const navItems = useMemo(() => (isPremium ? [...FREE_NAV_ITEMS, ...PREMIUM_NAV_ITEMS] : FREE_NAV_ITEMS), [isPremium]);

  return (
    <aside
      className="hidden lg:flex flex-col w-64 fixed left-0 top-0 h-screen bg-calm-50 dark:bg-slate-900 border-r border-[#e8dcd0] dark:border-slate-800 z-100 transition-colors duration-300 overflow-hidden"
      aria-label={t('sidebar.mainNavigationAria', 'Huvudnavigation')}
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-[#f2e4d4] dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-teal-500 to-violet-600 flex items-center justify-center shadow-md">
            <span className="text-xl" aria-hidden="true">🧘</span>
          </div>
          <div>
            <h2 className="font-bold text-[#2f2a24] dark:text-white">{t('app.name', 'Lugn & Trygg')}</h2>
            <p className="text-xs text-[#6d645d] dark:text-gray-400">{t('app.description', 'Mental välmående')}</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 min-h-0 p-4 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = isActiveRoute(item.path, item.allowNested);
            const Icon = active ? item.iconActive : item.icon;
            const label = t(item.labelKey, item.labelDefault);

            return (
              <Link
                key={item.path}
                to={item.path}
                title={label}
                className={`
                  flex w-full min-w-0 items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  group relative
                  ${active
                    ? 'bg-linear-to-r from-teal-500 to-violet-600 text-white shadow-md shadow-teal-500/20'
                    : 'text-[#6d645d] hover:bg-[#f2e4d4] hover:text-[#2f2a24] dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  }
                `}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 min-w-0 line-clamp-2 leading-5">{label}</span>
              </Link>
            );
          })}

          {/* Collapsible premium section — reduces sidebar clutter for free users */}
          {!isPremium && (
            <>
              <button
                type="button"
                onClick={() => setIsPremiumExpanded(prev => !prev)}
                className="flex items-center justify-between w-full px-4 py-2.5 mt-1 rounded-xl text-[#6d645d] dark:text-gray-400 hover:bg-[#f2e4d4] dark:hover:bg-slate-800 font-medium transition-all duration-200"
                aria-expanded={isPremiumExpanded}
                aria-controls="premium-nav-section"
                // The count badge is visually separated but sits inside the
                // button, so it was concatenated straight into the accessible
                // name: screen readers announced "Premium-funktioner11". The
                // label states the count in words and the badge is hidden from
                // assistive tech, which already knows it from the label.
                aria-label={`${t('sidebar.premiumFeatures', 'Premium-funktioner')} (${PREMIUM_NAV_ITEMS.length})`}
              >
                <div className="flex items-center gap-3">
                  <SparklesIcon className="w-5 h-5 text-amber-500" />
                  <span className="text-sm">{t('sidebar.premiumFeatures', 'Premium-funktioner')}</span>
                  <span
                    aria-hidden="true"
                    className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  >
                    {PREMIUM_NAV_ITEMS.length}
                  </span>
                </div>
                {isPremiumExpanded
                  ? <ChevronUpIcon className="w-4 h-4 shrink-0" />
                  : <ChevronDownIcon className="w-4 h-4 shrink-0" />}
              </button>

              {isPremiumExpanded && (
                <div id="premium-nav-section" className="mt-0.5 ml-3 pl-3 border-l-2 border-[#f2e4d4] dark:border-slate-700 space-y-0.5">
                  {PREMIUM_NAV_ITEMS.map((item) => {
                    const active = isActiveRoute(item.path, item.allowNested);
                    const Icon = active ? item.iconActive : item.icon;
                    const label = t(item.labelKey, item.labelDefault);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={label}
                        className={`
                          flex w-full min-w-0 items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200
                          ${active
                            ? 'bg-[#2c8374] text-white shadow-md shadow-[#2c8374]/20'
                            : 'text-[#6d645d] hover:bg-[#f2e4d4] hover:text-[#2f2a24] dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-white'
                          }
                        `}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 min-w-0 line-clamp-1 text-sm leading-5">{label}</span>
                        <span className="flex shrink-0 items-center bg-linear-to-r from-amber-400 to-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          <SparklesIcon className="w-3 h-3" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Premium Upgrade Card */}
        {!isPremium && (
          <PremiumUpgradeCard />
        )}

        {/* Secondary utility links */}
        <div className="mt-4 pt-4 border-t border-[#f2e4d4] dark:border-slate-700 space-y-0.5">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#a89f97] dark:text-slate-500">
            {t('sidebar.accountAndMore', 'Konto & Mer')}
          </p>
          {SECONDARY_LINKS.map((link) => {
            const active = isActiveRoute(link.path);
            const Icon = link.icon;
            const label = t(link.labelKey, link.labelDefault);

            return (
              <Link
                key={link.path}
                to={link.path}
                title={label}
                className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200
                  ${active
                    ? 'bg-[#2c8374] text-white'
                    : 'text-[#6d645d] hover:bg-[#f2e4d4] hover:text-[#2f2a24] dark:text-gray-500 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="min-w-0 truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-[#f2e4d4] dark:border-slate-700">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActiveRoute(item.path, item.allowNested);
          const Icon = active ? item.iconActive : item.icon;
          const label = t(item.labelKey, item.labelDefault);

          return (
            <Link
              key={item.path}
              to={item.path}
              title={label}
              className={`
                flex w-full min-w-0 items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                ${active
                  ? 'bg-[#2c8374] text-white shadow-md'
                  : 'text-[#6d645d] hover:bg-[#f2e4d4] hover:text-[#2f2a24] dark:text-gray-400 dark:hover:bg-slate-800'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="min-w-0 line-clamp-2 leading-5">{label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

/**
 * Premium Upgrade Card Component
 * Memoized to prevent unnecessary re-renders
 */
const PremiumUpgradeCard: React.FC = memo(() => {
  const { t } = useTranslation();
  return (
    <div className="mt-6 p-4 rounded-2xl bg-linear-to-br from-[#fff7f0] to-[#f2e4d4] dark:from-slate-800 dark:to-slate-700 border border-[#e8dcd0] dark:border-slate-600">
      <div className="flex items-center gap-2 mb-2">
        <SparklesIcon className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-[#2f2a24] dark:text-white text-sm">
          {t('sidebar.upgradeToPremium', 'Uppgradera till Premium')}
        </span>
      </div>
      <p className="text-xs text-[#6d645d] dark:text-gray-400 mb-3">
        {t('sidebar.unlockFeatures', {
          defaultValue: 'Lås upp {{count}} exklusiva funktioner',
          count: PREMIUM_NAV_ITEMS.length,
        })}
      </p>
      <Link
        to="/upgrade"
        className="block w-full text-center py-2 px-3 bg-linear-to-r from-[#2c8374] to-[#3a9d8c] text-white text-sm font-semibold rounded-xl hover:from-[#1e5f54] hover:to-[#2c8374] transition-all shadow-xs"
      >
        {t('sidebar.seePremium', 'Se Premium →')}
      </Link>
    </div>
  );
});

PremiumUpgradeCard.displayName = 'PremiumUpgradeCard';

export default Sidebar;
