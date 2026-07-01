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
  MusicalNoteIcon,
  BookOpenIcon,
  HeartIcon,
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  SparklesIcon,
  StarIcon,
  LightBulbIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  FaceSmileIcon as FaceSmileIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  Squares2X2Icon as Squares2X2IconSolid,
} from '@heroicons/react/24/solid';

interface NavItem {
  path: string;
  labelKey: string;
  labelDefault: string;
  icon: React.ElementType;
  iconActive: React.ElementType;
}

interface FeatureTile {
  path: string;
  labelKey: string;
  labelDefault: string;
  icon: React.ElementType;
  premium?: boolean;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', labelKey: 'bottomNav.home', labelDefault: 'Hem', icon: HomeIcon, iconActive: HomeIconSolid },
  { path: '/mood-basic', labelKey: 'bottomNav.mood', labelDefault: 'Humör', icon: FaceSmileIcon, iconActive: FaceSmileIconSolid },
  { path: '/ai-chat', labelKey: 'bottomNav.ai', labelDefault: 'AI', icon: ChatBubbleLeftRightIcon, iconActive: ChatBubbleLeftRightIconSolid },
  { path: '/__explore', labelKey: 'bottomNav.explore', labelDefault: 'Utforska', icon: Squares2X2Icon, iconActive: Squares2X2IconSolid },
  { path: '/profile', labelKey: 'bottomNav.profile', labelDefault: 'Profil', icon: UserCircleIcon, iconActive: UserCircleIconSolid },
];

/** Feature tiles shown in the "Utforska" bottom sheet. */
const EXPLORE_TILES: FeatureTile[] = [
  { path: '/daily-insights', labelKey: 'sidebar.dailyInsights', labelDefault: 'Dagliga insikter', icon: LightBulbIcon, color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300' },
  { path: '/mood/assessment', labelKey: 'sidebar.clinicalAssessment', labelDefault: 'Klinisk bedömning', icon: ClipboardDocumentCheckIcon, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300' },
  { path: '/wellness', labelKey: 'sidebar.premium.wellness', labelDefault: 'Välmående', icon: HeartIcon, premium: true, color: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-300' },
  { path: '/sounds', labelKey: 'sidebar.premium.sounds', labelDefault: 'Lugnande ljud', icon: MusicalNoteIcon, premium: true, color: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-300' },
  { path: '/journal', labelKey: 'sidebar.premium.journal', labelDefault: 'Dagbok', icon: BookOpenIcon, premium: true, color: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-300' },
  { path: '/recommendations', labelKey: 'sidebar.premium.recommendations', labelDefault: 'Rekommendationer', icon: SparklesIcon, premium: true, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' },
  { path: '/ai-stories', labelKey: 'sidebar.premium.aiStories', labelDefault: 'AI-berättelser', icon: StarIcon, premium: true, color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300' },
  { path: '/insights', labelKey: 'sidebar.premium.insights', labelDefault: 'Insikter', icon: ChartBarIcon, premium: true, color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300' },
  { path: '/rewards', labelKey: 'sidebar.premium.rewards', labelDefault: 'Belöningar', icon: TrophyIcon, premium: true, color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300' },
  { path: '/social', labelKey: 'sidebar.premium.community', labelDefault: 'Gemenskap', icon: UserGroupIcon, premium: true, color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300' },
];

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
  const { isPremium } = useSubscription();
  const [showExplore, setShowExplore] = useState(false);

  const isActiveRoute = useCallback(
    (path: string) => matchPath({ path, end: true }, location.pathname) !== null,
    [location.pathname]
  );

  const handleNavClick = useCallback((path: string) => {
    if (path === '/__explore') {
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
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setShowExplore(false)}
          aria-hidden="true"
        />
      )}

      {/* Explore bottom sheet */}
      {showExplore && (
        <div
          role="dialog"
          aria-label={t('bottomNav.exploreAllFeatures', 'Utforska alla funktioner')}
          className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-0 right-0 z-[60] bg-[#fff7f0] dark:bg-slate-900 border-t border-[#f2e4d4] dark:border-slate-700 rounded-t-3xl shadow-2xl animate-slide-up duration-300 max-h-[75vh] overflow-y-auto"
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
            {!isPremium && (
              <Link
                to="/upgrade"
                onClick={() => setShowExplore(false)}
                className="flex items-center gap-3 w-full mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#2c8374] to-[#3a9d8c] text-white font-semibold text-sm shadow-md"
              >
                <SparklesIcon className="w-5 h-5 flex-shrink-0" />
                <span>{t('bottomNav.upgradeUnlockAll', 'Uppgradera till Premium — lås upp allt')}</span>
              </Link>
            )}

            <div className="grid grid-cols-3 gap-3">
              {EXPLORE_TILES.map((tile) => {
                const Icon = tile.icon;
                const isLocked = tile.premium && !isPremium;
                const label = t(tile.labelKey, tile.labelDefault);
                return (
                  <button
                    key={tile.path}
                    type="button"
                    onClick={() => handleTileClick(tile.path)}
                    aria-label={label}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border border-transparent transition-all duration-200 active:scale-95 ${tile.color}`}
                  >
                    {isLocked && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-white">
                        PRO
                      </span>
                    )}
                    <Icon className="w-7 h-7" />
                    <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
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
            const isExplore = item.path === '/__explore';
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
                    ? 'text-[#2c8374]'
                    : 'text-[#a89f97] hover:text-[#6d645d] dark:text-gray-500 dark:hover:text-gray-300'
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
