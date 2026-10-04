import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ErrorBoundary from './ErrorBoundary';

// Tailwind Components
import { Button } from './ui/tailwind/Button';
import { Card } from './ui/tailwind/Card';
import { Alert } from './ui/tailwind/Feedback';
import { Snackbar } from './ui/tailwind';

// Dashboard Components (Extracted for maintainability)
import { DashboardHeader, BreathingFocusCard } from './Dashboard/DashboardHeader';
import { DashboardStats } from './Dashboard/DashboardStats';
import { DashboardQuickActions } from './Dashboard/DashboardQuickActions';

// Feature Components - Direct imports to prevent code splitting
import { SuperMoodLogger } from './SuperMoodLogger';
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
import { completeGoalStep } from '../api/users';
import { analytics } from '../services/analytics';
import { logger } from '../utils/logger';
import useAuth from '../hooks/useAuth';
import { extractDisplayName } from '../utils/nameUtils';

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
    <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse"></div>
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
// Helper function för implementation intentions (nästa steg per mål)
const getNextStepForGoal = (goal: string, t: (key: string) => unknown): string => {
  const steps = t('dashboard.goalSteps') as Record<string, string[]> | undefined;
  const goalSteps: string[] = (steps && steps[goal]) || (steps?.['default'] as string[]) || [t('dashboard.defaultGoalStep') as string];
  // Deterministic selection: hash goal name + current day to avoid flicker on re-render
  // while still rotating the suggestion daily
  const dayOfYear = Math.floor(Date.now() / 86400000);
  let hash = 0;
  for (let i = 0; i < goal.length; i++) hash = (hash * 31 + goal.charCodeAt(i)) | 0;
  const index = Math.abs(hash + dayOfYear) % goalSteps.length;
  return goalSteps[index] || ((steps?.['fallback'] as string[])?.[0] || (t('dashboard.continueGoal') as string));
};

import { getFeatureLinkForStep } from '../utils/goalStepLinks';

const DASHBOARD_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const WorldClassDashboard: React.FC<WorldClassDashboardProps> = ({ userId }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasFeature, plan, isPremium, refreshSubscription } = useSubscription();
  const moodLogLimit = plan?.limits?.moodLogsPerDay ?? 5;
  const chatMessageLimit = plan?.limits?.chatMessagesPerDay ?? 10;
  const hasUnlimitedUsage = moodLogLimit === -1 && chatMessageLimit === -1;
  const isPremiumUser = isPremium || hasUnlimitedUsage || hasFeature('premium') || hasFeature('unlimited_usage');

  const resolvedUserId = user?.user_id || userId;

  // Centralized data hook with caching
  const { stats: dashboardStats, loading, error, refresh } = useDashboardData(resolvedUserId);

  // Debug flag to surface internal dashboard state in the UI (dev only)
  const isDashboardDebug = import.meta.env.DEV && import.meta.env.VITE_DEBUG_DASHBOARD === 'true';

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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | undefined>(undefined);

  const scrollToMoodCheckIn = useCallback(() => {
    const moodSection = document.getElementById('mood-check-in-section');
    if (!moodSection) {
      return;
    }

    moodSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleGoalStepToggle = async (goalId: string, stepText: string, isCompleted: boolean) => {
    try {
      await completeGoalStep(goalId, stepText, !isCompleted);
      // Refresh dashboard data to show updated completions
      refresh();
      analytics.track('goal_step_toggled', { goalId, stepText, completed: !isCompleted });
    } catch (error) {
      logger.error('Failed to toggle goal step:', error);
      setSnackbar({
        open: true,
        message: t('dashboard.goalStepUpdateError'),
        variant: 'error',
      });
    }
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

  // Memoize wellnessGoals to prevent new array reference on every render
  const wellnessGoals = useMemo(() => dashboardStats.wellnessGoals || [], [dashboardStats.wellnessGoals]);
  
  const safeDashboardStats = useMemo(() => ({
    totalMoods: dashboardStats.totalMoods || 0,
    totalChats: dashboardStats.totalChats || 0,
    averageMood: dashboardStats.averageMood || 0,
    streakDays: dashboardStats.streakDays || 0,
    weeklyGoal: Math.max(dashboardStats.weeklyGoal || 1, 1),
    weeklyProgress: Math.max(dashboardStats.weeklyProgress || 0, 0),
    wellnessGoals,
    goalStepCompletions: dashboardStats.goalStepCompletions || {},
    recentActivity: dashboardStats.recentActivity || [],
    moodTrendSamples: dashboardStats.moodTrendSamples || [],
    longestStreak: dashboardStats.longestStreak || 0,
    weeklyChats: dashboardStats.weeklyChats || 0,
    achievementsCount: dashboardStats.achievementsCount || 0,
    totalMeditations: dashboardStats.totalMeditations || 0,
  }), [dashboardStats.totalMoods, dashboardStats.totalChats, dashboardStats.averageMood, dashboardStats.streakDays, dashboardStats.weeklyGoal, dashboardStats.weeklyProgress, wellnessGoals, dashboardStats.goalStepCompletions, dashboardStats.recentActivity, dashboardStats.moodTrendSamples, dashboardStats.longestStreak, dashboardStats.weeklyChats, dashboardStats.achievementsCount, dashboardStats.totalMeditations]);

  const hasWellnessGoals = Array.isArray(safeDashboardStats.wellnessGoals) && safeDashboardStats.wellnessGoals.length > 0;
  const shouldRenderWellnessSkeleton = loading && !hasWellnessGoals;

  // Memoize goal steps to prevent re-render changes
  const goalStepsMap = useMemo(() => {
    const map: Record<string, string> = {};
    safeDashboardStats.wellnessGoals.forEach((goal) => {
      map[goal] = getNextStepForGoal(goal, t);
    });
    return map;
  }, [safeDashboardStats.wellnessGoals, t]);

  // Latest mood description for personalized greeting (not the numeric average)
  const latestMoodInfo = useMemo(() => {
    const moodActivities = safeDashboardStats.recentActivity.filter((a) => a.type === 'mood');
    if (!moodActivities.length) return undefined;
    const latest = moodActivities.reduce((latest, current) => {
      const latestTime = latest.timestamp instanceof Date ? latest.timestamp.getTime() : new Date(latest.timestamp).getTime();
      const currentTime = current.timestamp instanceof Date ? current.timestamp.getTime() : new Date(current.timestamp).getTime();
      return currentTime > latestTime ? current : latest;
    });
    return {
      description: latest.description,
      timestamp: latest.timestamp instanceof Date ? latest.timestamp : new Date(latest.timestamp),
    };
  }, [safeDashboardStats.recentActivity]);

  // Check if user has logged a mood today (for header contextual prompt)
  const hasLoggedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return safeDashboardStats.recentActivity.some(
      (a) => a.type === 'mood' && a.timestamp instanceof Date && a.timestamp >= today
    );
  }, [safeDashboardStats.recentActivity]);

  // Memoize stats object to prevent DashboardStats re-renders
  const stats = useMemo(() => ({
    streakDays: safeDashboardStats.streakDays,
    achievementsCount: safeDashboardStats.achievementsCount,
    longestStreak: safeDashboardStats.longestStreak,
  }), [safeDashboardStats.streakDays, safeDashboardStats.achievementsCount, safeDashboardStats.longestStreak]);

  // Track page view once on mount (not on every loading state change)
  useEffect(() => {
    analytics.page('World Class Dashboard', {
      component: 'WorldClassDashboard',
      userId: user?.user_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Announce to screen reader when data finishes loading
  useEffect(() => {
    if (!loading) {
      announceToScreenReader(t('worldDashboard.dashboardLoaded'), 'polite');
    }
  }, [loading, announceToScreenReader, t]);

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
        message: t('dashboard.purchaseCancelled'),
        variant: 'info',
      });
      clearCheckoutParams();
      return;
    }

    if (!resolvedUserId) {
      setSnackbar({
        open: true,
        message: t('dashboard.verifyFailed'),
        variant: 'warning',
      });
      clearCheckoutParams();
      return;
    }

    let cancelled = false;

    const syncSubscriptionFromStripe = async () => {
      setSnackbar({
        open: true,
        message: t('dashboard.verifying'),
        variant: 'info',
      });

      const maxAttempts = 5;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) {
          return;
        }

        try {
          const status = await getSubscriptionStatus(resolvedUserId);
          if (cancelled) {
            return;
          }
          if (status.isPremium || status.isTrial || status.plan === 'enterprise') {
            await refreshSubscription();

            if (!cancelled) {
              setSnackbar({
                open: true,
                message: t('dashboard.premiumActive'),
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

      if (cancelled) {
        return;
      }

      await refreshSubscription();

      if (!cancelled) {
        setSnackbar({
          open: true,
          message: t('dashboard.paymentRegistered'),
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
          message: t('dashboard.updateFailed'),
          variant: 'error',
        });
        clearCheckoutParams();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, refreshSubscription, resolvedUserId, t]);

  const handleRefresh = useCallback((reason: 'manual' | 'auto' | 'interval' | 'visibility' | 'online' = 'manual') => {
    logger.debug('Dashboard refresh triggered', { reason });
    analytics.track('World Class Dashboard Refreshed', {
      component: 'WorldClassDashboard',
      userId: user?.user_id,
      reason,
    });
    refresh();
    setLastUpdatedAt(new Date());
  }, [refresh, user?.user_id]);

  useEffect(() => {
    if (!loading && !lastUpdatedAt) {
      setLastUpdatedAt(new Date());
    }
  }, [loading, lastUpdatedAt]);

  useEffect(() => {
    if (activeView !== 'overview') {
      return;
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh('visibility');
      }
    };

    const handleOnline = () => {
      handleRefresh('online');
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        handleRefresh('interval');
      }
    }, DASHBOARD_REFRESH_INTERVAL);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [activeView, handleRefresh]);

  const handleQuickAction = (actionId: string) => {
    analytics.track('Quick Action Taken', {
      action: actionId,
      component: 'WorldClassDashboard',
    });

    // Premium features require subscription check
    if (actionId === 'journal' && !hasFeature('journal')) {
      navigate('/upgrade');
      return;
    }

    if (actionId === 'sounds' && !hasFeature('sounds')) {
      navigate('/upgrade');
      return;
    }

    if (actionId === 'social' && !hasFeature('social')) {
      navigate('/upgrade');
      return;
    }

    if (actionId === 'recommendations' && !hasFeature('recommendations')) {
      navigate('/upgrade');
      return;
    }

    switch (actionId) {
      case 'chat':
        setActiveView('chat');
        break;
      case 'journal':
        navigate('/journal');
        break;
      case 'sounds':
        navigate('/sounds');
        break;
      case 'social':
        navigate('/social');
        break;
      case 'recommendations':
        navigate('/recommendations');
        break;
      default:
        break;
    }
  };

  if (error) {
    return (
      <div className="world-class-dashboard p-4 sm:p-6 lg:p-8">
        <Alert variant="error" className="mb-4">
          <strong>{t('worldDashboard.loadError')}:</strong> {error.message}
        </Alert>
        <Button onClick={() => handleRefresh('manual')} variant="primary">
          {t('worldDashboard.tryAgain')}
        </Button>
        {resolvedUserId && (
          <div className="mt-6">
            <SuperMoodLogger onMoodLogged={() => handleRefresh('auto')} />
          </div>
        )}
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
        handleRefresh('manual');
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

        {activeView === 'mood-basic' && <SuperMoodLogger showRecentMoods={true} />}
        {activeView === 'mood-list' && <MoodList onClose={handleCloseFeature} />}
        {activeView === 'chat' && <WorldClassAIChat onClose={handleCloseFeature} />}
        {activeView === 'analytics' && (
          <Suspense fallback={<FeatureViewFallback label={t('worldDashboard.loadingAnalysis')} />}>
            <WorldClassAnalyticsView onClose={handleCloseFeature} />
          </Suspense>
        )}
        {activeView === 'gamification' && (
          hasFeature('gamification') ? (
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
        <div className="fixed inset-0 z-1055 flex items-center justify-center px-4">
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
      {!isPremiumUser && (
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <UsageLimitBanner variant="compact" />
        </div>
      )}

      {/* Hero Header */}
      <DashboardHeader
        userName={extractDisplayName(user?.email || '') || t('dashboard.friend')}
        isLoading={loading}
        lastUpdatedAt={lastUpdatedAt || undefined}
        onFocusAction={scrollToMoodCheckIn}
        averageMood={safeDashboardStats.averageMood}
        lastMood={latestMoodInfo?.description}
        lastMoodTimestamp={latestMoodInfo?.timestamp}
        hasLoggedToday={hasLoggedToday}
      />

      <div className="world-class-dashboard-content px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Prominent Mood Check Section */}
        <Card id="mood-check-in-section" className="mb-6 border-l-4 border-l-secondary-500">
          <div className="p-4 sm:p-6">
            <div className="text-center mb-4">
              <span className="text-4xl mb-2 block">🧘‍♀️</span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('worldDashboard.howAreYou')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {t('worldDashboard.takeAMoment')}
              </p>
            </div>
            <SuperMoodLogger onMoodLogged={() => handleRefresh('auto')} showRecentMoods={true} hideHeader={true} maxRecentMoods={3} />
          </div>
        </Card>

        {/* Breathing Focus Card — moved from header to after mood check-in */}
        <BreathingFocusCard onFocusAction={scrollToMoodCheckIn} />

        {shouldRenderWellnessSkeleton && (
          <Card className="mb-6 animate-pulse" aria-hidden="true">
            <div className="p-6 sm:p-8 space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-sm w-1/3"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300/60 dark:border-gray-700"
                  ></div>
                ))}
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-sm w-1/2"></div>
            </div>
          </Card>
        )}

        {/* Wellness Goals Card (Personalized based on onboarding) */}
        {hasWellnessGoals && (
          <Card className="mb-6 border-l-4 border-l-primary-500">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl" aria-hidden="true">🎯</span>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    {t('worldDashboard.wellnessGoals')}
                  </h2>
                </div>
                {/* Edit goals button */}
                <button
                  onClick={() => setShowWellnessOnboarding(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline transition-colors"
                  aria-label={t('dashboard.updateGoalsAria')}
                >
                  {t('dashboard.changeGoals', 'Ändra mål')}
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {safeDashboardStats.wellnessGoals.map((goal) => {
                  const nextStep = goalStepsMap[goal] || (t('dashboard.defaultGoalStep') as string);
                  const goalCompletions = safeDashboardStats.goalStepCompletions[goal] || {};
                  const isStepCompleted = goalCompletions[nextStep] !== undefined;
                  const featureLink = getFeatureLinkForStep(nextStep, t);

                  return (
                    <div
                      key={goal}
                      className="flex items-center gap-2 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 hover:shadow-md transition-shadow flex-nowrap"
                    >
                      <span className="text-xs shrink-0">
                        {getWellnessGoalIcon(goal)}
                      </span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white shrink-0 leading-tight whitespace-nowrap">
                        {goal}
                      </span>

                      {/* Step completion indicator (per-goal) */}
                      <div className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                        {isStepCompleted ? '✓' : '○'}
                      </div>

                      {/* Combined row: checkbox + CTA */}
                      <input
                        type="checkbox"
                        id={`step-${goal}`}
                        checked={isStepCompleted}
                        onChange={() => handleGoalStepToggle(goal, nextStep, isStepCompleted)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded-sm focus:ring-primary-500 cursor-pointer shrink-0"
                        aria-label={t('dashboard.markStepComplete', { step: nextStep })}
                      />
                      <label
                        htmlFor={`step-${goal}`}
                        className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer flex-1 leading-tight truncate whitespace-nowrap"
                        title={nextStep}
                      >
                        {nextStep.length > 20 ? nextStep.substring(0, 20) + '...' : nextStep}
                      </label>
                      <button
                        onClick={() => {
                          if (featureLink) {
                            navigate(featureLink.route, { state: { goalFilter: goal } });
                          } else {
                            navigate('/recommendations', { state: { goalFilter: goal } });
                          }
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 shrink-0 leading-tight"
                        title={featureLink ? featureLink.label : t('worldDashboard.seeRecommendations')}
                        aria-label={featureLink ? featureLink.label : t('worldDashboard.seeRecommendations')}
                      >
                        →
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                {t('worldDashboard.goalRecommendations')}
              </p>
            </div>
          </Card>
        )}

        {/* Personalized Recommendations */}
        <Card className="mb-6" aria-busy={loading} aria-live="polite">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl sm:text-3xl" aria-hidden="true">💡</span>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {t('worldDashboard.personalRecommendations')}
              </h2>
              {/* Subtle refresh indicator */}
              {loading && (
                <span className="ml-auto text-xs text-gray-400 animate-pulse">
                  {t('common.updating')}
                </span>
              )}
            </div>

            {hasWellnessGoals && resolvedUserId && (
              <ErrorBoundary>
                <Suspense fallback={<RecommendationsSkeleton />}>
                  <RecommendationsPanel
                    userId={resolvedUserId}
                    wellnessGoals={safeDashboardStats.wellnessGoals}
                    compact={true}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {!loading && !hasWellnessGoals && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('worldDashboard.addGoalsForRecs')}
              </p>
            )}
          </div>
        </Card>

        {/* Statistics Grid */}
        <DashboardStats stats={stats} isLoading={loading} />

        {/* Visual separator between stats and quick actions */}
        <div className="mt-8 mb-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Quick Actions */}
        <DashboardQuickActions
          onActionClick={handleQuickAction}
          isLoading={loading}
        />
      </div>

      <Snackbar
        open={snackbar.open}
        onClose={handleCloseSnackbar}
        message={snackbar.message}
        variant={snackbar.variant}
      />
      {isDashboardDebug && (
        <div style={{ padding: '8px', fontFamily: 'monospace' }} aria-label="dashboard-debug">
          <strong>Dashboard debug:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
{JSON.stringify({ stats, dashboardStats, safeDashboardStats }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default WorldClassDashboard;
