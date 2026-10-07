import React, { memo, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  HomeIcon,
  FaceSmileIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  Squares2X2Icon,
  XMarkIcon,
  SparklesIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  FaceSmileIcon as FaceSmileIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  Squares2X2Icon as Squares2X2IconSolid,
} from '@heroicons/react/24/solid';
import {
  FREE_NAV_ITEMS,
  PREMIUM_NAV_ITEMS,
  SECONDARY_LINKS,
  type NavItem,
} from '../../config/navItems';

const EXPLORE_PATH = '/__explore';
const CRISIS_PATH = '/crisis';

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', labelKey: 'bottomNav.home', labelDefault: 'Hem', icon: HomeIcon, iconActive: HomeIconSolid },
  { path: '/mood-basic', labelKey: 'bottomNav.mood', labelDefault: 'Humör', icon: FaceSmileIcon, iconActive: FaceSmileIconSolid },
  { path: '/ai-chat', labelKey: 'bottomNav.ai', labelDefault: 'AI', icon: ChatBubbleLeftRightIcon, iconActive: ChatBubbleLeftRightIconSolid },
  { path: EXPLORE_PATH, labelKey: 'bottomNav.explore', labelDefault: 'Utforska', icon: Squares2X2Icon, iconActive: Squares2X2IconSolid },
  { path: '/profile', labelKey: 'bottomNav.profile', labelDefault: 'Profil', icon: UserCircleIcon, iconActive: UserCircleIconSolid },
];

/*
 * The "Utforska" sheet is the mobile counterpart of the sidebar, so it is
 * built from the same lists. It used to be a hand-written list of nine tiles
 * next to a hamburger drawer that listed all twenty routes: two menus for the
 * same screen, which disagreed (the sheet had no /crisis, /analytics,
 * /integrations, ...). Now the sheet holds every route the bottom bar does not,
 * and the hamburger is gone for signed-in users.
 */
const BAR_PATHS = new Set(NAV_ITEMS.map((item) => item.path));
const EXPLORE_TILES: NavItem[] = [...FREE_NAV_ITEMS, ...PREMIUM_NAV_ITEMS].filter(
  (item) => !BAR_PATHS.has(item.path) && item.path !== CRISIS_PATH,
);
const CRISIS_ITEM = FREE_NAV_ITEMS.find((item) => item.path === CRISIS_PATH);

const DEFAULT_TILE_COLOR = 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
const TILE_COLORS: Record<string, string> = {
  '/daily-insights': 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
  '/mood/assessment': 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
  '/wellness': 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-300',
  '/journal': 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-300',
  '/recommendations': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
  '/ai-stories': 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300',
  '/insights': 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300',
  '/rewards': 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300',
  '/social': 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300',
  '/analytics': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300',
  '/mood/advanced': 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300',
  '/mood/forecast': 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300',
  '/weekly-analysis': 'bg-lime-50 text-lime-700 dark:bg-lime-900/20 dark:text-lime-300',
};

/**
 * Bottom Navigation Component
 * 
 * Mobile-only bottom navigation bar with 5 main links.
 * The "Utforska" tab opens a bottom sheet with all features.
 */
const BottomNav: React.FC = memo(() => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isPremium, isTrial } = useSubscription();
  // A trial has every feature unlocked: no PRO badges or upgrade prompt for it
  // (UI audit Dup-11).
  const hasFullAccess = isPremium || isTrial;
  const [showExplore, setShowExplore] = useState(false);

  const isActiveRoute = useCallback(
    (path: string) => matchPath({ path, end: true }, location.pathname) !== null,
    [location.pathname]
  );

  const handleNavClick = useCallback((path: string) => {
    if (path === EXPLORE_PATH) {
      setShowExplore(prev => !prev);
    } else {
      setShowExplore(false);
      navigate(path);
    }
  }, [navigate]);

  const handleTileClick = useCallback((path: string) => {
    setShowExplore(false);
    navigate(path);
  }, [navigate]);

  return (
    <>
      {/* Explore bottom sheet overlay */}
      {showExplore && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
          onClick={() => setShowExplore(false)}
          aria-hidden="true"
        />
      )}

      {/* Explore bottom sheet */}
      {showExplore && (
        <div
          role="dialog"
          aria-label={t('bottomNav.exploreAllFeatures', 'Utforska alla funktioner')}
          className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-0 right-0 z-60 bg-calm-50 dark:bg-slate-900 border-t border-[#f2e4d4] dark:border-slate-700 rounded-t-3xl shadow-2xl animate-slide-up duration-300 max-h-[75vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f2e4d4] dark:border-slate-700">
            <h2 className="text-base font-bold text-[#2f2a24] dark:text-white">{t('bottomNav.exploreAllFeatures', 'Utforska alla funktioner')}</h2>
            <button
              type="button"
              onClick={() => setShowExplore(false)}
              className="p-2 rounded-xl text-[#6d645d] hover:bg-[#f2e4d4] dark:text-gray-400 dark:hover:bg-slate-800 transition-colors"
              aria-label={t('common.close', 'Stäng')}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4">
            {CRISIS_ITEM && (
              <Link
                to={CRISIS_ITEM.path}
                onClick={() => setShowExplore(false)}
                className="flex items-center gap-3 w-full mb-4 p-3 min-h-[44px] rounded-2xl border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200 font-semibold text-sm"
              >
                <PhoneIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{t(CRISIS_ITEM.labelKey, CRISIS_ITEM.labelDefault)}</span>
              </Link>
            )}

            {!hasFullAccess && (
              <Link
                to="/upgrade"
                onClick={() => setShowExplore(false)}
                className="flex items-center gap-3 w-full mb-4 p-3 rounded-2xl bg-linear-to-r from-[#2c8374] to-[#3a9d8c] text-white font-semibold text-sm shadow-md"
              >
                <SparklesIcon className="w-5 h-5 shrink-0" />
                <span>{t('bottomNav.upgradeUnlockAll', 'Uppgradera till Premium — lås upp allt')}</span>
              </Link>
            )}

            <div className="grid grid-cols-3 gap-3">
              {EXPLORE_TILES.map((tile) => {
                const Icon = tile.icon;
                const isLocked = tile.premium && !hasFullAccess;
                const label = t(tile.labelKey, tile.labelDefault);
                return (
                  <button
                    key={tile.path}
                    type="button"
                    onClick={() => handleTileClick(tile.path)}
                    aria-label={label}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border border-transparent transition-all duration-200 active:scale-95 ${TILE_COLORS[tile.path] ?? DEFAULT_TILE_COLOR}`}
                  >
                    {isLocked && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-white">
                        PRO
                      </span>
                    )}
                    <Icon className="w-7 h-7" aria-hidden="true" />
                    <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>

            <ul className="mt-4 pt-3 border-t border-[#f2e4d4] dark:border-slate-700">
              {SECONDARY_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      onClick={() => setShowExplore(false)}
                      className="flex items-center gap-3 px-2 py-2 min-h-[44px] rounded-xl text-sm text-[#6d645d] hover:bg-[#f2e4d4] dark:text-gray-300 dark:hover:bg-slate-800"
                    >
                      <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>{t(link.labelKey, link.labelDefault)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#fff7f0]/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-[#f2e4d4] dark:border-slate-700"
        aria-label={t('bottomNav.mobileNavigationAria', 'Mobilnavigation')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const isExplore = item.path === EXPLORE_PATH;
            const active = isExplore ? showExplore : isActiveRoute(item.path);
            const Icon = active ? item.iconActive : item.icon;
            const label = t(item.labelKey, item.labelDefault);

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`
                  flex flex-col items-center justify-center min-w-[60px] min-h-[44px] py-2 px-3 rounded-xl transition-all duration-200
                  ${active
                    /* Resting colours were #a89f97 (2.60:1 on white) and
                       gray-500 (3.69:1 on slate-900) at 11px — both below the
                       4.5:1 WCAG 2.1 AA floor for normal text, on the app's
                       PRIMARY navigation. #6d645d was already the hover colour
                       here and measures 5.78:1; gray-400 measures 7.03:1. The
                       palette already contained accessible values, they were
                       just being saved for hover. */
                    ? 'text-[#2c8374]'
                    : 'text-[#6d645d] hover:text-[#2f2a24] dark:text-gray-400 dark:hover:text-gray-200'
                  }
                `}
                aria-current={active && !isExplore ? 'page' : undefined}
                aria-expanded={isExplore ? showExplore : undefined}
                aria-label={label}
              >
                <div className={`
                  relative p-2 rounded-xl transition-all duration-200
                  ${active ? 'bg-[#2c8374]/10' : ''}
                `}>
                  <Icon className="w-6 h-6" />
                  {active && !isExplore && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#2c8374] rounded-full" />
                  )}
                </div>
                <span className={`
                  text-[11px] font-medium mt-1 transition-all duration-200
                  ${active ? 'text-[#2c8374] font-semibold' : ''}
                `}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
