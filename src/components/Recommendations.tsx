import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import useAuth from '../hooks/useAuth';
import { getWellnessGoals } from '../api/dashboard';
import { saveMeditationSession, getMeditationSessions } from '../api/meditation';
import { getMoods } from '../api/mood';
import { logger } from '../utils/logger';
import { personalizeRecommendations, analyzeMoodTrend, type PersonalizationContext, type MoodTrendData } from '../utils/recommendationPersonalization';
import {
  LightBulbIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { Recommendation, RecommendationsProps } from '../types/recommendation';
import { getRecommendationsPool } from '../constants/recommendations';
import { getWellnessGoalIcon } from '../constants/wellnessGoals';
import { BreathingExercise } from './recommendations/BreathingExercise';
import { KBTExercise } from './recommendations/KBTExercise';
import { PMRExercise } from './recommendations/PMRExercise';
import { MeditationSession } from './recommendations/MeditationSession';
import { JournalingPrompt } from './recommendations/JournalingPrompt';
import { usePomodoro } from '../hooks/usePomodoro';
import { useGratitude } from '../hooks/useGratitude';
import { useUserProgress } from '../hooks/useUserProgress';
import { useArticleReading } from '../hooks/useArticleReading';
import { useCBTExercises } from '../hooks/useCBTExercises';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { useRecommendationFilters } from '../hooks/useRecommendationFilters';
import { useRecommendations } from '../hooks/useRecommendations';
import { CrisisAlertModal } from './recommendations/CrisisAlertModal';
import { NotificationSettingsModal } from './recommendations/NotificationSettingsModal';
import { CompactRecommendations } from './recommendations/CompactRecommendations';
import { CBTSection } from './recommendations/CBTSection';
import { DebugPanel } from './recommendations/DebugPanel';
import { RecommendationCard } from './recommendations/RecommendationCard';
import { ArticleReader } from './recommendations/ArticleReader';
import {
  EMPTY_WELLNESS_GOALS,
  type RecommendationFeedback,
  formatPomodoroTime,
} from '../constants/recommendationsConstants';

// interfaces are now imported from ../types/recommendation

const Recommendations: React.FC<RecommendationsProps> = React.memo(({ userId, wellnessGoals = EMPTY_WELLNESS_GOALS, compact = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const lastRecommendationsSignatureRef = useRef<string>('');

  // useRecommendations hook — manages recommendations, loading, error, feedback, and selected state
  const {
    recommendations,
    setRecommendations,
    loading,
    setLoading,
    error,
    setError,
    selectedRecommendation,
    setSelectedRecommendation,
    feedback: feedbackByRecommendation,
    setFeedback: setFeedbackByRecommendation,
  } = useRecommendations({ userId, wellnessGoals, compact });

  const [userPreferences] = useState<string[]>(['mindfulness', 'stress', 'anxiety']);
  const [fetchedWellnessGoals, setFetchedWellnessGoals] = useState<string[]>([]);
  const [goalsUnavailable, setGoalsUnavailable] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [completedRecommendationIds, setCompletedRecommendationIds] = useState<Record<string, boolean>>({});
  const [moodTrendData, setMoodTrendData] = useState<MoodTrendData | null>(null);
  const resolvedWellnessGoals = Array.isArray(wellnessGoals) ? wellnessGoals : EMPTY_WELLNESS_GOALS;
  const wellnessGoalsSignature = resolvedWellnessGoals.join('|');
  
  // User progress hook
  const { userProgress, updateProgress } = useUserProgress({ userId: user?.user_id });

  const [selectedBreathingCycles, _setSelectedBreathingCycles] = useState<4 | 8 | 12>(4);
  const [breathingStressBefore, setBreathingStressBefore] = useState<number | null>(null);
  const [breathingStressAfter, setBreathingStressAfter] = useState<number | null>(null);
  const breathingOutcomeSyncedRef = useRef(false);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Meditation loading/session state (must be before hooks that reference handleSaveMeditationSession)
  const [, setIsLoadingMeditation] = useState(false);
  const [, setMeditationSessions] = useState<Record<string, unknown>[]>([]);

  // Meditation Functions (must be declared before useBreathingExercise/usePMR/useEffect that reference them)
  const handleLoadMeditationHistory = useCallback(async () => {
    if (!user?.user_id) return;

    setIsLoadingMeditation(true);
    try {
      const data = await getMeditationSessions(20);
      setMeditationSessions(data.sessions || []);
    } catch (error) {
      logger.error('Failed to load meditation sessions:', error);
    } finally {
      setIsLoadingMeditation(false);
    }
  }, [user?.user_id]);

  const handleSaveMeditationSession = useCallback(async (sessionData: Parameters<typeof saveMeditationSession>[0]) => {
    if (!user?.user_id) return;

    try {
      await saveMeditationSession(sessionData);
      logger.debug('✅ Meditation session saved to backend');

      // Refresh meditation history
      await handleLoadMeditationHistory();
    } catch (error) {
      logger.error('Failed to save meditation session:', error);
    }
  }, [handleLoadMeditationHistory, user?.user_id]);


  // CBT Exercises hook
  const {
    cbtModules, cbtSession, cbtInsights, cbtExercises,
    cbtLoading, cbtError, cbtCurrentMood, setCbtCurrentMood,
    activeCbtExerciseId, setActiveCbtExerciseId,
    startCbtExercise, completeCbtExercise,
    baStep, setBaStep, baActivities, setBaActivities,
    baSelectedActivity, setBaSelectedActivity,
    baBarriers, setBaBarriers, baPlan, setBaPlan,
    baPleasureRating, setBaPleasureRating, baReflection, setBaReflection,
    wtStep, setWtStep, wtWorries, setWtWorries,
    wtScheduledTime, setWtScheduledTime,
    wtPostponeCommitted, setWtPostponeCommitted,
    wtReflection, setWtReflection,
  } = useCBTExercises({ userId: user?.user_id, announce: announceToScreenReader, enabled: !compact });

  const [debugMode, setDebugMode] = useState(false);
  const showDebugTools = import.meta.env.DEV;

  // Pomodoro extra state
  interface PomodoroSession {
    date: string;
    sessionNumber: number;
    type: 'work' | 'break';
    workDuration?: number;
    breakDuration?: number;
  }
  const [pomodoroHistory, setPomodoroHistory] = useState<PomodoroSession[]>([]);
  const [pomodoroSettingsOpen, setPomodoroSettingsOpen] = useState(false);

  // Notification Settings hook
  const {
    showNotificationSettings, setShowNotificationSettings,
    notificationSettings,
    isEnablingNotifications,
    enableDailyReminders, disableDailyReminders, updateReminderTime,
  } = useNotificationSettings({ userId: user?.user_id, announce: announceToScreenReader });

  // Gratitude Hook
  const {
    isActive: isGratitudeChallengeActive,
    day: gratitudeDay,
    entries: gratitudeEntries,
    startDate: _gratitudeChallengeStartDate,
    isSaving: isSavingGratitude,
    start: startGratitudeLogic,
    saveEntry: saveGratitudeEntry,
    complete: _completeGratitudeLogic,
    cancel: cancelGratitudeLogic,
    updateEntries: setGratitudeEntries,
    nextDay: nextGratitudeDay,
    getPrompts: getGratitudePrompts
  } = useGratitude({
    user,
    onProgress: updateProgress,
    announce: announceToScreenReader
  });

  // Pomodoro Timer State (Refactored to use usePomodoro)
  const [totalPomodoroSessions, setTotalPomodoroSessions] = useState(4);
  const [pomodoroWorkTime, setPomodoroWorkTime] = useState(25); // minutes
  const [pomodoroBreakTime, setPomodoroBreakTime] = useState(5); // minutes

  // Pomodoro Hook
  const {
    isActive: isPomodoroActive,
    phase: pomodoroPhase,
    timeLeft: pomodoroTimeLeft,
    session: pomodoroSession,
    start: startPomodoroTimer,
    stop: stopPomodoroTimer
  } = usePomodoro({
    workTime: pomodoroWorkTime,
    breakTime: pomodoroBreakTime,
    totalSessions: totalPomodoroSessions,
    onSessionComplete: (session, type, duration) => {
      if (type === 'work') {
        const completedSession = {
          date: new Date().toISOString(),
          sessionNumber: session,
          workDuration: duration,
          type: 'work' as const
        };
        setPomodoroHistory(prev => [completedSession, ...prev.slice(0, 9)]);
        updateProgress('exercise', duration);
      } else {
        const breakSession = {
          date: new Date().toISOString(),
          sessionNumber: session,
          breakDuration: duration,
          type: 'break' as const
        };
        setPomodoroHistory(prev => [breakSession, ...prev.slice(0, 9)]);
      }
    },
    onPhaseChange: (phase, session) => {
      if (phase === 'completed') {
        announceToScreenReader(t('recommendations.announce.pomodoroAllComplete', 'Alla {{count}} Pomodoro-sessioner slutförda!', { count: totalPomodoroSessions }), 'polite');
      } else if (phase === 'break') {
        announceToScreenReader(t('recommendations.announce.pomodoroBreak', '{{minutes}} minuters paus börjar', { minutes: pomodoroBreakTime }), 'polite');
      } else if (phase === 'work' && session > 1) {
        announceToScreenReader(t('recommendations.announce.pomodoroWorkResume', 'Paus slut. Session {{session}} börjar', { session }), 'polite');
      }
    }
  });

  // Article Reading hook
  const {
    articleProgress, currentSection, readingTime, articleCompleted,
    quizAnswers, showQuiz, quizScore,
    setQuizAnswers, setShowQuiz, setCurrentSection,
    startArticleReading, updateArticleProgress, completeArticle, submitQuiz,
    resetArticleState,
  } = useArticleReading({ userId: user?.user_id, announce: announceToScreenReader, updateProgress });

  // Crisis Alert State
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  // KBT Exercise State
  const [kbtBeliefBefore, _setKbtBeliefBefore] = useState<number | null>(null);
  const [kbtStressBefore, _setKbtStressBefore] = useState<number | null>(null);

  // Journal History Handler
  const handleLoadJournalHistory = useCallback(async () => {
    if (!user?.user_id) return;
    // Journal history loading is handled by useJournaling hook
    logger.debug('Journal history load requested');
  }, [user?.user_id]);

  // Category color helper function — uses categoryKey (original Swedish) which is stable across translations
  const getCategoryColor = useCallback((categoryKey: string | undefined) => {
    const colors: Record<string, string> = {
      'Stresshantering': 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
      'Avslappning': 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800',
      'Sömn': 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800',
      'KBT': 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
      'Fokus': 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800',
      'Mental klarhet': 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800',
      'Produktivitet': 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
      'Relationer': 'bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800',
      'Utbildning': 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800',
      'Meditation': 'bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800',
      'Journaling': 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
      'Utmaningar': 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800',
      'Ångesthantering': 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
      'Arbetsliv': 'bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800',
      'Avancerad KBT': 'bg-fuchsia-50 dark:bg-fuchsia-900/10 border-fuchsia-200 dark:border-fuchsia-800',
      'Avancerad Meditation': 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800',
      'Allmänt': 'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800',
    };
    return colors[categoryKey || ''] || 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  }, []);

  // CBT data loading is now handled by useCBTExercises hook


  const loadRecommendations = useCallback((goals: string[], screenReader: typeof announceToScreenReader) => {
    const allRecommendations = getRecommendationsPool(t);
    let filteredRecommendations: Recommendation[] = [];

    if (goals && goals.length > 0) {
      const normalizedGoals = goals.map(g => g.toLowerCase().trim());
      const goalMatched = allRecommendations.filter(rec =>
        rec.tags.some((tag) => {
          const normalizedTag = tag.toLowerCase().trim();
          return (
            normalizedGoals.includes(normalizedTag) ||
            normalizedGoals.some((goal) => goal.includes(normalizedTag) || normalizedTag.includes(goal))
          );
        })
      );

      const rankedFallback = [...allRecommendations].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      const unique = new Map<string, Recommendation>();

      [...goalMatched, ...rankedFallback].forEach((recommendation) => {
        if (!unique.has(recommendation.id)) {
          unique.set(recommendation.id, recommendation);
        }
      });

      filteredRecommendations = Array.from(unique.values()).slice(0, Math.max(goals.length * 3, 6));
    } else {
      filteredRecommendations = [...allRecommendations]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 6);
    }

    // Apply rule-based personalization scoring
    const personalizationCtx: PersonalizationContext = {
      moodTrend: moodTrendData,
      completedRecIds: Object.keys(completedRecommendationIds),
      exercisesCompleted: userProgress.exercisesCompleted,
      dayStreak: cbtInsights?.streak?.current ?? 0,
      hour: new Date().getHours(),
    };

    const personalized = personalizeRecommendations(filteredRecommendations, personalizationCtx);
    const finalRecommendations = personalized.map(r => {
      const { personalizationScore: _score, personalizationReasons: _reasons, ...rec } = r;
      return rec as Recommendation;
    });

    const recommendationSignature = finalRecommendations
      .map((recommendation) => recommendation.id)
      .join('|');

    if (recommendationSignature === lastRecommendationsSignatureRef.current) {
      return;
    }

    lastRecommendationsSignatureRef.current = recommendationSignature;
    setRecommendations(finalRecommendations);
    if (!compact) {
      screenReader(t('recommendations.announce.loadedCount', '{{count}} personaliserade rekommendationer laddade', { count: finalRecommendations.length }), 'polite');
    }
  }, [compact, t, moodTrendData, completedRecommendationIds, userProgress.exercisesCompleted, cbtInsights?.streak, setRecommendations]);

  // Fetch wellness goals on mount
  useEffect(() => {
    logger.debug('🔍 RECOMMENDATIONS COMPONENT - useEffect triggered', {
      user: user?.user_id ? 'exists' : 'null',
      userId: user?.user_id,
      isAuthenticated: !!user?.user_id
    });

    // In compact dashboard mode, rely on provided props to avoid unnecessary refresh/flicker.
    if (compact) {
      if (resolvedWellnessGoals.length > 0) {
        setFetchedWellnessGoals(resolvedWellnessGoals);
      }
      setLoading(false);
      return;
    }

    if (resolvedWellnessGoals.length > 0) {
      setFetchedWellnessGoals(resolvedWellnessGoals);
      setLoading(false);
      return;
    }

    const fetchWellnessGoalsData = async () => {
      logger.debug('🔄 Starting wellness goals fetch...');
      setLoading(true);
      setError(null);
      setGoalsUnavailable(false);

      try {
        if (user?.user_id) {
          logger.debug('🎯 Fetching wellness goals for user:', user.user_id);
          const goals = await getWellnessGoals();
          logger.debug('✅ Wellness goals response:', goals);

          // Ensure goals is an array
          const goalsArray = Array.isArray(goals) ? goals : [];
          setFetchedWellnessGoals(goalsArray);
          logger.debug('🎯 Set wellness goals:', goalsArray);
        } else {
          logger.debug('⚠️ No user ID available for wellness goals - showing generic recommendations');
          setFetchedWellnessGoals([]); // Empty array will trigger generic recommendations
        }
      } catch (error) {
        logger.error('❌ Failed to fetch wellness goals:', error);
        logger.debug('⚠️ Showing generic recommendations due to error');
        setFetchedWellnessGoals([]); // Show generic recommendations on error
        // Falling back to generic recommendations is right — they are still
        // useful. Doing it silently is not: the page tells the user we adapt
        // to their wellness goals, and with this fetch failed that sentence is
        // untrue and they have no way to tell.
        setGoalsUnavailable(true);
      } finally {
        setLoading(false);
        logger.debug('🏁 Wellness goals fetch completed');
      }
    };

    fetchWellnessGoalsData();
  }, [compact, resolvedWellnessGoals, user?.user_id, wellnessGoalsSignature, setError, setLoading]);

  // Fetch mood data for personalization trend analysis
  useEffect(() => {
    if (!user?.user_id) return;

    let cancelled = false;

    const fetchMoodTrend = async () => {
      try {
        const moods = await getMoods(user!.user_id!);
        if (cancelled || !Array.isArray(moods)) return;

        const scores = moods
          .map((m: Record<string, unknown>) => (m.score || m.sentiment_score) as number | undefined)
          .filter((s): s is number => typeof s === 'number' && s > 0)
          .slice(-10); // Last 10 mood entries

        if (scores.length >= 3) {
          const trend = analyzeMoodTrend(scores);
          if (!cancelled && trend) {
            setMoodTrendData(trend);
            logger.debug('Mood trend for personalization:', trend);
          }
        }
      } catch (err) {
        if (!cancelled) {
          logger.debug('Could not fetch mood trend for personalization:', err);
        }
      }
    };

    void fetchMoodTrend();

    return () => { cancelled = true; };
  }, [user?.user_id, user]);

  const hasTrackedPageViewRef = useRef(false);

  // Track page view only once on mount
  useEffect(() => {
    if (hasTrackedPageViewRef.current) {
      return;
    }

    hasTrackedPageViewRef.current = true;
    analytics.page('Recommendations', {
      component: 'Recommendations',
      userId: userId || user?.user_id,
      wellnessGoals: resolvedWellnessGoals.length > 0 ? resolvedWellnessGoals : fetchedWellnessGoals,
    });
  }, [fetchedWellnessGoals, resolvedWellnessGoals, user?.user_id, userId]);

  // Load recommendations when goals change
  useEffect(() => {
    const goalsToUse = resolvedWellnessGoals.length > 0 ? resolvedWellnessGoals : fetchedWellnessGoals;
    logger.debug('📋 Loading recommendations with goals:', goalsToUse);

    loadRecommendations(goalsToUse, announceToScreenReader);
  }, [wellnessGoalsSignature, fetchedWellnessGoals, loadRecommendations, announceToScreenReader, resolvedWellnessGoals]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  // KBT exercise functions now provided by the useKBTExercise hook

  // Progressive Relaxation functions are now provided by usePMR hook

  const startGratitudeChallenge = () => {
    startGratitudeLogic();
  };

  // Pomodoro functions provided by usePomodoro hook


  const getPomodoroProgress = () => {
    const totalTime = pomodoroPhase === 'work' ? pomodoroWorkTime * 60 : pomodoroBreakTime * 60;
    if (totalTime <= 0) return 0;
    return ((totalTime - pomodoroTimeLeft) / totalTime) * 100;
  };

  // Article reading functions are now provided by useArticleReading hook

  // nextKbtPhase is now provided by useKBTExercise hook

  // Journaling Functions
  // handleSaveJournalEntry and handleLoadJournalHistory are now provided by useJournaling hook


  // Load data on mount
  useEffect(() => {
    if (user?.user_id) {
      handleLoadJournalHistory();
      handleLoadMeditationHistory();
    }
  }, [handleLoadJournalHistory, handleLoadMeditationHistory, user?.user_id]);

  // Recommendation filters hook
  const {
    searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory,
    sortBy, setSortBy,
    categories, hasActiveFilters,
    filteredRecommendations, sortLabel,
  } = useRecommendationFilters(recommendations);

  const getRecommendationMatchReason = (recommendation: Recommendation): string | null => {
    const recommendationText = `${recommendation.title} ${recommendation.description} ${recommendation.tags.join(' ')} ${recommendation.category}`.toLowerCase();

    const matchedGoal = resolvedWellnessGoals.find((goal) => {
      const normalizedGoal = goal.toLowerCase().trim();
      if (!normalizedGoal) {
        return false;
      }

      if (recommendationText.includes(normalizedGoal)) {
        return true;
      }

      const goalKeywords = normalizedGoal.split(/\s+/).filter((word) => word.length > 3);
      return goalKeywords.some((word) => recommendationText.includes(word));
    });

    if (matchedGoal) {
      return t('recommendations.matchReason.goal', 'Matchar mål: {{goal}}', { goal: matchedGoal });
    }

    const matchedPreference = userPreferences.find((pref) => recommendationText.includes(pref.toLowerCase()));
    return matchedPreference ? t('recommendations.matchReason.preference', 'Matchar intresse: {{preference}}', { preference: matchedPreference }) : null;
  };

  // User progress loading is now handled by useUserProgress hook

  // Prevent background scroll when content modal is open.
  useEffect(() => {
    if (!showContentModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showContentModal]);

  // Debug: Check localStorage on mount (dev only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    logger.debug('🔍 DEBUG: Checking all localStorage keys containing "progress"');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('progress')) {
        logger.debug('🔍 Found progress key', {
          key,
          value: localStorage.getItem(key),
        });
      }
    }
  }, []);

  // Auto-open recommendation when navigated from dashboard with autoOpenRecId
  useEffect(() => {
    const state = location.state as { autoOpenRecId?: string } | null;
    if (state?.autoOpenRecId && recommendations.length > 0 && !selectedRecommendation) {
      const rec = recommendations.find(r => r.id === state.autoOpenRecId);
      if (rec) {
        setSelectedRecommendation(rec);
        setShowContentModal(true);
        // Clear state so it doesn't re-open on refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, recommendations, selectedRecommendation, setSelectedRecommendation]);

  // Notification settings functions are now provided by useNotificationSettings hook

  // handleThoughtChange is now defined using the hook and a wrapper for crisis detection


  const handleRecommendationAction = (recommendation: Recommendation, action: 'start' | 'save' | 'share' | 'feedback') => {
    analytics.track('Recommendation Action', {
      recommendationId: recommendation.id,
      recommendationType: recommendation.type,
      action,
      component: 'Recommendations',
    });

    switch (action) {
      case 'start':
        // Track that user started this activity
        logger.debug(`▶️ Started: ${recommendation.title} `);

        // Open content modal with the recommendation details
        setSelectedRecommendation(recommendation);
        setShowContentModal(true);

        // Start appropriate exercise
        if (recommendation.id === 'generic-1') {
          pendingTimersRef.current.push(setTimeout(() => startGratitudeChallenge(), 500));
        } else if (recommendation.id === 'focus-1') {
          pendingTimersRef.current.push(setTimeout(() => startPomodoroTimer(), 500));
        } else if (recommendation.id === 'focus-3') {
          pendingTimersRef.current.push(setTimeout(() => startArticleReading(), 500));
        }

        // Article progress is tracked in completeArticle() after the user has actually read it
        break;
      case 'save': {
        const newSavedState = !recommendation.saved;
        setRecommendations(prev =>
          prev.map(r =>
            r.id === recommendation.id ? { ...r, saved: newSavedState } : r
          )
        );

        // Track save/unsave action
        analytics.track('Recommendation Saved', {
          recommendationId: recommendation.id,
          saved: newSavedState,
          component: 'Recommendations',
        });

        logger.debug(`${newSavedState ? '💾' : '🗑️'} ${newSavedState ? 'Saved' : 'Unsaved'}: `, recommendation.title);
        announceToScreenReader(
          newSavedState
            ? t('recommendations.announce.saved', '{{title}} sparad till dina favoriter', { title: recommendation.title })
            : t('recommendations.announce.unsaved', '{{title}} borttagen från favoriter', { title: recommendation.title }),
          'polite'
        );
        break;
      }
      case 'share': {
        // Try Web Share API first, fallback to clipboard
        const shareData = {
          title: recommendation.title,
          text: `${recommendation.title} - ${recommendation.description} `,
          url: window.location.href,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          navigator.share(shareData)
            .then(() => {
              logger.debug('✅ Shared successfully:', recommendation.title);
              announceToScreenReader(t('recommendations.announce.shared', 'Rekommendation delad framgångsrikt'), 'polite');
            })
            .catch((error) => {
              logger.debug('Share cancelled or failed:', error);
            });
        } else {
          // Fallback to clipboard
          navigator.clipboard.writeText(`${shareData.title} \n${shareData.text} \n${shareData.url} `)
            .then(() => {
              logger.debug('✅ Copied to clipboard:', recommendation.title);
              announceToScreenReader(t('recommendations.announce.linkCopied', 'Länk kopierad till urklipp'), 'polite');
            })
            .catch((error) => {
              logger.error('Failed to copy to clipboard:', error);
              announceToScreenReader(t('recommendations.announce.copyFailed', 'Kunde inte kopiera länk'), 'assertive');
            });
        }
        break;
      }
      case 'feedback':
        // Simple feedback - could be expanded to a proper feedback system
        announceToScreenReader(t('recommendations.announce.thanksForFeedback', 'Tack för din feedback!'), 'polite');
        break;
    }

  };

  const handleRecommendationFeedback = (recommendation: Recommendation, feedback: RecommendationFeedback) => {
    setFeedbackByRecommendation((prev) => ({ ...prev, [recommendation.id]: feedback }));

    analytics.track('Recommendation Feedback', {
      recommendationId: recommendation.id,
      feedback,
      component: 'Recommendations',
    });

    if (feedback === 'helpful') {
      logger.debug('👍 Positive feedback for:', recommendation.title);
      announceToScreenReader(t('recommendations.announce.thanksPositive', 'Tack för din positiva feedback!'), 'polite');
      return;
    }

    logger.debug('👎 Negative feedback for:', recommendation.title);
    announceToScreenReader(t('recommendations.announce.thanksNegative', 'Tack för din feedback, vi förbättrar våra rekommendationer!'), 'polite');
  };


  const handleCloseContentModal = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    if (isPomodoroActive) {
      stopPomodoroTimer();
    }
    setBreathingStressBefore(null);
    setBreathingStressAfter(null);

    // Reset article/quiz state via hook
    resetArticleState();

    // Reset Pomodoro settings panel
    setPomodoroSettingsOpen(false);

    setShowContentModal(false);
    setSelectedRecommendation(null);
  }, [
    isPomodoroActive,
    stopPomodoroTimer,
    resetArticleState,
    setSelectedRecommendation,
  ]);

  useEffect(() => {
    if (!showContentModal && !showCrisisAlert && !showNotificationSettings) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showContentModal) handleCloseContentModal();
        else if (showCrisisAlert) setShowCrisisAlert(false);
        else if (showNotificationSettings) setShowNotificationSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showContentModal, showCrisisAlert, showNotificationSettings, handleCloseContentModal, setShowNotificationSettings]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'meditation': return '🧘';
      case 'exercise': return '💪';
      case 'article': return '📖';
      case 'challenge': return '🎯';
      case 'insight': return '💡';
      default: return '📋';
    }
  };

  const getCompactCtaLabel = (type: Recommendation['type']) => {
    switch (type) {
      case 'meditation':
        return t('recommendations.cta.meditation', 'Visa meditation');
      case 'exercise':
        return t('recommendations.cta.exercise', 'Visa övning');
      case 'article':
        return t('recommendations.cta.article', 'Visa artikel');
      case 'challenge':
        return t('recommendations.cta.challenge', 'Visa utmaning');
      case 'insight':
        return t('recommendations.cta.insight', 'Visa insikt');
      default:
        return t('recommendations.cta.default', 'Visa rekommendation');
    }
  };

  // Compact mode for dashboard - just show featured recommendations
  if (compact) {
    return (
      <CompactRecommendations
        loading={loading}
        error={error}
        recommendations={recommendations}
        moodTrendData={moodTrendData}
        getCompactCtaLabel={getCompactCtaLabel}
      />
    );
  }

  const selectedRecommendationId = selectedRecommendation?.id ?? '';
  const isStressBreathingRecommendation = selectedRecommendationId === 'stress-1';
  const isSelectedRecommendationCompleted = selectedRecommendationId
    ? !!completedRecommendationIds[selectedRecommendationId]
    : false;
  const canManuallyCompleteSelectedRecommendation = !isStressBreathingRecommendation;
  const selectedRecommendationHasNextFlow = isSelectedRecommendationCompleted && !!selectedRecommendation;
  const nextCompletedActionLabel = selectedRecommendation?.type === 'exercise'
    ? t('recommendations.content.reflectInJournal', 'Reflektera i dagboken')
    : t('recommendations.content.goToNext', 'Gå till nästa övning');
  const isPrimaryActionDisabled = !isSelectedRecommendationCompleted && !canManuallyCompleteSelectedRecommendation;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              {t('recommendations.title')}
            </h1>
            <p className="text-lg opacity-90 mb-4">
              {t('recommendations.subtitle')}
            </p>
            <p className="text-sm opacity-90 max-w-2xl">
              {t('recommendations.description')}
            </p>
            {user && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  🧘 {fetchedWellnessGoals.length} {t('recommendations.wellnessGoals')}
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  🎯 {recommendations.length} {t('recommendations.availableExercises')}
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  📚 {t('recommendations.evidenceBased')}
                </span>
                {showDebugTools && (
                  <>
                    {/* Debug toggle for development only */}
                    <button
                      onClick={() => setDebugMode((prev) => !prev)}
                      className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-xs"
                      title="Toggle debug mode"
                    >
                      🐛 {debugMode ? 'ON' : 'OFF'}
                    </button>
                    {/* Test progress button for development only */}
                    <button
                      onClick={() => {
                        updateProgress('exercise', 1);
                        updateProgress('meditation', 10);
                        updateProgress('article', 1);
                      }}
                      className="bg-green-500/20 hover:bg-green-500/30 px-3 py-1 rounded-full text-xs"
                      title="Test progress tracking"
                    >
                      ✅ Test Progress
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center md:items-end">
            <div className="text-6xl mb-2">🧠</div>
            <p className="text-sm opacity-75">{t('recommendations.evidenceBased')}</p>
          </div>
        </div>

        {/* Debug Panel */}
        <DebugPanel
          showDebugTools={showDebugTools}
          debugMode={debugMode}
          userId={user?.user_id ?? null}
          goals={fetchedWellnessGoals}
          progress={userProgress as Record<string, unknown>}
          filters={{ searchTerm, selectedCategory, sortBy }}
        />
      </div>

      {/* CBT Backend Integration Overview */}
      <CBTSection
        cbtModules={cbtModules}
        cbtExercises={cbtExercises}
        cbtInsights={cbtInsights}
        cbtSession={cbtSession}
        cbtLoading={cbtLoading}
        cbtError={cbtError}
        cbtCurrentMood={cbtCurrentMood}
        setCbtCurrentMood={setCbtCurrentMood}
        startCbtExercise={startCbtExercise}
        completeCbtExercise={completeCbtExercise}
        activeCbtExerciseId={activeCbtExerciseId}
        setActiveCbtExerciseId={setActiveCbtExerciseId}
        baStep={baStep}
        setBaStep={setBaStep}
        baActivities={baActivities}
        setBaActivities={setBaActivities}
        baSelectedActivity={baSelectedActivity}
        setBaSelectedActivity={setBaSelectedActivity}
        baBarriers={baBarriers}
        setBaBarriers={setBaBarriers}
        baPlan={baPlan}
        setBaPlan={setBaPlan}
        baPleasureRating={baPleasureRating}
        setBaPleasureRating={setBaPleasureRating}
        baReflection={baReflection}
        setBaReflection={setBaReflection}
        wtStep={wtStep}
        setWtStep={setWtStep}
        wtWorries={wtWorries}
        setWtWorries={setWtWorries}
        wtScheduledTime={wtScheduledTime}
        setWtScheduledTime={setWtScheduledTime}
        wtPostponeCommitted={wtPostponeCommitted}
        setWtPostponeCommitted={setWtPostponeCommitted}
        wtReflection={wtReflection}
        setWtReflection={setWtReflection}
        announceToScreenReader={announceToScreenReader}
      />

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder={t('recommendations.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label={t('recommendations.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">{t('recommendations.filter.allCategories', 'Alla Kategorier')}</option>
            {categories.filter(cat => cat !== 'all').map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'rating' | 'duration' | 'difficulty')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="rating">{t('recommendations.sort.rating', 'Sortera efter Betyg')}</option>
            <option value="duration">{t('recommendations.sort.duration', 'Sortera efter Längd')}</option>
            <option value="difficulty">{t('recommendations.sort.difficulty', 'Sortera efter Svårighetsgrad')}</option>
          </select>
        </div>

        {/* Results Count and Reset */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            {t('recommendations.filter.showingCount', 'Visar {{shown}} av {{total}} rekommendationer', { shown: filteredRecommendations.length, total: recommendations.length })}
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSortBy('rating');
              }}
              className="text-sm font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200 underline"
            >
              {t('recommendations.filter.reset', 'Återställ filter')}
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchTerm.trim() && (
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                {t('recommendations.filter.searchLabel', 'Sökning: {{term}}', { term: searchTerm.trim() })}
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                {t('recommendations.filter.categoryLabel', 'Kategori: {{category}}', { category: selectedCategory })}
              </span>
            )}
            {sortBy !== 'rating' && (
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                {t('recommendations.filter.sortLabel', 'Sortering: {{sort}}', { sort: sortLabel })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Featured Recommendations */}
      {!loading && !error && recommendations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t('recommendations.featured.title', '🌟 Rekommenderat för Dig')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.slice(0, 3).map((recommendation) => (
              <div
                key={`featured-${recommendation.id}`}
                className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-6 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{recommendation.image || getTypeIcon(recommendation.type)}</div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-sm ${star <= (recommendation.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {recommendation.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {recommendation.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(recommendation.difficulty) === 'success'
                      ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                      : getDifficultyColor(recommendation.difficulty) === 'warning'
                        ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                        : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300'
                      }`}>
                      {recommendation.difficulty}
                    </span>
                    {recommendation.duration && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {recommendation.duration} min
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleRecommendationAction(recommendation, 'start')}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {recommendation.type === 'meditation' ? t('recommendations.cta.start', 'Starta') :
                      recommendation.type === 'exercise' ? t('recommendations.cta.begin', 'Börja') :
                        recommendation.type === 'article' ? t('recommendations.cta.read', 'Läs') :
                          recommendation.type === 'challenge' ? t('recommendations.cta.startChallenge', 'Påbörja') : t('recommendations.cta.explore', 'Utforska')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Preferences */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t('recommendations.preferences.title', 'Dina Intressen & Wellness-mål')}
        </h3>

        {/* Wellness Goals Display */}
        {fetchedWellnessGoals.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('recommendations.preferences.currentGoals', 'Aktuella mål:')}</p>
            <div className="flex flex-wrap gap-2">
              {fetchedWellnessGoals.map((goal) => (
                <span
                  key={goal}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                >
                  {getWellnessGoalIcon(goal)} {goal}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {userPreferences.map((pref) => (
            <span
              key={pref}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
            >
              {pref}
            </span>
          ))}
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-3">
          {goalsUnavailable
            ? t(
              'recommendations.preferences.goalsUnavailable',
              'Dina wellness-mål kunde inte hämtas just nu, så förslagen nedan är allmänna och inte anpassade efter dem.'
            )
            : t('recommendations.preferences.adaptText', 'Vi anpassar rekommendationer baserat på dina intressen, aktivitet och wellness-mål')}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('recommendations.loading', 'Laddar personliga rekommendationer...')}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <div className="text-red-600 dark:text-red-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">{t('recommendations.error.title', 'Ett fel uppstod')}</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredRecommendations.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('recommendations.error.noResults', 'Inga rekommendationer hittades')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t('recommendations.error.noResultsHint', 'Prova att ändra dina söktermer eller filter')}
          </p>
        </div>
      )}

      {/* All Recommendations Section */}
      {!loading && !error && filteredRecommendations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('recommendations.allRecommendations', 'Alla Rekommendationer 📚')}
            </h2>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('recommendations.filter.resultsCount', '{{count}} resultat', { count: filteredRecommendations.length })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {filteredRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                language={i18n.language}
                feedbackByRecommendation={feedbackByRecommendation}
                getCategoryColor={getCategoryColor}
                getDifficultyColor={getDifficultyColor}
                getTypeIcon={getTypeIcon}
                getRecommendationMatchReason={getRecommendationMatchReason}
                onAction={handleRecommendationAction}
                onFeedback={handleRecommendationFeedback}
              />
            ))}
          </div>
        </div>
      )}

      {/* Content Modal */}
      {showContentModal && selectedRecommendation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[200]">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{selectedRecommendation.image || getTypeIcon(selectedRecommendation.type)}</div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedRecommendation.title}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedRecommendation.category} • {selectedRecommendation.type}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseContentModal}
                  className="text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md p-2"
                  aria-label={t('recommendations.content.close', 'Stäng')}
                >
                  ✕
                </button>
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(selectedRecommendation.difficulty) === 'success'
                  ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                  : getDifficultyColor(selectedRecommendation.difficulty) === 'warning'
                    ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                    : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300'
                  } `}>
                  {selectedRecommendation.difficulty}
                </span>
                {selectedRecommendation.duration && (
                  <span>{selectedRecommendation.duration} min</span>
                )}
                {selectedRecommendation.rating && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon
                        key={star}
                        className={`w-4 h-4 ${star <= (selectedRecommendation.rating || 0)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300 dark:text-gray-600'
                          } `}
                        aria-hidden="true"
                      />
                    ))}
                    <span>({selectedRecommendation.rating})</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {selectedRecommendation.description}
              </p>

              {/* Interactive Breathing Exercise for 4-7-8 */}
              {selectedRecommendation.id === 'stress-1' && (
                <BreathingExercise
                  userId={userId || user?.user_id}
                  initialCycles={selectedBreathingCycles}
                  initialStressBefore={breathingStressBefore}
                  onComplete={(cycles) => {
                    breathingOutcomeSyncedRef.current = false;
                    // Update progress
                    updateProgress('meditation', 4);
                    updateProgress('exercise', 1);
                    // Mark as completed
                    setRecommendations(prev =>
                      prev.map(r => (r.id === 'stress-1' ? { ...r, completed: true } : r))
                    );
                    // Save meditation session
                    const sessionData = {
                      type: 'breathing',
                      duration: 4,
                      technique: '4-7-8 Breathing',
                      completedCycles: cycles,
                      notes: `Breathing exercise completed ${cycles} cycles`,
                      moodBefore: breathingStressBefore,
                      moodAfter: breathingStressAfter,
                    };
                    void handleSaveMeditationSession(sessionData);
                  }}
                  onPhaseChange={(_, instruction) => {
                    announceToScreenReader(instruction, 'polite');
                  }}
                />
              )}

              {/* Interactive KBT Exercise for Stress Management */}
              {selectedRecommendation.id === 'stress-2' && (
                <KBTExercise
                  userId={user?.user_id}
                  onComplete={handleCloseContentModal}
                  initialBeliefBefore={kbtBeliefBefore}
                  initialStressBefore={kbtStressBefore}
                />
              )}

              {/* Interactive Neuroscience Article */}
              {selectedRecommendation.id === 'focus-3' && (
                <ArticleReader
                  articleProgress={articleProgress}
                  readingTime={readingTime}
                  currentSection={currentSection}
                  articleCompleted={articleCompleted}
                  showQuiz={showQuiz}
                  quizAnswers={quizAnswers}
                  quizScore={quizScore}
                  setCurrentSection={setCurrentSection}
                  updateArticleProgress={updateArticleProgress}
                  completeArticle={completeArticle}
                  startArticleReading={startArticleReading}
                  setShowQuiz={setShowQuiz}
                  setQuizAnswers={setQuizAnswers}
                  submitQuiz={submitQuiz}
                  onClose={handleCloseContentModal}
                />
              )}

              {/* Interactive Pomodoro Timer */}
              {selectedRecommendation.id === 'focus-1' && (
                <div className="bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-6 mb-4 border-2 border-red-200 dark:border-red-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    {t('recommendations.pomodoro.title', '🍅 Pomodoro-teknik för Bättre Fokus')}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    {t('recommendations.pomodoro.description', 'Strukturerad arbetsmetod: 25 minuter fokuserat arbete följt av 5 minuters paus för maximal produktivitet.')}
                  </p>

                  {/* Settings Panel */}
                  {!isPomodoroActive && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t('recommendations.pomodoro.customizeSettings', '⚙️ Anpassa Inställningar')}
                        </h4>
                        <button
                          onClick={() => setPomodoroSettingsOpen(!pomodoroSettingsOpen)}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {pomodoroSettingsOpen ? t('recommendations.pomodoro.hide', 'Dölj') : t('recommendations.pomodoro.show', 'Visa')}
                        </button>
                      </div>

                      {pomodoroSettingsOpen && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('recommendations.pomodoro.workMin', 'Arbete (min)')}
                              </label>
                              <input
                                type="number"
                                min="5"
                                max="60"
                                value={pomodoroWorkTime}
                                onChange={(e) => setPomodoroWorkTime(parseInt(e.target.value) || 25)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('recommendations.pomodoro.breakMin', 'Paus (min)')}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="30"
                                value={pomodoroBreakTime}
                                onChange={(e) => setPomodoroBreakTime(parseInt(e.target.value) || 5)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t('recommendations.pomodoro.sessionCount', 'Antal Sessioner')}
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="8"
                              value={totalPomodoroSessions}
                              onChange={(e) => setTotalPomodoroSessions(parseInt(e.target.value) || 4)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active Timer Display */}
                  {isPomodoroActive && (
                    <div className="text-center mb-6">
                      {/* Progress Circle */}
                      <div className="relative w-48 h-48 mx-auto mb-6">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          {/* Background circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-200 dark:text-gray-700"
                          />
                          {/* Progress circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 45} `}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - getPomodoroProgress() / 100)} `}
                            className={`transition-all duration-1000 ${pomodoroPhase === 'work'
                              ? 'text-red-500'
                              : pomodoroPhase === 'break'
                                ? 'text-green-500'
                                : 'text-purple-500'
                              } `}
                          />
                        </svg>

                        {/* Timer Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            {formatPomodoroTime(pomodoroTimeLeft)}
                          </div>
                          <div className="text-lg font-medium text-gray-600 dark:text-gray-400">
                            {pomodoroPhase === 'work' ? t('recommendations.pomodoro.workLabel', 'Arbete') : pomodoroPhase === 'break' ? t('recommendations.pomodoro.breakLabel', 'Paus') : t('recommendations.pomodoro.completedLabel', 'Slutfört')}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-500">
                            {t('recommendations.pomodoro.sessionOf', 'Session {{current}} av {{total}}', { current: pomodoroSession, total: totalPomodoroSessions })}
                          </div>
                        </div>
                      </div>

                      {/* Phase Indicator */}
                      <div className="mb-4">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${pomodoroPhase === 'work'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : pomodoroPhase === 'break'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          } `}>
                          {pomodoroPhase === 'work' ? '🔴' : pomodoroPhase === 'break' ? '🟢' : '🎉'}
                          {pomodoroPhase === 'work'
                            ? t('recommendations.pomodoro.focusedWork', 'Fokuserat arbete - {{minutes}} min', { minutes: pomodoroWorkTime })
                            : pomodoroPhase === 'break'
                              ? t('recommendations.pomodoro.wellEarnedBreak', 'Välförtjänt paus - {{minutes}} min', { minutes: pomodoroBreakTime })
                              : t('recommendations.pomodoro.allSessionsComplete', 'Alla sessioner slutförda!')}
                        </div>
                      </div>

                      {/* Session Progress */}
                      <div className="flex justify-center gap-1 mb-4">
                        {Array.from({ length: totalPomodoroSessions }, (_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full ${i + 1 < pomodoroSession
                              ? 'bg-green-500'
                              : i + 1 === pomodoroSession && pomodoroPhase === 'work'
                                ? 'bg-red-500 animate-pulse'
                                : i + 1 === pomodoroSession && pomodoroPhase === 'break'
                                  ? 'bg-green-500 animate-pulse'
                                  : 'bg-gray-300 dark:bg-gray-600'
                              } `}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Session History */}
                  {pomodoroHistory.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        {t('recommendations.pomodoro.recentSessions', '📊 Senaste Sessioner')}
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {pomodoroHistory.slice(0, 5).map((session, idx) => (
                          <div key={`${session.date}-${idx}`} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {session.type === 'work' ? '🍅' : '☕'} Session {session.sessionNumber}
                            </span>
                            <span className="text-gray-500 dark:text-gray-500">
                              {session.workDuration || session.breakDuration}min • {new Date(session.date).toLocaleTimeString(i18n.language)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Control Buttons */}
                  <div className="flex justify-center gap-3">
                    {!isPomodoroActive ? (
                      <button
                        onClick={startPomodoroTimer}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        {t('recommendations.pomodoro.start', '🚀 Starta Pomodoro')}
                      </button>
                    ) : pomodoroPhase !== 'completed' ? (
                      <button
                        onClick={stopPomodoroTimer}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        {t('recommendations.pomodoro.stop', '⏹️ Stoppa')}
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseContentModal}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                      >
                        {t('recommendations.pomodoro.close', '🎉 Stäng')}
                      </button>
                    )}
                  </div>

                  {/* Completion Message */}
                  {pomodoroPhase === 'completed' && (
                    <div className="text-center mt-6">
                      <div className="text-6xl mb-4">🎉</div>
                      <h4 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                        {t('recommendations.pomodoro.congratsTitle', 'Grattis! Alla Pomodoro-sessioner slutförda!')}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        {t('recommendations.pomodoro.congratsBody', 'Du har framgångsrikt genomfört {{count}} fokuserade arbetssessioner. Detta är ett viktigt steg mot bättre produktivitet och fokus!', { count: totalPomodoroSessions })}
                      </p>
                    </div>
                  )}

                </div>
              )}

              {/* Interactive Journaling */}
              {selectedRecommendation.id === 'clarity-2' && (
                <JournalingPrompt
                  onClose={handleCloseContentModal}
                  user={user}
                  announce={announceToScreenReader}
                  onProgress={updateProgress}
                />
              )}

              {/* Interactive Gratitude Challenge */}
              {selectedRecommendation.id === 'generic-1' && (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-100 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg p-6 mb-4 border-2 border-orange-200 dark:border-orange-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    {t('recommendations.gratitude.title', '🙏 7-Dagars Tacksamhetsutmaning')}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    {t('recommendations.gratitude.description', 'Utveckla en mer positiv syn genom att skriva ner tre saker du är tacksam för varje dag.')}
                  </p>

                  {/* Progress Indicator */}
                  <div className="flex justify-center mb-6">
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div
                          key={i + 1}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${i + 1 <= gratitudeDay && (gratitudeEntries[i + 1]?.length || 0) >= 3
                            ? 'bg-green-500 text-white shadow-lg'
                            : i + 1 === gratitudeDay && isGratitudeChallengeActive
                              ? 'bg-orange-500 text-white animate-pulse shadow-lg'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            } `}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Daily Gratitude Entry */}
                  {isGratitudeChallengeActive && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {t('recommendations.gratitude.day', 'Dag {{day}}: {{prompt}}', { day: gratitudeDay, prompt: getGratitudePrompts(gratitudeDay) })}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('recommendations.gratitude.writeThree', 'Skriv ner minst 3 saker du är tacksam för idag')}
                        </p>
                      </div>

                      {/* Gratitude Input */}
                      <div className="space-y-3">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="relative">
                            <input
                              type="text"
                              placeholder={t('recommendations.gratitude.placeholder', 'Tacksam sak {{index}}...', { index: index + 1 })}
                              value={gratitudeEntries[gratitudeDay]?.[index] || ''}
                              onChange={(e) => {
                                const currentEntries = gratitudeEntries[gratitudeDay] || ['', '', ''];
                                currentEntries[index] = e.target.value;
                                setGratitudeEntries({
                                  ...gratitudeEntries,
                                  [gratitudeDay]: currentEntries
                                });
                              }}
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            {gratitudeEntries[gratitudeDay]?.[index] && (
                              <div className="absolute right-3 top-3 text-green-500">
                                ✓
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Previous Days Summary */}
                      {Object.keys(gratitudeEntries).length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {t('recommendations.gratitude.previousDays', 'Dina tidigare dagar:')}
                          </h5>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {Object.entries(gratitudeEntries)
                              .filter(([day]) => parseInt(day) < gratitudeDay)
                              .sort(([a], [b]) => parseInt(b) - parseInt(a))
                              .slice(0, 3)
                              .map(([day, entries]) => (
                                <div key={day} className="text-sm">
                                  <span className="font-medium text-orange-600 dark:text-orange-400">
                                    {t('recommendations.gratitude.dayLabel', 'Dag {{day}}:', { day })}
                                  </span>
                                  <ul className="ml-4 mt-1 space-y-1">
                                    {entries.slice(0, 2).map((entry, i) => (
                                      <li key={i} className="text-gray-600 dark:text-gray-400">
                                        • {entry}
                                      </li>
                                    ))}
                                    {entries.length > 2 && (
                                      <li className="text-gray-500 dark:text-gray-500 text-xs">
                                        {t('recommendations.gratitude.more', '+{{count}} till', { count: entries.length - 2 })}
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Encouragement */}
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                        <p className="text-sm text-orange-700 dark:text-orange-300 text-center">
                          {t('recommendations.gratitude.remember', '💡 Kom ihåg: Tacksamhet förändrar hur vi ser på världen. Även små saker kan göra stor skillnad!')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Control Buttons */}
                  <div className="flex justify-center gap-3 mt-6">
                    {!isGratitudeChallengeActive ? (
                      <button
                        onClick={startGratitudeChallenge}
                        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                      >
                        {t('recommendations.gratitude.startChallenge', '🚀 Starta Utmaningen')}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            const currentEntries = gratitudeEntries[gratitudeDay] || [];
                            if (currentEntries.filter(e => e.trim()).length >= 3) {
                              void saveGratitudeEntry(gratitudeDay, currentEntries).then(() => {
                                nextGratitudeDay();
                              });
                            } else {
                              announceToScreenReader(t('recommendations.announce.gratitudeMinThree', 'Skriv minst 3 saker du är tacksam för'), 'assertive');
                            }
                          }}
                          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                          disabled={(gratitudeEntries[gratitudeDay] || []).filter(e => e.trim()).length < 3 || isSavingGratitude}
                        >
                          {isSavingGratitude ? t('recommendations.gratitude.saving', '💾 Sparar...') :
                            (gratitudeEntries[gratitudeDay] && gratitudeEntries[gratitudeDay].filter(e => e.trim()).length >= 3) ?
                              t('recommendations.gratitude.dayComplete', '✅ Dag {{day}} Slutförd', { day: gratitudeDay }) :
                              (gratitudeDay < 7 ? t('recommendations.gratitude.saveDay', 'Spara Dag {{day}} →', { day: gratitudeDay }) : t('recommendations.gratitude.finishChallenge', '🎉 Slutför Utmaningen'))}
                        </button>
                        <button
                          onClick={cancelGratitudeLogic}
                          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                        >
                          {t('recommendations.gratitude.cancel', '⏹️ Avbryt')}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Challenge Complete Celebration */}
                  {gratitudeDay > 7 && (
                    <div className="text-center mt-6">
                      <div className="text-6xl mb-4">🎉</div>
                      <h4 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                        {t('recommendations.gratitude.congratsTitle', 'Grattis! Utmaningen är slutförd! 🌟')}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        {t('recommendations.gratitude.congratsBody', 'Du har framgångsrikt genomfört 7 dagar av tacksamhetspraxis. Detta är ett viktigt steg mot bättre mental hälsa!')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Progressive Muscle Relaxation */}
              {selectedRecommendation.id === 'stress-3' && (
                <PMRExercise
                  onComplete={handleCloseContentModal}
                  onSaveSession={handleSaveMeditationSession}
                  onUpdateProgress={updateProgress}
                />
              )}

              {/* Generic Meditation Player */}
              {selectedRecommendation.type === 'meditation' && !['stress-1', 'stress-3'].includes(selectedRecommendation.id) && (
                <MeditationSession
                  duration={selectedRecommendation.duration || 10}
                  title={selectedRecommendation.title}
                  onSaveSession={handleSaveMeditationSession}
                  onUpdateProgress={updateProgress}
                />
              )}

              {/* Content */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('recommendations.content.instructions', 'Instruktioner')}</h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {selectedRecommendation.content}
                </p>
              </div>

              {/* Tags */}
              {selectedRecommendation.tags.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('recommendations.content.relatedTopics', 'Relaterade Ämnen')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecommendation.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSearchTerm(tag);
                          announceToScreenReader(t('recommendations.announce.filterActivated', 'Filter aktiverat för {{tag}}', { tag }), 'polite');
                        }}
                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  disabled={isPrimaryActionDisabled}
                  onClick={async () => {
                    try {
                      if (isSelectedRecommendationCompleted && selectedRecommendationHasNextFlow) {
                        if (selectedRecommendation.type === 'exercise') {
                          handleCloseContentModal();
                          navigate('/journal');
                          announceToScreenReader(t('recommendations.announce.openingJournal', 'Öppnar dagboken för reflektion.'), 'polite');
                          return;
                        }

                        const currentIndex = recommendations.findIndex(rec => rec.id === selectedRecommendation.id);
                        const nextRecommendation = currentIndex >= 0 ? recommendations[currentIndex + 1] : null;

                        if (nextRecommendation) {
                          setSelectedRecommendation(nextRecommendation);
                          announceToScreenReader(t('recommendations.announce.nextExercise', 'Nästa övning: {{title}}', { title: nextRecommendation.title }), 'polite');
                        } else {
                          announceToScreenReader(t('recommendations.announce.allRecommendationsDone', 'Du har gått igenom alla rekommendationer i listan.'), 'polite');
                        }
                        return;
                      }

                      if (!canManuallyCompleteSelectedRecommendation) {
                        announceToScreenReader(t('recommendations.announce.completeBreathingFirst', 'Slutför andningsövningen först för att markera aktiviteten som slutförd.'), 'polite');
                        return;
                      }

                      const alreadyCompleted = !!completedRecommendationIds[selectedRecommendation.id];

                      // Mark as completed in local state
                      setRecommendations(prev =>
                        prev.map(r =>
                          r.id === selectedRecommendation.id ? { ...r, completed: true } : r
                        )
                      );
                      setCompletedRecommendationIds(prev => ({ ...prev, [selectedRecommendation.id]: true }));

                      // Update progress only once and avoid duplicate counting for auto-completed stress-1.
                      if (!alreadyCompleted && selectedRecommendation.id !== 'stress-1') {
                        if (selectedRecommendation.type === 'meditation') {
                          updateProgress('meditation', selectedRecommendation.duration || 10);
                        } else if (selectedRecommendation.type === 'exercise') {
                          updateProgress('exercise');
                        } else if (selectedRecommendation.type === 'article') {
                          updateProgress('article');
                        }
                      }

                      logger.debug('✅ Recommendation marked as completed:', selectedRecommendation.id);
                      if (!alreadyCompleted) {
                        analytics.track('Recommendation Completed', {
                          recommendationId: selectedRecommendation.id,
                          type: selectedRecommendation.type,
                          duration: selectedRecommendation.duration,
                          source: selectedRecommendation.id === 'stress-1' ? 'manual_after_breathing' : 'manual',
                          component: 'Recommendations',
                        });
                      }

                      handleCloseContentModal();
                      announceToScreenReader(
                        alreadyCompleted
                          ? t('recommendations.announce.alreadyCompleted', '{{title}} var redan markerad som slutförd.', { title: selectedRecommendation.title })
                          : t('recommendations.announce.markedCompleted', '{{title}} markerad som slutförd', { title: selectedRecommendation.title }),
                        'polite'
                      );
                    } catch (error) {
                      logger.error('Failed to mark as completed:', error);
                      announceToScreenReader(t('recommendations.announce.markCompletedFailed', 'Kunde inte markera som slutförd'), 'assertive');
                    }
                  }}
                  className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors ${!isPrimaryActionDisabled
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {isSelectedRecommendationCompleted ? nextCompletedActionLabel : t('recommendations.content.markCompleted', 'Markera som Slutförd')}
                </button>
                <button
                  onClick={handleCloseContentModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('recommendations.content.close', 'Stäng')}
                </button>
              </div>
              {isStressBreathingRecommendation && !canManuallyCompleteSelectedRecommendation && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {t('recommendations.content.completeCyclesFirst', 'Slutför {{count}} cykler först. När texten visar "Andningsövning slutförd" kan du markera aktiviteten.', { count: selectedBreathingCycles })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Crisis Alert Modal */}
      {showCrisisAlert && (
        <CrisisAlertModal onClose={() => setShowCrisisAlert(false)} />
      )}

      {/* Daily Reminders Settings Modal */}
      {showNotificationSettings && (
        <NotificationSettingsModal
          notificationSettings={notificationSettings}
          isEnablingNotifications={isEnablingNotifications}
          onEnable={enableDailyReminders}
          onDisable={disableDailyReminders}
          onUpdateReminderTime={updateReminderTime}
          onTimeChange={(time) => setNotificationSettings(prev => ({ ...prev, reminderTime: time }))}
          onClose={() => setShowNotificationSettings(false)}
        />
      )}

      {/* Professional Disclaimer */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 dark:text-yellow-400 text-xl">⚠️</div>
          <div>
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              {t('recommendations.disclaimer.title', 'Viktig Information om Mental Hälsa')}
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
              {t('recommendations.disclaimer.body', 'Detta är ett stödverktyg, inte en ersättning för professionell vård. Om du upplever allvarliga mentala hälsoproblem, kontakta en kvalificerad vårdgivare.')}
            </p>
            <div className="text-xs text-yellow-600 dark:text-yellow-400">
              <p className="mb-1">{t('recommendations.disclaimer.crisisNumber', '🔹 Krisnummer Sverige: 112 (akut) eller 1177 (vårdguiden)')}</p>
              <p>{t('recommendations.disclaimer.suicideLine', '🔹 Självmordslinjen: 0900-011 200 (alla dagar 24/7)')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Inspiration */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6 sm:p-8 text-center mb-6 sm:mb-8">
        <div className="flex justify-center mb-4">
          <LightBulbIcon className="w-12 h-12 sm:w-16 sm:h-16" aria-hidden="true" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
          {t('recommendations.inspiration.title', 'Dagens Inspiration')}
        </h3>
        <p className="text-sm sm:text-base mb-4 sm:mb-6 opacity-90 max-w-2xl mx-auto">
          {t('recommendations.inspiration.body', '"Små, konsekventa steg kan skapa positiva förändringar över tid. En studie från University College London visar att det i genomsnitt tar 66 dagar att skapa nya vanor, med en stor variation mellan individer (18-254 dagar). Varje dag är en möjlighet att lära sig mer om mental hälsa."')}
        </p>
        <button
          onClick={() => setShowNotificationSettings(true)}
          className="px-6 py-2.5 border-2 border-white text-white font-medium rounded-lg hover:bg-white hover:text-purple-600 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-500 min-h-[44px]"
          title={t('recommendations.inspiration.configureTitle', 'Konfigurera dagliga påminnelser för mental hälsa')}
        >
          🔔 {notificationSettings.dailyRemindersEnabled ? t('recommendations.inspiration.manageReminders', 'Hantera Dagliga Påminnelser') : t('recommendations.inspiration.enableReminders', 'Aktivera Dagliga Påminnelser')}
        </button>
      </div>

      {/* Progress Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
          {t('recommendations.progress.title', 'Dina Framsteg Denna Vecka')}
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {userProgress?.exercisesCompleted ?? 0}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('recommendations.progress.exercisesDone', 'Övningar Gjorda')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t('recommendations.progress.thisWeek', 'Denna vecka')}
            </p>
          </div>

          <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
              {userProgress?.meditationMinutes ?? 0}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('recommendations.progress.meditationMinutes', 'Minuter Meditation')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t('recommendations.progress.thisWeek', 'Denna vecka')}
            </p>
          </div>

          <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {userProgress?.articlesRead ?? 0}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('recommendations.progress.articlesRead', 'Artiklar Lästa')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t('recommendations.progress.thisWeek', 'Denna vecka')}
            </p>
          </div>

          <div className="text-center p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-400 mb-1">
              {userProgress?.weeklyGoalProgress ? Math.round(userProgress.weeklyGoalProgress) : 0}%
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t('recommendations.progress.goalAchieved', 'Mål Uppnått')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t('recommendations.progress.weeklyGoal', 'Veckomål')}
            </p>
          </div>
        </div>
      </div>

      {/* Professional Footer - Additional Resources */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 sm:p-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('recommendations.footer.title', 'Ytterligare Stöd & Resurser 🏥')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('recommendations.footer.subtitle', 'Förutom våra interaktiva övningar finns det många professionella resurser tillgängliga')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Professional Help */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">👨‍⚕️</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{t('recommendations.footer.professionalHelp', 'Professionell Hjälp')}</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>{t('recommendations.footer.prof1', '• Psykolog eller psykoterapeut')}</li>
              <li>{t('recommendations.footer.prof2', '• Psykiatrisk vård vid behov')}</li>
              <li>{t('recommendations.footer.prof3', '• Krisintervention')}</li>
              <li>{t('recommendations.footer.prof4', '• KBT-terapi')}</li>
            </ul>
            <div className="mt-4 text-center">
              <a
                href="tel:1177"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('recommendations.footer.call1177', 'Ring 1177')}
              </a>
            </div>
          </div>

          {/* Community Support */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🤝</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{t('recommendations.footer.community', 'Gemenskap & Stöd')}</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>{t('recommendations.footer.comm1', '• Självhjälpsgrupper')}</li>
              <li>{t('recommendations.footer.comm2', '• Online-forum')}</li>
              <li>{t('recommendations.footer.comm3', '• Stödlinjer')}</li>
              <li>{t('recommendations.footer.comm4', '• Anhörigstöd')}</li>
            </ul>
            <div className="mt-4 text-center">
              <a
                href="tel:0900011200"
                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('recommendations.footer.suicideLine', 'Självmordslinjen')}
              </a>
            </div>
          </div>

          {/* Self-Help Resources */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📚</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{t('recommendations.footer.selfHelp', 'Självhjälp & Utbildning')}</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>{t('recommendations.footer.self1', '• Böcker om mental hälsa')}</li>
              <li>{t('recommendations.footer.self2', '• Online-kurser')}</li>
              <li>{t('recommendations.footer.self3', '• Mindfulness-appar')}</li>
              <li>{t('recommendations.footer.self4', '• Utbildningsmaterial')}</li>
            </ul>
            <div className="mt-4 text-center">
              <button
                onClick={() => window.open('https://www.1177.se', '_blank', 'noopener,noreferrer')}
                className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                1177.se
              </button>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('recommendations.footer.ctaTitle', 'Redo att Ta Nästa Steg? 🌟')}
          </h4>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('recommendations.footer.ctaBody', 'Fortsätt din resa mot bättre mental hälsa med våra dagliga utmaningar och meditationer')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('recommendations.footer.goToDashboard', 'Gå Till Dashboard')}
            </button>
            <button
              onClick={() => navigate('/wellness')}
              className="px-6 py-3 border border-primary-600 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium rounded-lg transition-colors"
            >
              {t('recommendations.footer.updateGoals', 'Uppdatera Dina Mål')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

Recommendations.displayName = 'Recommendations';

export default Recommendations;



