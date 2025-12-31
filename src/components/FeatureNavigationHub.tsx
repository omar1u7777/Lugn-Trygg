/**
 * Feature Navigation Hub - Snabb åtkomst till alla funktioner
 * Ger användaren tillgång till alla 27 huvudfunktioner i appen
 */
import React, { useState, Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, Transition } from '@headlessui/react';
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface MenuItem {
  path: string;
  label: string;
  emoji: string;
  category: string;
}

const allFeatures: MenuItem[] = [
  // Huvudfunktioner
  { path: '/dashboard', label: 'Översikt', emoji: '📊', category: 'Huvudmeny' },
  { path: '/wellness', label: 'Välmående', emoji: '🌿', category: 'Huvudmeny' },
  { path: '/profile', label: 'Min Profil', emoji: '👤', category: 'Huvudmeny' },

  // AI & Chatt
  { path: '/ai-chat', label: 'AI-assistent', emoji: '🤖', category: 'AI & Chatt' },
  { path: '/voice-chat', label: 'Röstsamtal', emoji: '🎤', category: 'AI & Chatt' },

  // Humör & Hälsa
  { path: '/mood-logger', label: 'Logga Humör', emoji: '📝', category: 'Humör & Hälsa' },
  { path: '/mood-list', label: 'Humörhistorik', emoji: '📋', category: 'Humör & Hälsa' },
  { path: '/daily-insights', label: 'Dagliga Insikter', emoji: '📅', category: 'Humör & Hälsa' },
  { path: '/weekly-analysis', label: 'Veckoanalys', emoji: '📈', category: 'Humör & Hälsa' },
  { path: '/recommendations', label: 'Rekommendationer', emoji: '💡', category: 'Humör & Hälsa' },
  { path: '/crisis', label: 'Krisstöd', emoji: '🚨', category: 'Humör & Hälsa' },

  // Belöningar & Motivation
  { path: '/gamification', label: 'Utmaningar', emoji: '🏆', category: 'Belöningar' },
  { path: '/badges', label: 'Prestationer', emoji: '🎖️', category: 'Belöningar' },
  { path: '/rewards', label: 'Belöningar', emoji: '🎁', category: 'Belöningar' },

  // Dagbok & Berättelser
  { path: '/journal', label: 'Dagbok', emoji: '📖', category: 'Dagbok' },
  { path: '/ai-stories', label: 'AI-berättelser', emoji: '📚', category: 'Dagbok' },
  { path: '/story-insights', label: 'Berättelseinsikter', emoji: '✨', category: 'Dagbok' },

  // Avslappning
  { path: '/sounds', label: 'Avslappningsljud', emoji: '🎵', category: 'Avslappning' },
  { path: '/integrations', label: 'Hälsokopplingar', emoji: '🔗', category: 'Avslappning' },

  // Socialt & Gemenskap
  { path: '/social', label: 'Gemenskap', emoji: '👥', category: 'Socialt' },
  { path: '/referral', label: 'Bjud in vänner', emoji: '🎉', category: 'Socialt' },

  // Analys & Statistik
  { path: '/insights', label: 'Insikter', emoji: '💡', category: 'Analys' },
  { path: '/analytics', label: 'Humörstatistik', emoji: '📊', category: 'Analys' },

  // Inställningar
  { path: '/onboarding', label: 'Kom igång', emoji: '👋', category: 'Inställningar' },
  { path: '/privacy', label: 'Sekretess', emoji: '🔒', category: 'Inställningar' },
  { path: '/subscribe', label: 'Premium', emoji: '💳', category: 'Inställningar' },
  { path: '/feedback', label: 'Feedback', emoji: '📝', category: 'Inställningar' },
];

const FeatureNavigationHub: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  // ✅ REMOVED: const theme = useTheme(); - MUI hook not needed
  // ✅ REMOVED: const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Huvudmeny': true,
  });

  if (!isLoggedIn) {
    return null;
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const categories = Array.from(new Set(allFeatures.map(f => f.category)));

  const drawerContent = (
    <div className="w-80 h-full bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-[210]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🌟 Alla Funktioner
          </h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Stäng meny"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {categories.map(category => {
          const categoryFeatures = allFeatures.filter(f => f.category === category);
          const isExpanded = expandedCategories[category];

          return (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <h3 className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {category} ({categoryFeatures.length})
                </h3>
                {isExpanded ? (
                  <ChevronUpIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                )}
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-1">
                  {categoryFeatures.map(feature => {
                    const isActive = location.pathname === feature.path;
                    return (
                      <Link
                        key={feature.path}
                        to={feature.path}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 pl-6 pr-3 py-2 rounded-lg transition-colors ${isActive
                            ? 'bg-primary-600 text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}
                      >
                        <span className="text-xl">{feature.emoji}</span>
                        <span className="text-sm font-medium">{feature.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Menu Button - z-[90] to stay below Navigation but above content */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 z-[90] w-16 h-16 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center ring-4 ring-primary-600/20 lg:hidden"
        aria-label="Öppna meny"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>

      {/* Headless UI Dialog (replaces MUI Drawer) - z-[200] to appear above everything */}
      <Transition appear show={drawerOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[200]" onClose={() => setDrawerOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-300"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-300"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                    {drawerContent}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default FeatureNavigationHub;
