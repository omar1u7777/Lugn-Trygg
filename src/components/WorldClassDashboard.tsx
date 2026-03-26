import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HeartIcon,
  ChatBubbleLeftRightIcon,
  TrophyIcon,
  SparklesIcon,
  BookOpenIcon
} from '@heroicons/react/24/solid';

// Tailwind Components
import { Button } from './ui/tailwind/Button';
import { Card } from './ui/tailwind/Card';
import { Alert } from './ui/tailwind/Feedback';
import { Snackbar } from './ui/tailwind';

// Dashboard Components (Extracted for maintainability)
import { DashboardHeader } from './Dashboard/DashboardHeader';
import { DashboardStats } from './Dashboard/DashboardStats';
import { DashboardActivity, type ActivityItem } from './Dashboard/DashboardActivity';
import { DashboardQuickActions } from './Dashboard/DashboardQuickActions';

// Feature Components - Direct imports to prevent code splitting
import MoodLogger from './MoodLogger';
import MoodList from './MoodList';
import WorldClassAIChat from './WorldClassAIChat';
import WorldClassGamification from './WorldClassGamification';
import WellnessGoalsOnboarding from './Wellness/WellnessGoalsOnboarding';
import { PremiumGate } from './PremiumGate';
import { UsageLimitBanner } from './UsageLimitBanner';

// Hooks and Services
import { useAccessibility } from '../hooks/useAccessibility';
import { useDashboardData } from '../hooks/useDashboardData';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getWellnessGoalIcon } from '../constants/wellnessGoals';
import { getSubscriptionStatus } from '../api/subscription';
import { analytics } from '../services/analytics';
import { logger } from '../utils/logger';
import useAuth from '../hooks/useAuth';
import { formatNumber } from '../utils/intlFormatters';

interface WorldClassDashboardProps {
  userId?: string;
}

const WorldClassAnalyticsView = lazy(() => import('./WorldClassAnalytics'));
const RecommendationsPanel = lazy(() => import('./Recommendations'));

const FeatureViewFallback = ({ label }: { label: string }) => (
  <div className="p-6 text-center text-gray-600 dark:text-gray-300">
    <span className="animate-pulse">{label}</span>
  </div>
);

const RecommendationsSkeleton = () => (
  <div className="space-y-4" aria-hidden="true">
    <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((placeholder) => (
        <div
          key={placeholder}
          className="h-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/80 animate-pulse"
        ></div>
      ))}
    </div>
  </div>
);

/**
 * WorldClassDashboard Component
 * 
 * Main dashboard with personalized mental health overview.
 * Refactored from 1142 lines to maintainable component structure.
 * 
 * Features:
 * - Real-time statistics (mood, streaks, chats, achievements)
 * - Recent activity timeline  
 * - Quick action cards (mood, chat, meditation, journal, wellness, social, insights, rewards)
 * - Multiple view modes (overview, mood, chat, analytics, gamification)
 * - Weekly progress tracking
 * - Responsive design (mobile-first, 640px/768px/1024px breakpoints)
 * - WCAG 2.1 AA accessibility
 * 
 * Architecture:
 * - useDashboardData hook for data fetching + 5min cache
 * - Extracted components: DashboardHeader, DashboardStats, DashboardQuickActions, DashboardActivity
 * - NO MUI - Pure Tailwind CSS
 */
const WorldClassDashboard: React.FC<WorldClassDashboardProps> = ({ userId }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isPremium, refreshSubscription } = useSubscription();

  const resolvedUserId = user?.user_id || userId;

  // Centralized data hook with caching
  const { stats: dashboardStats, loading, error, refresh } = useDashboardData(resolvedUserId);

  const [activeView, setActiveView] = useState<'overview' | 'mood-basic' | 'mood-list' | 'chat' | 'analytics' | 'gamification'>('overview');
  const [showWellnessOnboarding, setShowWellnessOnboarding] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    variant: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    variant: 'info',
  });

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Debug wellness goals and show onboarding if empty
  useEffect(() => {
    if (loading) {
      return;
    }

    logger.debug('Dashboard wellness goals:', { goals: dashboardStats.wellnessGoals });
    const hasGoals = Array.isArray(dashboardStats.wellnessGoals) && dashboardStats.wellnessGoals.length > 0;
    setShowWellnessOnboarding(!hasGoals);
  }, [dashboardStats.wellnessGoals, loading]);

  const safeDashboardStats = {
    totalMoods: dashboardStats.totalMoods || 0,
    totalChats: dashboardStats.totalChats || 0,
    averageMood: dashboardStats.averageMood || 0,
    streakDays: dashboardStats.streakDays || 0,
    weeklyGoal: Math.max(dashboardStats.weeklyGoal || 1, 1),
    weeklyProgress: Math.max(dashboardStats.weeklyProgress || 0, 0),
    wellnessGoals: dashboardStats.wellnessGoals || [],
    recentActivity: dashboardStats.recentActivity || [],
  };

  const hasWellnessGoals = Array.isArray(safeDashboardStats.wellnessGoals) && safeDashboardStats.wellnessGoals.length > 0;
  const shouldRenderWellnessSkeleton = loading && !hasWellnessGoals;
  const shouldReserveRecommendationsSection = loading || hasWellnessGoals;

  // Transform data for component props
  const stats = {
    averageMood: safeDashboardStats.averageMood,
    streakDays: safeDashboardStats.streakDays,
    totalChats: safeDashboardStats.totalChats,
    achievementsCount: Math.floor(safeDashboardStats.streakDays / 7) + Math.floor(safeDashboardStats.totalMoods / 10),
  };

  const formattedWeeklyProgress = formatNumber(safeDashboardStats.weeklyProgress);
  const formattedWeeklyGoal = formatNumber(safeDashboardStats.weeklyGoal);
  const formattedRemainingEntries = formatNumber(
    Math.max(safeDashboardStats.weeklyGoal - safeDashboardStats.weeklyProgress, 0)
  );

  // Transform activities with icons and colors
  // Transform activities with icons and colors
  const activities: ActivityItem[] = safeDashboardStats.recentActivity.map(activity => {
    let Icon = HeartIcon;
    let colorClass = 'text-secondary-500';

    switch (activity.type) {
      case 'mood':
        Icon = HeartIcon;
        colorClass = 'text-secondary-500';
        break;
      case 'chat':
        Icon = ChatBubbleLeftRightIcon;
        colorClass = 'text-primary-500';
        break;
      case 'achievement':
        Icon = TrophyIcon;
        colorClass = 'text-warning-500';
        break;
      case 'meditation':
        Icon = SparklesIcon;
        colorClass = 'text-teal-500';
        break;
      case 'journal':
        Icon = BookOpenIcon;
        colorClass = 'text-indigo-500';
        break;
    }

    return {
      id: activity.id,
      type: activity.type as 'mood' | 'chat' | 'achievement' | 'meditation' | 'journal',
      timestamp: activity.timestamp instanceof Date ? activity.timestamp : new Date(activity.timestamp),
      description: activity.description,
      icon: <Icon className="w-5 h-5 sm:w-6 sm:h-6" />,
      colorClass
    };
  });

  useEffect(() => {
    analytics.page('World Class Dashboard', {
      component: 'WorldClassDashboard',
      userId: user?.user_id,
    });

    if (!loading) {
      announceToScreenReader(t('worldDashboard.dashboardLoaded'), 'polite');
    }
  }, [user?.user_id, loading, announceToScreenReader, t]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutSuccess = params.get('success') === 'true';
    const checkoutCanceled = params.get('canceled') === 'true';

    if (!checkoutSuccess && !checkoutCanceled) {
      return;
    }

    const clearCheckoutParams = () => {
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete('success');
      nextParams.delete('canceled');
      nextParams.delete('session_id');

      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        },
        { replace: true }
      );
    };

    if (checkoutCanceled) {
      setSnackbar({
        open: true,
        message: 'Köpet avbröts. Du kan prova igen när du är redo.',
        variant: 'info',
      });
      clearCheckoutParams();
      return;
    }

    if (!resolvedUserId) {
      setSnackbar({
        open: true,
        message: 'Kunde inte verifiera prenumerationen. Logga in igen och försök på nytt.',
        variant: 'warning',
      });
      clearCheckoutParams();
      return;
    }

    let cancelled = false;

    const syncSubscriptionFromStripe = async () => {
      setSnackbar({
        open: true,
        message: 'Verifierar din betalning och uppdaterar Premium ...',
        variant: 'info',
      });

      const maxAttempts = 5;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const status = await getSubscriptionStatus(resolvedUserId);
          if (status.isPremium || status.isTrial || status.plan === 'enterprise') {
            await refreshSubscription();

            if (!cancelled) {
              setSnackbar({
                open: true,
                message: 'Premium är nu aktivt. Välkommen!',
                variant: 'success',
              });
              analytics.track('Stripe Checkout Synced', {
                component: 'WorldClassDashboard',
                attempts: attempt + 1,
                plan: status.plan,
              });
              clearCheckoutParams();
            }
            return;
          }
        } catch (syncError) {
          logger.warn('Stripe sync polling failed', syncError);
        }

        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      }

      await refreshSubscription();

      if (!cancelled) {
        setSnackbar({
          open: true,
          message: 'Betalningen registrerades. Premium uppdateras inom kort automatiskt.',
          variant: 'warning',
        });
        clearCheckoutParams();
      }
    };

    syncSubscriptionFromStripe().catch((syncError) => {
      logger.error('Stripe checkout sync failed', syncError);
      if (!cancelled) {
        setSnackbar({
          open: true,
          message: 'Kunde inte uppdatera prenumerationen just nu. Försök igen om en stund.',
          variant: 'error',
        });
        clearCheckoutParams();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, refreshSubscription, resolvedUserId]);

  const handleRefresh = () => {
    logger.debug('Dashboard refresh clicked');
    analytics.track('World Class Dashboard Refreshed', {
      component: 'WorldClassDashboard',
      userId: user?.user_id,
    });
    refresh();
  };

  const handleQuickAction = (actionId: string) => {
    analytics.track('Quick Action Taken', {
      action: actionId,
      component: 'WorldClassDashboard',
    });

    // Premium features require subscription check
    const premiumFeatures = ['meditation', 'journal'];

    if (premiumFeatures.includes(actionId) && !isPremium) {
      // Navigate to upgrade page for premium features
      navigate('/upgrade');
      return;
    }

    switch (actionId) {
      case 'mood':
        setActiveView('mood-basic');
        break;
      case 'mood-list':
        setActiveView('mood-list');
        break;
      case 'chat':
        setActiveView('chat');
        break;
      case 'meditation':
        navigate('/wellness');
        break;
      case 'journal':
        navigate('/journal');
        break;
      default:
        break;
    }
  };

  // Error state
  if (error) {
    return (
      <div className="world-class-dashboard p-4 sm:p-6 lg:p-8">
        <Alert variant="error" className="mb-4">
          <strong>{t('worldDashboard.loadError')}:</strong> {error.message}
        </Alert>
        <Button onClick={handleRefresh} variant="primary">
          {t('worldDashboard.tryAgain')}
        </Button>
      </div>
    );
  }

  // Feature view (mood-basic, mood-list, chat, analytics, gamification)
  if (activeView !== 'overview') {
    const handleCloseFeature = () => {
      logger.debug('Feature view closed, refreshing dashboard');
      setActiveView('overview');
      // Refresh dashboard data when returning from feature views
      setTimeout(() => {
        refresh();
      }, 100);
    };

    return (
      <div className="world-class-dashboard">
        <div className="p-4 sm:p-6">
          <Button
            onClick={handleCloseFeature}
            variant="secondary"
            className="min-h-[44px]"
            aria-label={t('worldDashboard.backToDashboard')}
          >
            <span className="mr-2" aria-hidden="true">←</span>
            {t('worldDashboard.backToDashboard')}
          </Button>
        </div>

        {activeView === 'mood-basic' && <MoodLogger />}
        {activeView === 'mood-list' && <MoodList onClose={handleCloseFeature} />}
        {activeView === 'chat' && <WorldClassAIChat onClose={handleCloseFeature} />}
        {activeView === 'analytics' && (
          <Suspense fallback={<FeatureViewFallback label={t('worldDashboard.loadingAnalysis')} />}>
            <WorldClassAnalyticsView onClose={handleCloseFeature} />
          </Suspense>
        )}
        {activeView === 'gamification' && (
          isPremium ? (
            <WorldClassGamification onClose={handleCloseFeature} />
          ) : (
            <PremiumGate
              feature="gamification"
              title={t('worldDashboard.gamificationTitle')}
              description={t('worldDashboard.gamificationDesc')}
            />
          )
        )}
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="world-class-dashboard relative" aria-busy={loading}>
      {showWellnessOnboarding && resolvedUserId && (
        <div className="fixed inset-0 z-[1055] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true"></div>
          <div
            className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('worldDashboard.wellnessGoalsLabel')}
          >
            <WellnessGoalsOnboarding
              userId={resolvedUserId}
              onComplete={(goals) => {
                logger.info('Wellness goals completed', { goals });
                setShowWellnessOnboarding(false);
                refresh();
              }}
              onSkip={() => {
                logger.debug('Wellness goals skipped');
                setShowWellnessOnboarding(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Usage Limit Banner - Shows remaining free tier usage */}
      {!isPremium && (
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <UsageLimitBanner variant="compact" />
        </div>
      )}

      {/* Hero Header */}
      <DashboardHeader
        userName={user?.email?.split('@')[0] || 'vän'}
        onRefresh={handleRefresh}
        isLoading={loading}
      />

      <div className="world-class-dashboard-content px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Prominent Mood Check Section */}
        <Card className="mb-8 border-l-4 border-l-secondary-500">
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block">🧘‍♀️</span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('worldDashboard.howAreYou')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {t('worldDashboard.takeAMoment')}
              </p>
            </div>
            <MoodLogger />
          </div>
        </Card>

        {shouldRenderWellnessSkeleton && (
          <Card className="mb-8 animate-pulse" aria-hidden="true">
            <div className="p-6 sm:p-8 space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300/60 dark:border-gray-700"
                  ></div>
                ))}
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </Card>
        )}

        {/* Wellness Goals Card (Personalized based on onboarding) */}
        {hasWellnessGoals && (
          <Card className="mb-8 border-l-4 border-l-primary-500">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl sm:text-3xl" aria-hidden="true">🎯</span>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {t('worldDashboard.wellnessGoals')}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {safeDashboardStats.wellnessGoals.map((goal) => (
                  <div
                    key={goal}
                    className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800"
                  >
                    <span className="text-xl">
                      {getWellnessGoalIcon(goal)}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {goal}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                {t('worldDashboard.goalRecommendations')}
              </p>
            </div>
          </Card>
        )}

        {shouldRenderWellnessSkeleton && (
          <Card className="mb-8 animate-pulse" aria-hidden="true">
            <div className="p-6 sm:p-8 space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((skeleton) => (
                  <div key={skeleton} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Personalized Recommendations */}
        {shouldReserveRecommendationsSection && (
          <Card className="mb-8" aria-busy={loading} aria-live="polite">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl sm:text-3xl" aria-hidden="true">💡</span>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {t('worldDashboard.personalRecommendations')}
                </h2>
              </div>

              {loading && <RecommendationsSkeleton />}

              {!loading && hasWellnessGoals && (
                <Suspense fallback={<RecommendationsSkeleton />}>
                  <RecommendationsPanel
                    userId={resolvedUserId}
                    wellnessGoals={safeDashboardStats.wellnessGoals}
                    compact={true}
                  />
                </Suspense>
              )}

              {!loading && !hasWellnessGoals && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('worldDashboard.addGoalsForRecs')}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Statistics Grid */}
        <DashboardStats stats={stats} isLoading={loading} />

        {/* Quick Actions */}
        <DashboardQuickActions
          onActionClick={handleQuickAction}
          isLoading={loading}
        />

        {/* Weekly Progress Card */}
        <Card className="world-class-dashboard-card world-class-dashboard-card-premium mb-8 sm:mb-12">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl sm:text-3xl" aria-hidden="true">🎯</span>
              <div>
                <h5 className="text-lg sm:text-xl font-bold text-white">
                  {t('worldDashboard.weeklyProgress')}
                </h5>
                <p className="text-sm text-white/70">
                  {t('worldDashboard.weeklyProgressText', { current: formattedWeeklyProgress, goal: formattedWeeklyGoal })}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((safeDashboardStats.weeklyProgress / safeDashboardStats.weeklyGoal) * 100, 100)}%` }}
                  role="progressbar"
                  aria-valuenow={safeDashboardStats.weeklyProgress}
                  aria-valuemin={0}
                  aria-valuemax={safeDashboardStats.weeklyGoal}
                  aria-label={t('worldDashboard.weeklyProgressLabel', { current: safeDashboardStats.weeklyProgress, goal: safeDashboardStats.weeklyGoal })}
                />
              </div>
            </div>

            {safeDashboardStats.weeklyProgress >= safeDashboardStats.weeklyGoal ? (
              <Alert variant="success" className="bg-white/10 border-white/20 text-white">
                <span className="mr-2" aria-hidden="true">🎉</span>
                <strong>{t('worldDashboard.weeklyGoalReached')}</strong>
              </Alert>
            ) : (
              <p className="text-sm text-white/70">
                {t('worldDashboard.entriesLeft', { count: formattedRemainingEntries })}
              </p>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <DashboardActivity
          activities={activities}
          isLoading={loading}
          emptyStateMessage={t('worldDashboard.noActivityYet')}
        />
      </div>

      <Snackbar
        open={snackbar.open}
        onClose={handleCloseSnackbar}
        message={snackbar.message}
        variant={snackbar.variant}
      />
    </div>
  );
};

export default WorldClassDashboard;
