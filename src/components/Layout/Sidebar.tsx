import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  HomeIcon,
  FaceSmileIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  SparklesIcon,
  HeartIcon,
  BookOpenIcon,
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  MicrophoneIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  FaceSmileIcon as FaceSmileIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  SparklesIcon as SparklesIconSolid,
  HeartIcon as HeartIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  TrophyIcon as TrophyIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  MicrophoneIcon as MicrophoneIconSolid,
} from '@heroicons/react/24/solid';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  iconActive: React.ElementType;
  premium?: boolean;
}

/** Always-visible items (available on the free plan). */
const FREE_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Hem', icon: HomeIcon, iconActive: HomeIconSolid },
  { path: '/mood-basic', label: 'Humör', icon: FaceSmileIcon, iconActive: FaceSmileIconSolid },
  { path: '/ai-chat', label: 'AI Stöd', icon: ChatBubbleLeftRightIcon, iconActive: ChatBubbleLeftRightIconSolid },
];

/** [U1] Premium items grouped separately — free users see a collapsed section instead of 10+ cluttered items. */
const PREMIUM_NAV_ITEMS: NavItem[] = [
  { path: '/voice-chat', label: 'Röstanalys', icon: MicrophoneIcon, iconActive: MicrophoneIconSolid, premium: true },
  { path: '/recommendations', label: 'Rekommendationer', icon: SparklesIcon, iconActive: SparklesIconSolid, premium: true },
  { path: '/wellness', label: 'Välmående', icon: HeartIcon, iconActive: HeartIconSolid, premium: true },
  { path: '/journal', label: 'Dagbok', icon: BookOpenIcon, iconActive: BookOpenIconSolid, premium: true },
  { path: '/insights', label: 'Insikter', icon: ChartBarIcon, iconActive: ChartBarIconSolid, premium: true },
  { path: '/rewards', label: 'Belöningar', icon: TrophyIcon, iconActive: TrophyIconSolid, premium: true },
  { path: '/social', label: 'Gemenskap', icon: UserGroupIcon, iconActive: UserGroupIconSolid, premium: true },
];

/** Quick lookup: auto-expand the premium section when navigating to a premium route. */
const PREMIUM_PATHS = new Set(PREMIUM_NAV_ITEMS.map(i => i.path));

const BOTTOM_ITEMS: NavItem[] = [
  { path: '/profile', label: 'Profil', icon: UserCircleIcon, iconActive: UserCircleIconSolid },
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
  const location = useLocation();
  const { isPremium } = useSubscription();

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  // [U1] Auto-expand premium section when the user navigates to a premium route.
  const [isPremiumExpanded, setIsPremiumExpanded] = useState(
    () => PREMIUM_PATHS.has(location.pathname)
  );
  useEffect(() => {
    if (PREMIUM_PATHS.has(location.pathname)) {
      setIsPremiumExpanded(true);
    }
  }, [location.pathname]);

  // [U1] Render free items always; premium users get all items in a flat list.
  const navItemsRendered = useMemo(() => {
    const items = isPremium ? [...FREE_NAV_ITEMS, ...PREMIUM_NAV_ITEMS] : FREE_NAV_ITEMS;
    return items.map((item) => {
      const active = location.pathname === item.path;
      const Icon = active ? item.iconActive : item.icon;

      return (
        <Link
          key={item.path}
          to={item.path}
          title={item.label}
          className={`
            flex w-full min-w-0 items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
            group relative
            ${active
              ? 'bg-[#2c8374] text-white shadow-md shadow-[#2c8374]/20'
              : 'text-[#6d645d] hover:bg-[#f2e4d4] hover:text-[#2f2a24] dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }
          `}
          aria-current={active ? 'page' : undefined}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 min-w-0 line-clamp-2 leading-5">{item.label}</span>
        </Link>
      );
    });
  }, [location.pathname, isPremium]);

  return (
    <aside
      className="hidden lg:flex flex-col w-64 fixed left-0 top-0 h-screen bg-[#fff7f0] dark:bg-slate-900 border-r border-[#e8dcd0] dark:border-slate-800 z-[100] transition-colors duration-300 overflow-hidden overflow-x-hidden"
      aria-label="Huvudnavigation"
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-[#f2e4d4] dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2c8374] to-[#3a9d8c] flex items-center justify-center shadow-md">
            <span className="text-xl">🧘</span>
          </div>
          <div>
            <h2 className="font-bold text-[#2f2a24] dark:text-white">Lugn & Trygg</h2>
            <p className="text-xs text-[#6d645d] dark:text-gray-400">Mental välmående</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 min-h-0 p-4 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1">
          {navItemsRendered}

          {/* [U1] Collapsible premium section — reduces sidebar clutter for free users */}
          {!isPremium && (
            <>
              <button
                type="button"
                onClick={() => setIsPremiumExpanded(prev => !prev)}
                className="flex items-center justify-between w-full px-4 py-2.5 mt-1 rounded-xl text-[#6d645d] dark:text-gray-400 hover:bg-[#f2e4d4] dark:hover:bg-slate-800 font-medium transition-all duration-200"
                aria-expanded={isPremiumExpanded}
                aria-controls="premium-nav-section"
              >
                <div className="flex items-center gap-3">
                  <SparklesIcon className="w-5 h-5 text-amber-500" />
                  <span className="text-sm">Premium-funktioner</span>
                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {PREMIUM_NAV_ITEMS.length}
                  </span>
                </div>
                {isPremiumExpanded
                  ? <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
                  : <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />}
              </button>

              {isPremiumExpanded && (
                <div id="premium-nav-section" className="mt-0.5 ml-3 pl-3 border-l-2 border-[#f2e4d4] dark:border-slate-700 space-y-0.5">
                  {PREMIUM_NAV_ITEMS.map((item) => {
                    const active = location.pathname === item.path;
                    const Icon = active ? item.iconActive : item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={item.label}
                        className={`
                          flex w-full min-w-0 items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200
                          ${active
                            ? 'bg-[#2c8374] text-white shadow-md shadow-[#2c8374]/20'
                            : 'text-[#6d645d] hover:bg-[#f2e4d4] hover:text-[#2f2a24] dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-white'
                          }
                        `}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 min-w-0 line-clamp-1 text-sm leading-5">{item.label}</span>
                        <span className="flex shrink-0 items-center bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
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
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-[#f2e4d4] dark:border-slate-700">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = active ? item.iconActive : item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
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
              <span className="min-w-0 line-clamp-2 leading-5">{item.label}</span>
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
const PremiumUpgradeCard: React.FC = memo(() => (
  <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-[#fff7f0] to-[#f2e4d4] dark:from-slate-800 dark:to-slate-700 border border-[#e8dcd0] dark:border-slate-600">
    <div className="flex items-center gap-2 mb-2">
      <SparklesIcon className="w-5 h-5 text-amber-500" />
      <span className="font-semibold text-[#2f2a24] dark:text-white text-sm">Uppgradera</span>
    </div>
    <p className="text-xs text-[#6d645d] dark:text-gray-400 mb-3">
      Få tillgång till alla funktioner
    </p>
    <Link
      to="/upgrade"
      className="block w-full text-center py-2 px-3 bg-gradient-to-r from-[#2c8374] to-[#3a9d8c] text-white text-sm font-semibold rounded-xl hover:from-[#1e5f54] hover:to-[#2c8374] transition-all shadow-sm"
    >
      Se Premium →
    </Link>
  </div>
));

PremiumUpgradeCard.displayName = 'PremiumUpgradeCard';

export default Sidebar;
