import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import useAuth from '../hooks/useAuth';
import { getWellnessGoals } from '../api/dashboard';
import { getNotificationSettings, updateNotificationSettings } from '../api/notifications';
import { initializeMessaging } from '../services/notifications';
import { saveMeditationSession, getMeditationSessions } from '../api/meditation';
import { logger } from '../utils/logger';
import {
  getCBTExercises,
  getCBTInsights,
  getCBTModules,
  getPersonalizedSession,
  type CBTExercise,
  type CBTInsights,
  type CBTModule,
  type PersonalizedSession,
  updateCBTProgress,
} from '../api/cbt';
import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  PlayIcon,
  LightBulbIcon,
  BookmarkIcon,
  ShareIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import { Recommendation, RecommendationsProps } from '../types/recommendation';
import { getRecommendationsPool, neuroscienceArticleSections, neuroscienceQuiz } from '../constants/recommendations';
import { getWellnessGoalIcon } from '../constants/wellnessGoals';
import { BreathingExercise } from './recommendations/BreathingExercise';
import { KBTExercise } from './recommendations/KBTExercise';
import { PMRExercise } from './recommendations/PMRExercise';
import { MeditationSession } from './recommendations/MeditationSession';
import { JournalingPrompt } from './recommendations/JournalingPrompt';
import { usePomodoro } from '../hooks/usePomodoro';
import { useGratitude } from '../hooks/useGratitude';
import {
  EMPTY_WELLNESS_GOALS,
  type RecommendationFeedback,
  formatTime,
  formatReadingTime,
  formatPomodoroTime,
} from '../constants/recommendationsConstants';

// interfaces are now imported from ../types/recommendation

const Recommendations: React.FC<RecommendationsProps> = React.memo(({ userId, wellnessGoals = EMPTY_WELLNESS_GOALS, compact = false }) => {
  const navigate = useNavigate();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const { t } = useTranslation();
  const lastRecommendationsSignatureRef = useRef<string>('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [userPreferences] = useState<string[]>(['mindfulness', 'stress', 'anxiety']);
  const [fetchedWellnessGoals, setFetchedWellnessGoals] = useState<string[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [completedRecommendationIds, setCompletedRecommendationIds] = useState<Record<string, boolean>>({});
  const resolvedWellnessGoals = Array.isArray(wellnessGoals) ? wellnessGoals : EMPTY_WELLNESS_GOALS;
  const wellnessGoalsSignature = resolvedWellnessGoals.join('|');
  
  // User progress state (must be before saveUserProgress which references it)
  const [userProgress, setUserProgress] = useState({
    exercisesCompleted: 0,
    meditationMinutes: 0,
    articlesRead: 0,
    weeklyGoalProgress: 0
  });
  
  // Save user progress to localStorage
  const saveUserProgress = useCallback((progress: typeof userProgress) => {
    if (user?.user_id) {
      localStorage.setItem(`user_progress_${user.user_id}`, JSON.stringify(progress));
      logger.debug('Saved user progress:', progress);
    }
  }, [user?.user_id]);
  
  // Update progress when user completes an activity
  const updateProgress = useCallback((type: string, amount?: number) => {
    logger.debug('📊 UPDATE PROGRESS called:', { type, amount, userId: user?.user_id });
    setUserProgress(prev => {
      const newProgress = { ...prev };

      switch (type) {
        case 'exercise':
          newProgress.exercisesCompleted += amount ?? 1;
          logger.debug('📊 Exercise completed, new count:', newProgress.exercisesCompleted);
          break;
        case 'meditation':
          newProgress.meditationMinutes += amount ?? 0;
          logger.debug('📊 Meditation minutes added', {
            addedMinutes: amount,
            totalMinutes: newProgress.meditationMinutes,
          });
          break;
        case 'article':
          newProgress.articlesRead += amount ?? 1;
          logger.debug('📊 Article read, new count:', newProgress.articlesRead);
          break;
      }

      // Calculate weekly goal progress (assuming 7 exercises/week goal)
      newProgress.weeklyGoalProgress = Math.min((newProgress.exercisesCompleted / 7) * 100, 100);

      logger.debug('📊 New progress state:', newProgress);
      saveUserProgress(newProgress);
      return newProgress;
    });
  }, [user?.user_id, saveUserProgress]);

  const [selectedBreathingCycles, setSelectedBreathingCycles] = useState<4 | 8 | 12>(4);
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



  const [loading, setLoading] = useState(!compact);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'duration' | 'difficulty'>('rating');
  const [feedbackByRecommendation, setFeedbackByRecommendation] = useState<Record<string, RecommendationFeedback | undefined>>({});
  const [cbtModules, setCbtModules] = useState<CBTModule[]>([]);
  const [cbtSession, setCbtSession] = useState<PersonalizedSession | null>(null);
  const [cbtInsights, setCbtInsights] = useState<CBTInsights | null>(null);
  const [cbtExercises, setCbtExercises] = useState<CBTExercise[]>([]);
  const [cbtLoading, setCbtLoading] = useState(false);
  const [cbtError, setCbtError] = useState<string | null>(null);
  const [cbtCurrentMood, setCbtCurrentMood] = useState<string>('neutral');
  const [activeCbtExerciseId, setActiveCbtExerciseId] = useState<string | null>(null);

  // Behavioral Activation exercise state
  const [baStep, setBaStep] = useState(0);
  const [baActivities, setBaActivities] = useState('');
  const [baSelectedActivity, setBaSelectedActivity] = useState('');
  const [baBarriers, setBaBarriers] = useState('');
  const [baPlan, setBaPlan] = useState('');
  const [baPleasureRating, setBaPleasureRating] = useState<number | null>(null);
  const [baReflection, setBaReflection] = useState('');

  // Worry Time exercise state
  const [wtStep, setWtStep] = useState(0);
  const [wtWorries, setWtWorries] = useState('');
  const [wtScheduledTime, setWtScheduledTime] = useState('');
  const [wtPostponeCommitted, setWtPostponeCommitted] = useState(false);
  const [wtReflection, setWtReflection] = useState('');

  const startCbtExercise = (exerciseId: string) => {
    setActiveCbtExerciseId(exerciseId);
    if (exerciseId === 'behavioral_activation') {
      setBaStep(1); setBaActivities(''); setBaSelectedActivity('');
      setBaBarriers(''); setBaPlan(''); setBaPleasureRating(null); setBaReflection('');
    } else if (exerciseId === 'worry_time') {
      setWtStep(1); setWtWorries(''); setWtScheduledTime('');
      setWtPostponeCommitted(false); setWtReflection('');
    }
  };

  const completeCbtExercise = (exerciseId: string, difficultyRating: number) => {
    updateCBTProgress({
      exerciseId,
      successRate: 0.8,
      timeSpent: exerciseId === 'behavioral_activation' ? 20 : 25,
      difficultyRating,
    }).catch((error) => {
      logger.error('Failed to update CBT progress:', error);
    });
    setActiveCbtExerciseId(null);
    announceToScreenReader('Övning slutförd! Bra jobbat!', 'polite');
  };

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

  // Daily Reminders State
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    dailyRemindersEnabled: true,
    reminderTime: '09:00',
    fcmToken: false
  });
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);

  // Gratitude Challenge State
  // Gratitude Challenge State (Refactored to use useGratitude)
  const [, setShowGratitudeModal] = useState(false);

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
        announceToScreenReader(`Alla ${totalPomodoroSessions} Pomodoro - sessioner slutförda!`, 'polite');
      } else if (phase === 'break') {
        announceToScreenReader(`${pomodoroBreakTime} minuters paus börjar`, 'polite');
      } else if (phase === 'work' && session > 1) {
        announceToScreenReader(`Paus slut. Session ${session} börjar`, 'polite');
      }
    }
  });

  // Article Reading & Quiz State
  const [articleProgress, setArticleProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const articleReadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [articleCompleted, setArticleCompleted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // Crisis Alert State
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  // KBT Exercise State
  const [kbtBeliefBefore, setKbtBeliefBefore] = useState<number | null>(null);
  const [kbtStressBefore, setKbtStressBefore] = useState<number | null>(null);

  // Journal History Handler
  const handleLoadJournalHistory = useCallback(async () => {
    if (!user?.user_id) return;
    // Journal history loading is handled by useJournaling hook
    logger.debug('Journal history load requested');
  }, [user?.user_id]);

  // Category color helper function
  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      'Stresshantering': 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
      'Sömn': 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800',
      'Fokus': 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800',
      'Mental klarhet': 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
      'Produktivitet': 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
      'Relationer': 'bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800',
    };
    return colors[category] || 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  }, []);

  useEffect(() => {
    if (!user?.user_id) {
      setCbtModules([]);
      setCbtSession(null);
      setCbtInsights(null);
      setCbtExercises([]);
      setCbtError(null);
      return;
    }

    let active = true;
    const loadCbtData = async () => {
      setCbtLoading(true);
      setCbtError(null);
      try {
        const [modulesResult, sessionResult, insightsResult, exercisesResult] = await Promise.allSettled([
          getCBTModules(),
          getPersonalizedSession(cbtCurrentMood),
          getCBTInsights(),
          getCBTExercises(),
        ]);

        if (!active) return;

        if (modulesResult.status === 'fulfilled') setCbtModules(modulesResult.value);
        if (sessionResult.status === 'fulfilled') setCbtSession(sessionResult.value);
        if (insightsResult.status === 'fulfilled') setCbtInsights(insightsResult.value);
        if (exercisesResult.status === 'fulfilled') setCbtExercises(exercisesResult.value);

        const hasAtLeastOneSuccess = [modulesResult, sessionResult, insightsResult, exercisesResult]
          .some((item) => item.status === 'fulfilled');

        if (!hasAtLeastOneSuccess) {
          setCbtError('CBT-data kunde inte laddas just nu. Försök igen senare.');
        }
      } catch (error) {
        logger.error('Failed to load CBT data', { error });
        if (active) {
          setCbtError('CBT-data kunde inte laddas just nu.');
        }
      } finally {
        if (active) {
          setCbtLoading(false);
        }
      }
    };

    loadCbtData();
    return () => {
      active = false;
    };
  }, [user?.user_id, cbtCurrentMood]);

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

    const recommendationSignature = filteredRecommendations
      .map((recommendation) => recommendation.id)
      .join('|');

    if (recommendationSignature === lastRecommendationsSignatureRef.current) {
      return;
    }

    lastRecommendationsSignatureRef.current = recommendationSignature;
    setRecommendations(filteredRecommendations);
    if (!compact) {
      screenReader(`${filteredRecommendations.length} personaliserade rekommendationer laddade`, 'polite');
    }
  }, [compact, t]);

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
        // Don't set error state - just show generic recommendations
      } finally {
        setLoading(false);
        logger.debug('🏁 Wellness goals fetch completed');
      }
    };

    fetchWellnessGoalsData();
  }, [compact, resolvedWellnessGoals, user?.user_id, wellnessGoalsSignature]);

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
      if (articleReadingTimerRef.current) {
        clearInterval(articleReadingTimerRef.current);
        articleReadingTimerRef.current = null;
      }
    };
  }, []);

  // KBT exercise functions now provided by the useKBTExercise hook

  // Progressive Relaxation functions are now provided by usePMR hook

  const startGratitudeChallenge = () => {
    startGratitudeLogic();
    setShowGratitudeModal(true);
  };

  // Pomodoro functions provided by usePomodoro hook


  const getPomodoroProgress = () => {
    const totalTime = pomodoroPhase === 'work' ? pomodoroWorkTime * 60 : pomodoroBreakTime * 60;
    return ((totalTime - pomodoroTimeLeft) / totalTime) * 100;
  };

  const startArticleReading = () => {
    logger.debug('🧠 Starting neuroscience article reading');

    // Clear existing timer if any
    if (articleReadingTimerRef.current) {
      clearInterval(articleReadingTimerRef.current);
    }

    // Start reading timer
    const timer = setInterval(() => {
      setReadingTime(prev => prev + 1);
    }, 1000);
    articleReadingTimerRef.current = timer;

    // Load saved progress
    if (user?.user_id) {
      const saved = localStorage.getItem(`article_progress_focus-3_${user.user_id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setArticleProgress(parsed.progress || 0);
          setCurrentSection(parsed.section || 0);
          setReadingTime(parsed.readingTime || 0);
          setArticleCompleted(parsed.completed || false);
          logger.debug('💾 Loaded article progress:', parsed);
        } catch(e) {
          logger.error('Failed to load article progress', e as Error);
        }
      }
    }
  };

  const updateArticleProgress = (section: number, progress: number) => {
    setCurrentSection(section);
    setArticleProgress(progress);

    // Save progress
    if (user?.user_id) {
      const progressData = {
        progress,
        section,
        readingTime,
        completed: progress >= 100,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(`article_progress_focus-3_${user.user_id}`, JSON.stringify(progressData));
      logger.debug('💾 Saved article progress:', progressData);
    }
  };

  const completeArticle = () => {
    logger.debug('✅ Neuroscience article completed');

    setArticleCompleted(true);
    setArticleProgress(100);

    // Stop reading timer
    if (articleReadingTimerRef.current) {
      clearInterval(articleReadingTimerRef.current);
      articleReadingTimerRef.current = null;
    }

    // Calculate reading speed and provide feedback
    const totalWords = neuroscienceArticleSections.reduce((total, section) => {
      // Strip HTML tags and count words
      const textContent = section.content.replace(/<[^>]*>/g, '');
      return total + textContent.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);

    const wordsPerMinute = readingTime > 0 ? Math.round((totalWords / readingTime) * 60) : 0;
    const readingSpeed = wordsPerMinute > 250 ? 'snabb' : wordsPerMinute > 150 ? 'normal' : 'långsam';

    logger.debug(`📊 Reading stats: ${totalWords} words in ${readingTime} s = ${wordsPerMinute} WPM (${readingSpeed})`);

    // Update progress with bonus based on reading speed
    const baseMinutes = 7;
    const speedBonus = readingSpeed === 'snabb' ? 2 : readingSpeed === 'normal' ? 1 : 0;
    updateProgress('article', baseMinutes + speedBonus);

    // Save completion with reading stats
    if (user?.user_id) {
      const completionData = {
        progress: 100,
        section: 4, // Last section
        readingTime,
        wordsPerMinute,
        readingSpeed,
        completed: true,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem(`article_progress_focus-3_${user.user_id}`, JSON.stringify(completionData));
    }

    announceToScreenReader('Artikeln om neurovetenskap och fokus är nu slutförd!', 'polite');
  };

  const submitQuiz = () => {
    // Correct answers match the neuroscienceQuiz pool indexes: [DAN, Dopamine, Time, PFC, GrayMatter, Flow]
    const correctAnswers = [1, 1, 3, 2, 2, 1];
    let score = 0;

    correctAnswers.forEach((correct, index) => {
      if (quizAnswers[index] === correct) {
        score++;
      }
    });

    setQuizScore(score);
    setShowQuiz(false);

    // Update progress for quiz completion
    updateProgress('exercise', 5);

    announceToScreenReader(`Du fick ${score} av ${correctAnswers.length} rätt på quizet`, 'polite');
  };



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

  const categories = useMemo(() => ['all', ...Array.from(new Set(recommendations.map(r => r.category))).sort()], [recommendations]);
  const hasActiveFilters = useMemo(() => searchTerm.trim().length > 0 || selectedCategory !== 'all' || sortBy !== 'rating', [searchTerm, selectedCategory, sortBy]);
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(rec =>
        rec.title.toLowerCase().includes(searchLower) ||
        rec.description.toLowerCase().includes(searchLower) ||
        rec.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        rec.category.toLowerCase().includes(searchLower)
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(rec => rec.category === selectedCategory);
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'duration': return (a.duration || 0) - (b.duration || 0);
        case 'difficulty': {
          const difficultyOrder: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
          return (difficultyOrder[a.difficulty] ?? 1) - (difficultyOrder[b.difficulty] ?? 1);
        }
        default: return 0;
      }
    });
    return filtered;
  }, [recommendations, searchTerm, selectedCategory, sortBy]);

  const sortLabel = sortBy === 'rating'
    ? 'Betyg'
    : sortBy === 'duration'
      ? 'Längd'
      : 'Svårighetsgrad';

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
      return `Matchar mål: ${matchedGoal}`;
    }

    const matchedPreference = userPreferences.find((pref) => recommendationText.includes(pref.toLowerCase()));
    return matchedPreference ? `Matchar intresse: ${matchedPreference}` : null;
  };

  // Crisis detection - comprehensive Swedish/English keywords
  const detectCrisis = (text: string) => {
    const crisisKeywords = [
      // Swedish suicide/self-harm
      'självmord', 'suicide', 'självskada', 'self harm', 'dö', 'die',
      'sluta leva', 'vill inte leva', 'ta livet', 'ta mitt liv', 'ta sitt liv',
      'skada mig', 'hurt myself', 'skära mig', 'cut myself',

      // Swedish hopelessness
      'ingen mening', 'hopplös', 'värdelös', 'meningslös', 'poänglös',
      'värt att leva', 'not worth living', 'ge upp', 'give up',
      'trött på allt', 'trött på livet', 'vill försvinna',

      // English equivalents
      'suicide', 'kill myself', 'end it all', 'not worth living',
      'hopeless', 'worthless', 'give up', 'tired of living',

      // Crisis indicators
      'ingen utväg', 'no way out', 'fast i en cirkel', 'stuck in a loop',
      'vill bara sova', 'want to sleep forever'
    ];

    const lowerText = text.toLowerCase().trim();
    return crisisKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Load user progress from localStorage
  // Save user progress to localStorage
  // (Duplicate declaration removed)

  // Load user progress from localStorage
  const loadUserProgress = useCallback(() => {
    logger.debug('📊 LOAD USER PROGRESS called, user:', user?.user_id);
    if (user?.user_id) {
      const storageKey = `user_progress_${user.user_id}`;
      logger.debug('📊 Loading from localStorage key:', storageKey);
      const saved = localStorage.getItem(storageKey);
      logger.debug('📊 Raw localStorage data:', saved);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          logger.debug('📊 Parsed user progress:', parsed);
          setUserProgress(parsed);
        } catch (error) {
          logger.error('Failed to load user progress:', error);
        }
      } else {
        logger.debug('📊 No saved progress found in localStorage');
      }
    } else {
      logger.debug('📊 No user ID available for loading progress');
    }
  }, [user?.user_id]);

  // Load progress on mount
  useEffect(() => {
    loadUserProgress();
  }, [loadUserProgress]);

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

  // Debug: Check localStorage on mount
  useEffect(() => {
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

  const loadNotificationSettings = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const settings = await getNotificationSettings();
      setNotificationSettings({
        dailyRemindersEnabled: settings.dailyRemindersEnabled || false,
        reminderTime: settings.reminderTime || '09:00',
        fcmToken: settings.hasFcmToken || false
      });
    } catch (error) {
      logger.error('Failed to load notification settings:', error);
      // Keep default settings
    }
  }, [user]);

  // Load notification settings on mount
  useEffect(() => {
    loadNotificationSettings();
  }, [loadNotificationSettings]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Denna webbläsare stödjer inte push-notiser');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      alert('Du har blockerat notiser. Aktivera dem i webbläsarens inställningar för att använda denna funktion.');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  const enableDailyReminders = async () => {
    if (!user?.user_id) return;

    setIsEnablingNotifications(true);
    try {
      // Request browser notification permission
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        setIsEnablingNotifications(false);
        return;
      }

      // Attempt real FCM token registration via Firebase Messaging SDK (non-blocking)
      initializeMessaging().then(() => {
        setNotificationSettings(prev => ({ ...prev, fcmToken: true }));
      }).catch(err => {
        logger.warn('FCM token registration failed (non-fatal):', err);
      });

      // Enable daily reminders in backend regardless of FCM status
      await updateNotificationSettings({
        dailyRemindersEnabled: true,
        reminderTime: notificationSettings.reminderTime
      });

      setNotificationSettings(prev => ({ ...prev, dailyRemindersEnabled: true }));

      alert(`✅ Dagliga påminnelser aktiverade!\n\nDu kommer få en vänlig påminnelse varje dag kl. ${notificationSettings.reminderTime} att ta hand om din mentala hälsa.`);
      announceToScreenReader('Dagliga påminnelser har aktiverats', 'polite');

    } catch (error) {
      logger.error('Failed to enable daily reminders:', error);
      alert('Kunde inte aktivera dagliga påminnelser. Försök igen.');
    } finally {
      setIsEnablingNotifications(false);
    }
  };

  const disableDailyReminders = async () => {
    if (!user?.user_id) return;

    try {
      await updateNotificationSettings({
        dailyRemindersEnabled: false,
        reminderTime: notificationSettings.reminderTime
      });

      setNotificationSettings(prev => ({ ...prev, dailyRemindersEnabled: false }));
      alert('Dagliga påminnelser har inaktiverats.');
      announceToScreenReader('Dagliga påminnelser har inaktiverats', 'polite');

    } catch (error) {
      logger.error('Failed to disable daily reminders:', error);
      alert('Kunde inte inaktivera dagliga påminnelser. Försök igen.');
    }
  };

  const updateReminderTime = async (newTime: string) => {
    if (!user?.user_id) return;

    try {
      await updateNotificationSettings({
        dailyRemindersEnabled: notificationSettings.dailyRemindersEnabled,
        reminderTime: newTime
      });

      setNotificationSettings(prev => ({ ...prev, reminderTime: newTime }));
      announceToScreenReader(`Påminnelsetid uppdaterad till ${newTime} `, 'polite');

    } catch (error) {
      logger.error('Failed to update reminder time:', error);
      alert('Kunde inte uppdatera påminnelsetiden. Försök igen.');
    }
  };

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
            ? `${recommendation.title} sparad till dina favoriter`
            : `${recommendation.title} borttagen från favoriter`,
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
              announceToScreenReader('Rekommendation delad framgångsrikt', 'polite');
            })
            .catch((error) => {
              logger.debug('Share cancelled or failed:', error);
            });
        } else {
          // Fallback to clipboard
          navigator.clipboard.writeText(`${shareData.title} \n${shareData.text} \n${shareData.url} `)
            .then(() => {
              logger.debug('✅ Copied to clipboard:', recommendation.title);
              announceToScreenReader('Länk kopierad till urklipp', 'polite');
            })
            .catch((error) => {
              logger.error('Failed to copy to clipboard:', error);
              announceToScreenReader('Kunde inte kopiera länk', 'assertive');
            });
        }
        break;
      }
      case 'feedback':
        // Simple feedback - could be expanded to a proper feedback system
        announceToScreenReader('Tack för din feedback!', 'polite');
        break;
    }

    announceToScreenReader(`Action ${action} performed on ${recommendation.title} `, 'polite');
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
      announceToScreenReader('Tack för din positiva feedback!', 'polite');
      return;
    }

    logger.debug('👎 Negative feedback for:', recommendation.title);
    announceToScreenReader('Tack för din feedback, vi förbättrar våra rekommendationer!', 'polite');
  };

  // Quick start a recommendation directly without opening modal
  const quickStartRecommendation = (recommendation: Recommendation) => {
    logger.debug(`🚀 Quick start: ${recommendation.title}`);
    
    // For meditation types, start immediately
    if (recommendation.type === 'meditation') {
      // Set the recommendation and start immediately
      setSelectedRecommendation(recommendation);
      setShowContentModal(true);
      
    }
    
    analytics.track('Quick Start', {
      recommendationId: recommendation.id,
      type: recommendation.type,
    });
  };


  const handleCloseContentModal = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    if (isPomodoroActive) {
      stopPomodoroTimer();
    }
    if (articleReadingTimerRef.current) {
      clearInterval(articleReadingTimerRef.current);
      articleReadingTimerRef.current = null;
    }
    setBreathingStressBefore(null);
    setBreathingStressAfter(null);

    setShowContentModal(false);
    setSelectedRecommendation(null);
  }, [
    isPomodoroActive,
    stopPomodoroTimer,
  ]);

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
        return 'Visa meditation';
      case 'exercise':
        return 'Visa övning';
      case 'article':
        return 'Visa artikel';
      case 'challenge':
        return 'Visa utmaning';
      case 'insight':
        return 'Visa insikt';
      default:
        return 'Visa rekommendation';
    }
  };

  // Compact mode for dashboard - just show featured recommendations
  // Compact mode for dashboard - just show featured recommendations
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Loading State - Compact */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            <div className="h-40 rounded-[2rem] bg-gray-100 dark:bg-gray-800" />
            <div className="h-40 rounded-[2rem] bg-gray-100 dark:bg-gray-800" />
          </div>
        )}

        {/* Error State - Compact */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[2rem] p-6 text-center">
            <p className="text-red-700 dark:text-red-300">Kunde inte ladda rekommendationer</p>
          </div>
        )}

        {/* Featured Recommendations - Compact */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div
                key={rec.id}
                className={`group relative overflow-hidden rounded-[2rem] p-6 transition-all duration-300 hover:scale-[1.02] border border-transparent ${
                  rec.category.includes('Stress')
                    ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/10'
                    : rec.category.includes('Sömn')
                      ? 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/10'
                      : 'bg-white hover:bg-gray-50 dark:bg-slate-800/50'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 text-6xl group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 pointer-events-none">
                  {rec.image}
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                      {rec.category}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {rec.duration} min
                    </span>
                  </div>

                  <h3 className="text-xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-2 leading-tight">
                    {rec.title}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2">
                    {rec.description}
                  </p>

                  {/* Status indicator */}
                  {(rec.completionRate !== undefined && rec.completionRate > 0 && rec.completionRate < 100) && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="font-medium">⏸️ Påbörjad - {rec.completionRate}%</span>
                    </div>
                  )}
                  {rec.completed && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium">✓ Klar idag</span>
                      {rec.streak && rec.streak > 1 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-1">🔥 {rec.streak} dagar</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (compact) {
                        navigate('/recommendations');
                      } else {
                        setSelectedRecommendation(rec);
                      }
                    }}
                    className="flex items-center gap-2 font-medium text-primary-600 dark:text-primary-400 hover:underline group-hover:translate-x-1 transition-transform"
                    aria-label={
                      compact
                        ? `${getCompactCtaLabel(rec.type)} i rekommendationer`
                        : rec.type === 'meditation'
                          ? 'Starta passet'
                          : 'Läs mer'
                    }
                  >
                    {compact
                      ? (rec.completionRate !== undefined && rec.completionRate > 0 && rec.completionRate < 100)
                        ? 'Fortsätt övningen →'
                        : rec.completed
                          ? 'Gör igen →'
                          : rec.type === 'meditation'
                            ? `Gör övningen (${rec.duration || 5} min) →`
                            : rec.type === 'exercise'
                              ? `Starta övningen (${rec.duration || 10} min) →`
                              : rec.type === 'article'
                                ? `Läs artikeln (${rec.duration || 3} min) →`
                                : 'Utforska →'
                      : rec.type === 'meditation'
                        ? 'Starta passet'
                        : 'Läs mer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State - Compact */}
        {!loading && !error && recommendations.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-500 dark:text-gray-400">
              Inga rekommendationer just nu.
            </p>
          </div>
        )}
      </div>
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
    ? 'Reflektera i dagboken'
    : 'Gå till nästa övning';
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
        {showDebugTools && debugMode && (
          <div className="mt-4 p-4 bg-black/20 rounded-lg text-xs font-mono">
            <h4 className="font-bold mb-2">🐛 Debug Info:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>User ID: {user?.user_id || 'null'}</div>
              <div>Goals: {JSON.stringify(fetchedWellnessGoals)}</div>
              <div>Progress: {JSON.stringify(userProgress)}</div>
              <div>Filters: {searchTerm}|{selectedCategory}|{sortBy}</div>
            </div>
          </div>
        )}
      </div>

      {/* CBT Backend Integration Overview */}
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
        {/* Disclaimer at top */}
        <div className="mb-4 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-300">
          <strong>⚠️ Viktigt:</strong> Dessa KBT-övningar är ett komplement till — inte en ersättning för — professionell psykoterapi. Söker du vård, kontakta legitimerad psykolog eller psykoterapeut. Kris: 112 | Självmordslinjen: 0900-011 200 | 1177
        </div>

        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">KBT-moduler (Kognitiv Beteendeterapi)</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Evidensbaserade övningar anpassade till din nuvarande situation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cbtLoading && <span className="text-sm text-blue-600 dark:text-blue-300">Laddar...</span>}
            <select
              value={cbtCurrentMood}
              onChange={(e) => setCbtCurrentMood(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1 focus:ring-2 focus:ring-primary-500"
              aria-label="Välj ditt nuvarande mående"
            >
              <option value="neutral">Neutralt mående</option>
              <option value="high_anxiety">Hög ångest</option>
              <option value="low_mood">Nedstämd</option>
              <option value="depression">Depression</option>
              <option value="stress">Stress</option>
              <option value="good">Mår bra</option>
            </select>
          </div>
        </div>

        {cbtError && (
          <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 text-sm">
            {cbtError}
          </div>
        )}

        {/* Progress stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Moduler</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{cbtModules.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Övningar gjorda</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{cbtInsights?.exercisesCompleted ?? 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Dagstreak</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{cbtInsights?.streak.current ?? 0} 🔥</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total progress</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{Math.round((cbtInsights?.overallProgress ?? 0) * 100)}%</p>
          </div>
        </div>

        {/* Personalized session guidance */}
        {cbtSession && (
          <div className="mb-5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-1">🎯 Rekommenderad session för dig just nu</p>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">{cbtSession.guidance}</p>
            {cbtSession.motivationalElements.length > 0 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 italic">{cbtSession.motivationalElements[0]}</p>
            )}
          </div>
        )}

        {/* Module list with exercises */}
        <div className="space-y-4">
          {cbtModules.map((module) => {
            const moduleExercises = cbtExercises.filter(ex => ex.moduleId === module.moduleId);
            const diffBadge = module.difficultyLevel === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              module.difficultyLevel === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            return (
              <div key={module.moduleId} className={`rounded-lg border p-4 ${module.isLocked ? 'border-gray-200 dark:border-gray-700 opacity-60' : module.isCompleted ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{module.title}</h3>
                      {module.isCompleted && <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">✅ Klar</span>}
                      {module.isLocked && <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">🔒 Kräver förkunskaper</span>}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{module.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffBadge}`}>{module.difficultyLevel}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{module.estimatedDuration} min</span>
                  </div>
                </div>
                {moduleExercises.length > 0 && !module.isLocked && (
                  <div className="space-y-2 mt-3">
                    {moduleExercises.map((ex) => (
                      <div key={ex.exerciseId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ex.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{ex.type.replace(/_/g, ' ')} • {ex.duration} min</p>
                        </div>
                        {ex.exerciseId === 'thought_record_basic' ? (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">↓ Se KBT-övning nedan</span>
                        ) : (
                          <button
                            onClick={() => startCbtExercise(ex.exerciseId)}
                            disabled={activeCbtExerciseId !== null}
                            className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                          >
                            {activeCbtExerciseId === ex.exerciseId ? 'Pågår...' : 'Starta'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {module.isLocked && module.prerequisites.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Slutför först: {module.prerequisites.join(', ')}
                  </p>
                )}
              </div>
            );
          })}
          {!cbtLoading && cbtModules.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Moduler kräver premium-prenumeration.</p>
          )}
        </div>

        {/* Behavioral Activation interactive exercise */}
        {activeCbtExerciseId === 'behavioral_activation' && (
          <div className="mt-6 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">🌱 Beteendeaktivering</h3>
              <button onClick={() => setActiveCbtExerciseId(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">Avbryt</button>
            </div>
            <div className="mb-3 flex gap-1">
              {[1,2,3,4].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${baStep >= s ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
              ))}
            </div>

            {baStep === 1 && (
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Steg 1 av 4 — Identifiera aktiviteter</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Skriv ner 2–3 aktiviteter du brukade gilla eller som gav dig en känsla av prestation, glädje eller lugn — även om du inte känt för dem på länge.
                </p>
                <textarea
                  value={baActivities}
                  onChange={(e) => setBaActivities(e.target.value)}
                  placeholder="T.ex. promenera i parken, laga mat, ringa en vän, läsa, lyssna på musik..."
                  className="w-full p-3 min-h-[100px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <button
                  onClick={() => baActivities.trim().length >= 10 ? setBaStep(2) : announceToScreenReader('Skriv minst en aktivitet', 'assertive')}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                >Nästa →</button>
              </div>
            )}

            {baStep === 2 && (
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Steg 2 av 4 — Välj en aktivitet</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Välj EN aktivitet att fokusera på. Vad kan hindra dig från att göra den? Skriv ner dina tankar och hinder.
                </p>
                <input
                  value={baSelectedActivity}
                  onChange={(e) => setBaSelectedActivity(e.target.value)}
                  placeholder="Vilken aktivitet väljer du?"
                  className="w-full p-3 mb-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400"
                />
                <textarea
                  value={baBarriers}
                  onChange={(e) => setBaBarriers(e.target.value)}
                  placeholder="Vad hindrar dig? T.ex. 'Jag känner inte för det', 'Det tar för lång tid', 'Ingen mening'..."
                  className="w-full p-3 min-h-[80px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setBaStep(1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">← Tillbaka</button>
                  <button
                    onClick={() => baSelectedActivity.trim().length >= 3 ? setBaStep(3) : announceToScreenReader('Välj en aktivitet', 'assertive')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                  >Nästa →</button>
                </div>
              </div>
            )}

            {baStep === 3 && (
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Steg 3 av 4 — Planera konkret</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Planera aktiviteten specifikt: NÄR? VAR? HUR länge? Konkreta planer ökar sannolikheten att du faktiskt gör det.
                </p>
                <textarea
                  value={baPlan}
                  onChange={(e) => setBaPlan(e.target.value)}
                  placeholder={`Jag ska ${baSelectedActivity || 'aktiviteten'} på [dag] kl [tid] på [plats] i [X] minuter.`}
                  className="w-full p-3 min-h-[100px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setBaStep(2)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">← Tillbaka</button>
                  <button
                    onClick={() => baPlan.trim().length >= 15 ? setBaStep(4) : announceToScreenReader('Beskriv planen med minst 15 tecken', 'assertive')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                  >Nästa →</button>
                </div>
              </div>
            )}

            {baStep === 4 && (
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Steg 4 av 4 — Förväntan och reflektion</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Hur nöjd tror du att du kommer att vara efter aktiviteten? (Kom ihåg: Vår förväntan är ofta lägre än verkligheten vid depression.)
                </p>
                <div className="mb-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Förväntad nöjdhet (1 = låg, 10 = hög)</p>
                  <div className="flex gap-1 flex-wrap">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => setBaPleasureRating(n)}
                        className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${baPleasureRating === n ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={baReflection}
                  onChange={(e) => setBaReflection(e.target.value)}
                  placeholder="Vad hindrade dig eller vad lärde du dig av att planera denna aktivitet?"
                  className="w-full p-3 min-h-[80px] rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setBaStep(3)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">← Tillbaka</button>
                  <button
                    onClick={() => {
                      if (!baPleasureRating) { announceToScreenReader('Välj en förväntad nöjdhet', 'assertive'); return; }
                      completeCbtExercise('behavioral_activation', 2);
                      setBaStep(0);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
                  >✅ Spara övning</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Worry Time interactive exercise */}
        {activeCbtExerciseId === 'worry_time' && (
          <div className="mt-6 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200">⏰ Bekymmelsetid</h3>
              <button onClick={() => setActiveCbtExerciseId(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">Avbryt</button>
            </div>
            <div className="mb-3 flex gap-1">
              {[1,2,3,4].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${wtStep >= s ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
              ))}
            </div>

            {wtStep === 1 && (
              <div>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">Steg 1 av 4 — Skriv ner dina bekymmer</p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                  Skriv ner alla bekymmer som dyker upp just nu. Att externalisera dem minskar deras känslomässiga laddning.
                </p>
                <textarea
                  value={wtWorries}
                  onChange={(e) => setWtWorries(e.target.value)}
                  placeholder="T.ex. 'Jag är orolig för ekonomin', 'Jag vet inte om jobbet går bra', 'Familjen mår inte bra'..."
                  className="w-full p-3 min-h-[110px] rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-400 resize-none"
                />
                <button
                  onClick={() => wtWorries.trim().length >= 10 ? setWtStep(2) : announceToScreenReader('Skriv minst ett bekymmer', 'assertive')}
                  className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                >Nästa →</button>
              </div>
            )}

            {wtStep === 2 && (
              <div>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">Steg 2 av 4 — Schemalägg din bekymmelsetid</p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                  Välj en fast tid (20 min) varje dag att tillåta dig att bekymra dig. Utanför denna tid skjuter du upp bekymren.
                  Forskning (Borkovec et al.) visar att detta minskar spontan oro med 30–50%.
                </p>
                <input
                  value={wtScheduledTime}
                  onChange={(e) => setWtScheduledTime(e.target.value)}
                  placeholder="T.ex. kl 18:00 varje kväll i vardagsrummet"
                  className="w-full p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-400"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setWtStep(1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">← Tillbaka</button>
                  <button
                    onClick={() => wtScheduledTime.trim().length >= 3 ? setWtStep(3) : announceToScreenReader('Ange en tid', 'assertive')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                  >Nästa →</button>
                </div>
              </div>
            )}

            {wtStep === 3 && (
              <div>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">Steg 3 av 4 — Övning i uppskjutning</p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                  När ett bekymmer dyker upp utanför {wtScheduledTime || 'din bekymmelsetid'}, påminn dig: "Det tar jag upp kl {wtScheduledTime || '[tid]'}."
                  Bekymret är noterat — du behöver inte tänka på det nu.
                </p>
                <div className="p-3 bg-purple-100 dark:bg-purple-800/30 rounded-lg mb-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wtPostponeCommitted}
                      onChange={(e) => setWtPostponeCommitted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400"
                    />
                    <span className="text-sm text-purple-800 dark:text-purple-200">
                      Jag förbinder mig att skjuta upp bekymmer till min schemalagda tid ({wtScheduledTime || '...'}) och påminna mig att de redan är noterade.
                    </span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWtStep(2)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">← Tillbaka</button>
                  <button
                    onClick={() => wtPostponeCommitted ? setWtStep(4) : announceToScreenReader('Bocka i rutan för att fortsätta', 'assertive')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                  >Nästa →</button>
                </div>
              </div>
            )}

            {wtStep === 4 && (
              <div>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">Steg 4 av 4 — Reflektion</p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                  Har du provat att hålla din bekymmelsetid? Vilka bekymmer löste sig av sig självt?
                  Ofta inser vi att de flesta bekymmer antingen inte inträffar eller löser sig utan aktiv insats.
                </p>
                <textarea
                  value={wtReflection}
                  onChange={(e) => setWtReflection(e.target.value)}
                  placeholder="Vad lärde du dig? Vilka bekymmer försvann? Hur kändes det att skjuta upp dem?"
                  className="w-full p-3 min-h-[90px] rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-400 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setWtStep(3)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">← Tillbaka</button>
                  <button
                    onClick={() => {
                      if (wtReflection.trim().length < 10) { announceToScreenReader('Skriv en kort reflektion', 'assertive'); return; }
                      completeCbtExercise('worry_time', 3);
                      setWtStep(0);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
                  >✅ Spara övning</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Insights footer */}
        {cbtInsights && cbtInsights.recommendedNextSteps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">💡 Rekommenderade nästa steg:</p>
            <ul className="space-y-1">
              {cbtInsights.recommendedNextSteps.map((step, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400">• {step}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
            <option value="all">Alla Kategorier</option>
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
            <option value="rating">Sortera efter Betyg</option>
            <option value="duration">Sortera efter Längd</option>
            <option value="difficulty">Sortera efter Svårighetsgrad</option>
          </select>
        </div>

        {/* Results Count and Reset */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            Visar {filteredRecommendations.length} av {recommendations.length} rekommendationer
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
              Återställ filter
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchTerm.trim() && (
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                Sökning: {searchTerm.trim()}
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                Kategori: {selectedCategory}
              </span>
            )}
            {sortBy !== 'rating' && (
              <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                Sortering: {sortLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Featured Recommendations */}
      {!loading && !error && recommendations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            🌟 Rekommenderat för Dig
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
                    {recommendation.type === 'meditation' ? 'Starta' :
                      recommendation.type === 'exercise' ? 'Börja' :
                        recommendation.type === 'article' ? 'Läs' :
                          recommendation.type === 'challenge' ? 'Påbörja' : 'Utforska'}
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
          Dina Intressen & Wellness-mål
        </h3>

        {/* Wellness Goals Display */}
        {fetchedWellnessGoals.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aktuella mål:</p>
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
          Vi anpassar rekommendationer baserat på dina intressen, aktivitet och wellness-mål
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Laddar personliga rekommendationer...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <div className="text-red-600 dark:text-red-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Ett fel uppstod</h3>
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
            Inga rekommendationer hittades
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Prova att ändra dina söktermer eller filter
          </p>
        </div>
      )}

      {/* All Recommendations Section */}
      {!loading && !error && filteredRecommendations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Alla Rekommendationer 📚
            </h2>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filteredRecommendations.length} resultat
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {filteredRecommendations.map((recommendation) => {
              return (
              <div
                key={recommendation.id}
                className={`relative rounded-lg border p-4 sm:p-6 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-700 transition-all duration-300 group overflow-hidden ${getCategoryColor(recommendation.category)}`}
              >
                {/* Recommended for badge */}
                {recommendation.primaryGoal && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-xs px-3 py-1.5 text-center font-medium">
                    ✨ Rekommenderas för {recommendation.primaryGoal}
                  </div>
                )}

                {/* Header */}
                <div className={`flex items-start justify-between mb-4 ${recommendation.primaryGoal ? 'mt-6' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl sm:text-3xl">
                      {recommendation.image || getTypeIcon(recommendation.type)}
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 mb-1">
                        {recommendation.category}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {recommendation.type}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRecommendationAction(recommendation, 'save')}
                      className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${recommendation.saved
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : 'text-gray-400 dark:text-gray-500'
                        }`}
                      aria-label="Save recommendation"
                    >
                      {recommendation.saved ? (
                        <BookmarkIconSolid className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <BookmarkIcon className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRecommendationAction(recommendation, 'share')}
                      className="p-2 rounded-lg text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      aria-label="Share recommendation"
                    >
                      <ShareIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  {/* Progress bar for completion rate */}
                  {(recommendation.completionRate !== undefined && recommendation.completionRate > 0 && recommendation.completionRate < 100) && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-primary-600 dark:text-primary-400 font-medium">
                          ⏳ Påbörjad - {recommendation.completionRate}% klart
                        </span>
                        <span className="text-gray-400">
                          {recommendation.lastAccessedAt && `Senast: ${new Date(recommendation.lastAccessedAt).toLocaleDateString('sv-SE')}`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
                          style={{ width: `${recommendation.completionRate}%` }}
                        />
                      </div>
                      <button
                        onClick={() => handleRecommendationAction(recommendation, 'start')}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline font-medium"
                      >
                        Fortsätt där du slutade →
                      </button>
                    </div>
                  )}

                  {/* Completion status badge */}
                  {recommendation.completed && (
                    <div className="flex items-center gap-1.5 mb-2 text-emerald-600 dark:text-emerald-400">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium">Klar idag ✓</span>
                      {recommendation.streak && recommendation.streak > 1 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                          🔥 {recommendation.streak} dagar i rad
                        </span>
                      )}
                    </div>
                  )}

                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {recommendation.title}
                  </h3>
                  {getRecommendationMatchReason(recommendation) && (
                    <p className="inline-flex items-center mb-2 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {getRecommendationMatchReason(recommendation)}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                    {recommendation.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {recommendation.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs sm:text-sm mb-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(recommendation.difficulty) === 'success'
                          ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                          : getDifficultyColor(recommendation.difficulty) === 'warning'
                            ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                            : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300'
                          } `}
                      >
                        {recommendation.difficulty}
                      </span>
                      {recommendation.duration && (
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {recommendation.duration} min
                        </span>
                      )}
                    </div>

                    {recommendation.rating && (
                      <div className="flex items-center gap-1">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <StarIcon
                              key={star}
                              className={`w-3 h-3 sm:w-4 sm:h-4 ${star <= (recommendation.rating || 0)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300 dark:text-gray-600'
                                } `}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                          ({recommendation.rating})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="relative">
                  <button
                    onClick={() => handleRecommendationAction(recommendation, 'start')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all duration-200 group-hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
                  >
                    <PlayIcon className="w-5 h-5" aria-hidden="true" />
                    <span>
                      {recommendation.completionRate && recommendation.completionRate > 0 && recommendation.completionRate < 100
                        ? 'Fortsätt övningen →'
                        : recommendation.type === 'meditation'
                          ? `Gör övningen nu (${recommendation.duration || 5} min) →`
                          : recommendation.type === 'exercise'
                            ? 'Starta träningen nu →'
                            : recommendation.type === 'article'
                              ? 'Läs artikeln (3 min) →'
                              : recommendation.type === 'challenge'
                                ? 'Påbörja utmaningen →'
                                : 'Utforska nu →'}
                    </span>
                  </button>

                  {/* Quick start button (appears on hover) */}
                  {recommendation.type === 'meditation' && (
                    <button
                      onClick={() => quickStartRecommendation(recommendation)}
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full p-2 hover:scale-110 z-10"
                      title="Starta direkt"
                      aria-label="Starta övning direkt"
                    >
                      <span className="text-lg">▶️</span>
                    </button>
                  )}
                </div>

                {/* Social proof - people doing this now */}
                {recommendation.peopleDoingThisNow && recommendation.peopleDoingThisNow > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2 flex items-center justify-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    🔥 {recommendation.peopleDoingThisNow} personer gör detta just nu
                  </p>
                )}

                {/* Social proof - users who completed today */}
                {recommendation.dailyCompletions && recommendation.dailyCompletions > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                    {recommendation.dailyCompletions.toLocaleString('sv-SE')} personer har gjort detta idag
                  </p>
                )}

                {/* Bottom progress bar (visual only) */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                    style={{ width: `${recommendation.completionRate || (recommendation.completed ? 100 : 0)}%` }}
                  />
                </div>

                {/* Feedback */}
                <div className="flex justify-center gap-2 mt-3">
                  {(() => {
                    const selectedFeedback = feedbackByRecommendation[recommendation.id];
                    return (
                      <>
                  <button
                    onClick={() => handleRecommendationFeedback(recommendation, 'helpful')}
                    aria-pressed={selectedFeedback === 'helpful'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2 ${selectedFeedback === 'helpful'
                      ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                      : 'text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20'
                      }`}
                  >
                    <HandThumbUpIcon className="w-4 h-4" aria-hidden="true" />
                    <span>{selectedFeedback === 'helpful' ? 'Tack för svar' : 'Hjälpsam'}</span>
                  </button>
                  <button
                    onClick={() => handleRecommendationFeedback(recommendation, 'not_relevant')}
                    aria-pressed={selectedFeedback === 'not_relevant'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 ${selectedFeedback === 'not_relevant'
                      ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300'
                      : 'text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20'
                      }`}
                  >
                    <HandThumbDownIcon className="w-4 h-4" aria-hidden="true" />
                    <span>{selectedFeedback === 'not_relevant' ? 'Markerad' : 'Inte relevant'}</span>
                  </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
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
                  aria-label="Stäng"
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
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    🧠 Neurovetenskap: Så Fungerar Fokus
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    Förstå hjärnans koncentrationsmekanismer och lär dig vetenskapligt beprövade strategier för bättre fokus.
                  </p>

                  {/* Reading Progress */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>Läsningsframsteg</span>
                      <span>{articleProgress}% • {formatReadingTime(readingTime)} läst</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${articleProgress}% ` }}
                      />
                    </div>
                  </div>

                  {/* Article Content */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {neuroscienceArticleSections[currentSection]?.title}
                      </h4>

                      <div
                        className="text-gray-700 dark:text-gray-300 leading-relaxed [&_.highlight-box]:bg-blue-50 [&_.highlight-box]:dark:bg-blue-900/20 [&_.highlight-box]:border-l-4 [&_.highlight-box]:border-l-blue-500 [&_.highlight-box]:p-4 [&_.highlight-box]:my-4 [&_.highlight-box]:rounded-r-lg"
                        dangerouslySetInnerHTML={{ __html: neuroscienceArticleSections[currentSection]?.content || '' }}
                      />
                    </div>
                  </div>

                  {/* Section Navigation */}
                  <div className="flex justify-between items-center mb-6">
                    <button
                      onClick={() => {
                        const newSection = Math.max(0, currentSection - 1);
                        setCurrentSection(newSection);
                        updateArticleProgress(newSection, (newSection / neuroscienceArticleSections.length) * 100);
                      }}
                      disabled={currentSection === 0}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      ← Föregående
                    </button>

                    <div className="flex gap-1">
                      {neuroscienceArticleSections.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentSection(index);
                            updateArticleProgress(index, (index / neuroscienceArticleSections.length) * 100);
                          }}
                          className={`w-3 h-3 rounded-full transition-colors ${index === currentSection
                            ? 'bg-blue-500'
                            : index < currentSection
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                            } `}
                          aria-label={`Gå till sektion ${index + 1} `}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        if (currentSection < neuroscienceArticleSections.length - 1) {
                          const newSection = currentSection + 1;
                          setCurrentSection(newSection);
                          updateArticleProgress(newSection, (newSection / neuroscienceArticleSections.length) * 100);
                        } else {
                          completeArticle();
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      {currentSection < neuroscienceArticleSections.length - 1 ? 'Nästa →' : 'Slutför Artikel'}
                    </button>
                  </div>

                  {/* Quiz Section */}
                  {articleCompleted && !showQuiz && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                      <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                        🎉 Artikel Slutförd!
                      </h4>
                      <p className="text-green-700 dark:text-green-300 mb-4">
                        Bra jobbat! Du har läst artikeln om neurovetenskap och fokus.
                        Vill du testa dina kunskaper med ett kort quiz?
                      </p>
                      <button
                        onClick={() => setShowQuiz(true)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Ta Quizet
                      </button>
                    </div>
                  )}

                  {/* Quiz */}
                  {showQuiz && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        🧠 Kunskapstest: Neurovetenskap & Fokus
                      </h4>

                      {neuroscienceQuiz.map((question, qIndex) => (
                        <div key={qIndex} className="mb-6">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                            {qIndex + 1}. {question.question}
                          </h5>
                          <div className="space-y-2">
                            {question.options.map((option, oIndex) => (
                              <label key={oIndex} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`question-${qIndex}`}
                                  value={oIndex}
                                  checked={quizAnswers[qIndex] === oIndex}
                                  onChange={() => setQuizAnswers({ ...quizAnswers, [qIndex]: oIndex })}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-gray-700 dark:text-gray-300">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={submitQuiz}
                        disabled={Object.keys(quizAnswers).length < neuroscienceQuiz.length}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                      >
                        Skicka Svar
                      </button>
                    </div>
                  )}

                  {/* Quiz Results */}
                  {typeof quizScore === 'number' && quizScore >= 0 && (
                    <div className={`rounded-lg p-4 mb-6 ${quizScore >= 4
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : quizScore >= 2
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      }`}>
                      <h4 className={`text-lg font-semibold mb-2 ${quizScore >= 4
                        ? 'text-green-800 dark:text-green-200'
                        : quizScore >= 2
                          ? 'text-yellow-800 dark:text-yellow-200'
                          : 'text-red-800 dark:text-red-200'
                        }`}>
                        {quizScore >= 4 ? '🎉 Utmärkt förståelse!' :
                          quizScore >= 2 ? '📚 Bra grundkunskaper!' : '📖 Mer läsning rekommenderas'}
                      </h4>
                      <p className={`mb-4 ${quizScore >= 4
                        ? 'text-green-700 dark:text-green-300'
                        : quizScore >= 2
                          ? 'text-yellow-700 dark:text-yellow-300'
                          : 'text-red-700 dark:text-red-300'
                        }`}>
                        Du fick <strong>{quizScore} av {neuroscienceQuiz.length} rätt</strong>
                        {quizScore >= 4 && " - Du har utmärkt förståelse för neurovetenskapen bakom fokus!"}
                        {quizScore >= 2 && quizScore < 4 && " - Du har bra grundkunskaper. Fortsätt lära dig!"}
                        {quizScore < 2 && " - Läs gärna artikeln igen och fokusera på nyckelbegreppen."}
                      </p>

                      {/* Detailed Answer Review */}
                      <div className="space-y-3">
                        <h5 className="font-semibold text-gray-900 dark:text-white">📋 Svarsgenomgång:</h5>
                        {neuroscienceQuiz.map((question, index) => {
                          const userAnswer = quizAnswers[index];
                          const isCorrect = userAnswer === question.correct;
                          return (
                            <div key={question.question} className={`p-3 rounded-lg ${isCorrect
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                              }`}>
                              <div className="flex items-start gap-3">
                                <span className={`text-lg ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                  {isCorrect ? '✅' : '❌'}
                                </span>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white mb-1">
                                    Fråga {index + 1}: {question.question}
                                  </p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    <strong>Ditt svar:</strong> {userAnswer !== undefined ? question.options[userAnswer] : 'Inget svar'}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <strong>Förklaring:</strong> {question.explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Learning Tips */}
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h6 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Inlärningstips:</h6>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                          <li>• Fokusera på en uppgift åt gången för bättre inlärning</li>
                          <li>• Ta regelbundna pauser för att bearbeta information</li>
                          <li>• Applicera kunskapen praktiskt för bättre retention</li>
                          <li>• Återkom till artikeln när du behöver repetition</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Control Buttons */}
                  <div className="flex justify-center gap-3">
                    {!articleCompleted ? (
                      <button
                        onClick={startArticleReading}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                      >
                        🚀 Börja Läsa
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseContentModal}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                      >
                        🎉 Stäng
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Interactive Pomodoro Timer */}
              {selectedRecommendation.id === 'focus-1' && (
                <div className="bg-gradient-to-br from-red-50 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-6 mb-4 border-2 border-red-200 dark:border-red-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    🍅 Pomodoro-teknik för Bättre Fokus
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    Strukturerad arbetsmetod: 25 minuter fokuserat arbete följt av 5 minuters paus för maximal produktivitet.
                  </p>

                  {/* Settings Panel */}
                  {!isPomodoroActive && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          ⚙️ Anpassa Inställningar
                        </h4>
                        <button
                          onClick={() => setPomodoroSettingsOpen(!pomodoroSettingsOpen)}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {pomodoroSettingsOpen ? 'Dölj' : 'Visa'}
                        </button>
                      </div>

                      {pomodoroSettingsOpen && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Arbete (min)
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
                                Paus (min)
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
                              Antal Sessioner
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
                            {pomodoroPhase === 'work' ? 'Arbete' : pomodoroPhase === 'break' ? 'Paus' : 'Slutfört'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-500">
                            Session {pomodoroSession} av {totalPomodoroSessions}
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
                            ? `Fokuserat arbete - ${pomodoroWorkTime} min`
                            : pomodoroPhase === 'break'
                              ? `Välförtjänt paus - ${pomodoroBreakTime} min`
                              : 'Alla sessioner slutförda!'}
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
                        📊 Senaste Sessioner
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {pomodoroHistory.slice(0, 5).map((session) => (
                          <div key={session.date} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {session.type === 'work' ? '🍅' : '☕'} Session {session.sessionNumber}
                            </span>
                            <span className="text-gray-500 dark:text-gray-500">
                              {session.workDuration || session.breakDuration}min • {new Date(session.date).toLocaleTimeString()}
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
                        🚀 Starta Pomodoro
                      </button>
                    ) : pomodoroPhase !== 'completed' ? (
                      <button
                        onClick={stopPomodoroTimer}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        ⏹️ Stoppa
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseContentModal}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                      >
                        🎉 Stäng
                      </button>
                    )}
                  </div>

                  {/* Completion Message */}
                  {pomodoroPhase === 'completed' && (
                    <div className="text-center mt-6">
                      <div className="text-6xl mb-4">🎉</div>
                      <h4 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                        Grattis! Alla Pomodoro-sessioner slutförda!
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        Du har framgångsrikt genomfört {totalPomodoroSessions} fokuserade arbetssessioner.
                        Detta är ett viktigt steg mot bättre produktivitet och fokus!
                      </p>
                    </div>
                  )}

                  {/* Article Completion Message */}
                  {articleCompleted && !showQuiz && (
                    <div className="text-center mt-6">
                      <div className="text-6xl mb-4">🧠</div>
                      <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                        Artikeln Slutförd!
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        Du har läst artikeln om neurovetenskap och fokus på {formatReadingTime(readingTime)}.
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>🧠 Kunskap ger kraft:</strong> Genom att förstå hur din hjärna fungerar
                          kan du bättre optimera dina fokus-strategier och förbättra din produktivitet.
                        </p>
                      </div>
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
                    🙏 7-Dagars Tacksamhetsutmaning
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    Utveckla en mer positiv syn genom att skriva ner tre saker du är tacksam för varje dag.
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
                          Dag {gratitudeDay}: {getGratitudePrompts(gratitudeDay)}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Skriv ner minst 3 saker du är tacksam för idag
                        </p>
                      </div>

                      {/* Gratitude Input */}
                      <div className="space-y-3">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="relative">
                            <input
                              type="text"
                              placeholder={`Tacksam sak ${index + 1}...`}
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
                            Dina tidigare dagar:
                          </h5>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {Object.entries(gratitudeEntries)
                              .filter(([day]) => parseInt(day) < gratitudeDay)
                              .sort(([a], [b]) => parseInt(b) - parseInt(a))
                              .slice(0, 3)
                              .map(([day, entries]) => (
                                <div key={day} className="text-sm">
                                  <span className="font-medium text-orange-600 dark:text-orange-400">
                                    Dag {day}:
                                  </span>
                                  <ul className="ml-4 mt-1 space-y-1">
                                    {entries.slice(0, 2).map((entry, i) => (
                                      <li key={i} className="text-gray-600 dark:text-gray-400">
                                        • {entry}
                                      </li>
                                    ))}
                                    {entries.length > 2 && (
                                      <li className="text-gray-500 dark:text-gray-500 text-xs">
                                        +{entries.length - 2} till
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
                          💡 <strong>Kom ihåg:</strong> Tacksamhet förändrar hur vi ser på världen.
                          Även små saker kan göra stor skillnad!
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
                        🚀 Starta Utmaningen
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
                              announceToScreenReader('Skriv minst 3 saker du är tacksam för', 'assertive');
                            }
                          }}
                          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                          disabled={(gratitudeEntries[gratitudeDay] || []).filter(e => e.trim()).length < 3 || isSavingGratitude}
                        >
                          {isSavingGratitude ? '💾 Sparar...' :
                            (gratitudeEntries[gratitudeDay] && gratitudeEntries[gratitudeDay].filter(e => e.trim()).length >= 3) ?
                              `✅ Dag ${gratitudeDay} Slutförd` :
                              (gratitudeDay < 7 ? `Spara Dag ${gratitudeDay} →` : '🎉 Slutför Utmaningen')}
                        </button>
                        <button
                          onClick={cancelGratitudeLogic}
                          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                        >
                          ⏹️ Avbryt
                        </button>
                      </>
                    )}
                  </div>

                  {/* Challenge Complete Celebration */}
                  {gratitudeDay > 7 && (
                    <div className="text-center mt-6">
                      <div className="text-6xl mb-4">🎉</div>
                      <h4 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                        Grattis! Utmaningen är slutförd! 🌟
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        Du har framgångsrikt genomfört 7 dagar av tacksamhetspraxis.
                        Detta är ett viktigt steg mot bättre mental hälsa!
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
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Instruktioner</h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {selectedRecommendation.content}
                </p>
              </div>

              {/* Tags */}
              {selectedRecommendation.tags.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Relaterade Ämnen</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecommendation.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSearchTerm(tag);
                          announceToScreenReader(`Filter aktiverat för ${tag}`, 'polite');
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
                          announceToScreenReader('Öppnar dagboken för reflektion.', 'polite');
                          return;
                        }

                        const currentIndex = recommendations.findIndex(rec => rec.id === selectedRecommendation.id);
                        const nextRecommendation = currentIndex >= 0 ? recommendations[currentIndex + 1] : null;

                        if (nextRecommendation) {
                          setSelectedRecommendation(nextRecommendation);
                          announceToScreenReader(`Nästa övning: ${nextRecommendation.title}`, 'polite');
                        } else {
                          announceToScreenReader('Du har gått igenom alla rekommendationer i listan.', 'polite');
                        }
                        return;
                      }

                      if (!canManuallyCompleteSelectedRecommendation) {
                        announceToScreenReader('Slutför andningsövningen först för att markera aktiviteten som slutförd.', 'polite');
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
                          ? `${selectedRecommendation.title} var redan markerad som slutförd.`
                          : `${selectedRecommendation.title} markerad som slutförd`,
                        'polite'
                      );
                    } catch (error) {
                      logger.error('Failed to mark as completed:', error);
                      announceToScreenReader('Kunde inte markera som slutförd', 'assertive');
                    }
                  }}
                  className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors ${!isPrimaryActionDisabled
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {isSelectedRecommendationCompleted ? nextCompletedActionLabel : 'Markera som Slutförd'}
                </button>
                <button
                  onClick={handleCloseContentModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Stäng
                </button>
              </div>
              {isStressBreathingRecommendation && !canManuallyCompleteSelectedRecommendation && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Slutför {selectedBreathingCycles} cykler först. När texten visar "Andningsövning slutförd" kan du markera aktiviteten.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Crisis Alert Modal */}
      {showCrisisAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🚨</div>
              <h3 className="text-xl font-bold text-red-700 dark:text-red-300 mb-4">
                Vi är oroliga för din säkerhet
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-6 text-sm">
                Det låter som att du kan behöva omedelbar hjälp. Du är inte ensam,
                och det finns människor som vill hjälpa dig.
              </p>

              <div className="space-y-3 mb-6">
                <a
                  href="tel:112"
                  className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  🚨 Ring 112 (Akut)
                </a>
                <a
                  href="tel:0900011200"
                  className="block w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  📞 Självmordslinjen: 0900-011 200
                </a>
                <a
                  href="tel:1177"
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  🏥 Vårdguiden: 1177
                </a>
              </div>

              <p className="text-xs text-red-500 dark:text-red-400 mb-4">
                Om du är i omedelbar fara, ring 112 genast.
                Hjälplinjer är konfidentiella och tillgängliga dygnet runt.
              </p>

              <button
                onClick={() => setShowCrisisAlert(false)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm underline"
              >
                Fortsätt med övningen (rekommenderas inte)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Reminders Settings Modal */}
      {showNotificationSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Dagliga Påminnelser
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Få vänliga dagliga påminnelser att ta hand om din mentala hälsa
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {/* Current Status */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Status:
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${notificationSettings.dailyRemindersEnabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    } `}>
                    {notificationSettings.dailyRemindersEnabled ? 'Aktiverad' : 'Inaktiverad'}
                  </span>
                </div>

                {notificationSettings.dailyRemindersEnabled && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    📅 Tid: {notificationSettings.reminderTime}
                    {notificationSettings.fcmToken && ' • ✅ Notiser redo'}
                  </div>
                )}
              </div>

              {/* Time Setting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🕐 Påminnelsetid
                </label>
                <input
                  type="time"
                  value={notificationSettings.reminderTime}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, reminderTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Information */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  ℹ️ Vad händer när du aktiverar?
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Du får en vänlig påminnelse varje dag</li>
                  <li>• Påminnelsen innehåller motivation och tips</li>
                  <li>• Du kan ändra tiden eller stänga av när som helst</li>
                  <li>• All data hanteras säkert och konfidentiellt</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!notificationSettings.dailyRemindersEnabled ? (
                <button
                  onClick={enableDailyReminders}
                  disabled={isEnablingNotifications}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isEnablingNotifications ? '⏳ Aktiverar...' : '✅ Aktivera Dagliga Påminnelser'}
                </button>
              ) : (
                <button
                  onClick={disableDailyReminders}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  ❌ Inaktivera Påminnelser
                </button>
              )}

              <button
                onClick={() => setShowNotificationSettings(false)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Stäng
              </button>
            </div>

            {/* Save Time Button (only show if time changed and enabled) */}
            {notificationSettings.dailyRemindersEnabled && (
              <button
                onClick={() => updateReminderTime(notificationSettings.reminderTime)}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                💾 Spara Ny Tid
              </button>
            )}
          </div>
        </div>
      )}

      {/* Professional Disclaimer */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 dark:text-yellow-400 text-xl">⚠️</div>
          <div>
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              Viktig Information om Mental Hälsa
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
              Detta är ett stödverktyg, inte en ersättning för professionell vård.
              Om du upplever allvarliga mentala hälsoproblem, kontakta en kvalificerad vårdgivare.
            </p>
            <div className="text-xs text-yellow-600 dark:text-yellow-400">
              <p className="mb-1"><strong>🔹 Krisnummer Sverige:</strong> 112 (akut) eller 1177 (vårdguiden)</p>
              <p><strong>🔹 Självmordslinjen:</strong> 0900-011 200 (alla dagar 24/7)</p>
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
          Dagens Inspiration
        </h3>
        <p className="text-sm sm:text-base mb-4 sm:mb-6 opacity-90 max-w-2xl mx-auto">
          "Små, konsekventa steg kan skapa positiva förändringar över tid.
          En studie från University College London visar att det i genomsnitt tar 66 dagar att skapa nya vanor,
          med en stor variation mellan individer (18-254 dagar).
          Varje dag är en möjlighet att lära sig mer om mental hälsa."
        </p>
        <button
          onClick={() => setShowNotificationSettings(true)}
          className="px-6 py-2.5 border-2 border-white text-white font-medium rounded-lg hover:bg-white hover:text-purple-600 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-500 min-h-[44px]"
          title="Konfigurera dagliga påminnelser för mental hälsa"
        >
          🔔 {notificationSettings.dailyRemindersEnabled ? 'Hantera Dagliga Påminnelser' : 'Aktivera Dagliga Påminnelser'}
        </button>
      </div>

      {/* Progress Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
          Dina Framsteg Denna Vecka
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {userProgress?.exercisesCompleted ?? 0}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Övningar Gjorda
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Denna vecka
            </p>
          </div>

          <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
              {userProgress?.meditationMinutes ?? 0}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Minuter Meditation
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Denna vecka
            </p>
          </div>

          <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {userProgress?.articlesRead ?? 0}
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Artiklar Lästa
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Denna vecka
            </p>
          </div>

          <div className="text-center p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-400 mb-1">
              {userProgress?.weeklyGoalProgress ? Math.round(userProgress.weeklyGoalProgress) : 0}%
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Mål Uppnått
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Veckomål
            </p>
          </div>
        </div>
      </div>

      {/* Professional Footer - Additional Resources */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 sm:p-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ytterligare Stöd & Resurser 🏥
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Förutom våra interaktiva övningar finns det många professionella resurser tillgängliga
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Professional Help */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">👨‍⚕️</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Professionell Hjälp</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>• Psykolog eller psykoterapeut</li>
              <li>• Psykiatrisk vård vid behov</li>
              <li>• Krisintervention</li>
              <li>• KBT-terapi</li>
            </ul>
            <div className="mt-4 text-center">
              <a
                href="tel:1177"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Ring 1177
              </a>
            </div>
          </div>

          {/* Community Support */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🤝</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Gemenskap & Stöd</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>• Självhjälpsgrupper</li>
              <li>• Online-forum</li>
              <li>• Stödlinjer</li>
              <li>• Anhörigstöd</li>
            </ul>
            <div className="mt-4 text-center">
              <a
                href="tel:0900011200"
                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Självmordslinjen
              </a>
            </div>
          </div>

          {/* Self-Help Resources */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📚</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Självhjälp & Utbildning</h4>
            </div>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>• Böcker om mental hälsa</li>
              <li>• Online-kurser</li>
              <li>• Mindfulness-appar</li>
              <li>• Utbildningsmaterial</li>
            </ul>
            <div className="mt-4 text-center">
              <button
                onClick={() => window.open('https://www.1177.se', '_blank')}
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
            Redo att Ta Nästa Steg? 🌟
          </h4>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Fortsätt din resa mot bättre mental hälsa med våra dagliga utmaningar och meditationer
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Gå Till Dashboard
            </button>
            <button
              onClick={() => navigate('/wellness')}
              className="px-6 py-3 border border-primary-600 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium rounded-lg transition-colors"
            >
              Uppdatera Dina Mål
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

Recommendations.displayName = 'Recommendations';

export default Recommendations;



