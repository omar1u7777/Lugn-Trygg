import React, { useState, useEffect, useCallback, useRef } from 'react'
// Helper to format Pomodoro time as MM:SS
const formatPomodoroTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
import { useNavigate } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import useAuth from '../hooks/useAuth';
import { getWellnessGoals } from '../api/dashboard';
import { saveFCMToken, getNotificationSettings, updateNotificationSettings } from '../api/notifications';
import { saveMeditationSession, getMeditationSessions } from '../api/meditation';
import { updateCBTProgress } from '../api/cbt';
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
import { KBTPhaseName, Recommendation, RecommendationsProps } from '../types/recommendation';
import { RECOMMENDATIONS_POOL, muscleGroups, neuroscienceArticleSections, neuroscienceQuiz } from '../constants/recommendations';
import { getWellnessGoalIcon } from '../constants/wellnessGoals';
import { useBreathingExercise } from '../hooks/useBreathingExercise';
import { useKBTExercise } from '../hooks/useKBTExercise';
import { usePMR } from '../hooks/usePMR';
import { usePomodoro } from '../hooks/usePomodoro';
import { useGratitude } from '../hooks/useGratitude';
import { useJournaling } from '../hooks/useJournaling';
import { logger } from '../utils/logger';

const EMPTY_WELLNESS_GOALS: string[] = [];
type RecommendationFeedback = 'helpful' | 'not_relevant';

const KBT_GUIDED_PHASES: KBTPhaseName[] = ['identify', 'challenge', 'replace', 'practice'];
const KBT_TOTAL_STEPS = KBT_GUIDED_PHASES.length;
const KBT_MIN_NEGATIVE_LENGTH = 15;
const KBT_MIN_EVIDENCE_LENGTH = 30;
const KBT_MIN_ALTERNATIVE_LENGTH = 15;
const KBT_MIN_ACTION_PLAN_LENGTH = 10;
const KBT_MIN_OBSTACLE_PLAN_LENGTH = 12;
const KBT_MIN_REHEARSAL_CONTEXT_LENGTH = 8;
const KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH = 12;
const KBT_MIN_EXPERIMENT_MEASURE_LENGTH = 10;
const KBT_MIN_SOCRATIC_REFLECTION_LENGTH = 18;
const KBT_MIN_IF_THEN_PLAN_LENGTH = 18;
const KBT_MIN_COPING_CARD_LENGTH = 12;

type KbtDistortionInsight = {
  key: string;
  label: string;
  hint: string;
  reframeQuestion: string;
};

const KBT_DISTORTION_RULES: Array<KbtDistortionInsight & { pattern: RegExp }> = [
  {
    key: 'catastrophizing',
    label: 'Katastroftankande',
    hint: 'Tanken forutsager varsta mojliga utfall utan mellanlagescenarion.',
    reframeQuestion: 'Vad ar det mest sannolika utfallet, inte det varsta?',
    pattern: /(katastrof|helt forstort|allt kommer ga fel|det kommer ga at skogen|det blir en katastrof)/i,
  },
  {
    key: 'black_white',
    label: 'Svart-vitt tankande',
    hint: 'Tanken anvander ytterligheter som "alltid", "aldrig" eller "helt".',
    reframeQuestion: 'Vilket mer nyanserat mellanlage skulle kunna vara sant?',
    pattern: /(alltid|aldrig|helt|totalt|ingen|alla|maste lyckas)/i,
  },
  {
    key: 'mind_reading',
    label: 'Tankelasning',
    hint: 'Tanken antar vad andra tycker utan tydliga bevis.',
    reframeQuestion: 'Vilka faktiska bevis har du for vad andra tanker?',
    pattern: /(de tycker|alla tycker|ingen gillar mig|de kommer doma mig|de tycker jag ar)/i,
  },
  {
    key: 'self_labeling',
    label: 'Global sjalvetikett',
    hint: 'Ett misstag goras om till en generell etikett om dig som person.',
    reframeQuestion: 'Hur skulle du beskriva situationen utan att etikettera dig sjalv?',
    pattern: /(jag ar vardelos|jag ar dalig|jag duger inte|jag ar ett misslyckande)/i,
  },
];

const getKbtDistortionInsights = (negativeThought: string): KbtDistortionInsight[] => {
  const thought = negativeThought.trim();
  if (!thought) return [];

  const matches = KBT_DISTORTION_RULES.filter((rule) => rule.pattern.test(thought))
    .slice(0, 2)
    .map(({ pattern: _pattern, ...insight }) => insight);

  return matches;
};

const calculateKbtSessionQuality = (params: {
  beliefBefore: number | null;
  beliefAfter: number | null;
  negative: string;
  evidence: string;
  alternative: string;
  actionPlan: string;
  obstaclePlan: string;
  rehearsalContext: string;
  experimentHypothesis: string;
  experimentMeasure: string;
  socraticReflection: string;
  ifThenPlan: string;
  copingCard: string;
  executionConfidenceAfter: number | null;
}) => {
  const {
    beliefBefore,
    beliefAfter,
    negative,
    evidence,
    alternative,
    actionPlan,
    obstaclePlan,
    rehearsalContext,
    experimentHypothesis,
    experimentMeasure,
    socraticReflection,
    ifThenPlan,
    copingCard,
    executionConfidenceAfter,
  } = params;

  const shift = typeof beliefBefore === 'number' && typeof beliefAfter === 'number'
    ? beliefAfter - beliefBefore
    : 0;

  const shiftScore = Math.max(0, Math.min(25, (shift + 5) * 1.25));
  const writingChecks = [
    negative.trim().length >= KBT_MIN_NEGATIVE_LENGTH,
    evidence.trim().length >= KBT_MIN_EVIDENCE_LENGTH,
    alternative.trim().length >= KBT_MIN_ALTERNATIVE_LENGTH,
    actionPlan.trim().length >= KBT_MIN_ACTION_PLAN_LENGTH,
    obstaclePlan.trim().length >= KBT_MIN_OBSTACLE_PLAN_LENGTH,
    rehearsalContext.trim().length >= KBT_MIN_REHEARSAL_CONTEXT_LENGTH,
    experimentHypothesis.trim().length >= KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH,
    experimentMeasure.trim().length >= KBT_MIN_EXPERIMENT_MEASURE_LENGTH,
    socraticReflection.trim().length >= KBT_MIN_SOCRATIC_REFLECTION_LENGTH,
    ifThenPlan.trim().length >= KBT_MIN_IF_THEN_PLAN_LENGTH,
    copingCard.trim().length >= KBT_MIN_COPING_CARD_LENGTH,
    typeof executionConfidenceAfter === 'number',
  ];
  const writingScore = (writingChecks.filter(Boolean).length / writingChecks.length) * 40;
  const score = Math.round(Math.max(0, Math.min(100, 35 + shiftScore + writingScore)));

  let label = 'Stabil grund';
  if (score >= 80) label = 'Mycket stark genomforing';
  else if (score >= 60) label = 'Bra genomforing';

  return { score, label, shift };
};

const getKbtStepFromPhase = (phase: KBTPhaseName) => {
  const index = KBT_GUIDED_PHASES.indexOf(phase);
  return index >= 0 ? index + 1 : KBT_TOTAL_STEPS;
};

const getKbtAdaptiveFeedback = (before: number | null, after: number | null) => {
  if (typeof before !== 'number' || typeof after !== 'number') {
    return {
      title: 'Fortsatt reflektion',
      message: 'Du har gjort ett viktigt arbete. Fortsatt repetition av den balanserade tanken kan gora den mer tillganglig i vardagen.'
    };
  }

  const shift = after - before;
  if (shift >= 20) {
    return {
      title: 'Tydlig omstrukturering',
      message: 'Din nya tanke kanns betydligt mer trovardig nu. Det tyder pa att du har brutit ett automatiskt stresstolkningmonster.'
    };
  }
  if (shift >= 5) {
    return {
      title: 'Bra framsteg',
      message: 'Du ror dig i ratt riktning. Fortsatt ova pa den nya tanken i liknande situationer for att befasta effekten.'
    };
  }

  return {
    title: 'Stabilisering behovs',
    message: 'Forandring tar tid. Testa att konkretisera evidensen ytterligare och prova samma ovning igen i en lugn stund.'
  };
};

const getKbtStressFeedback = (before: number | null, after: number | null) => {
  if (typeof before !== 'number' || typeof after !== 'number') {
    return {
      title: 'Stressmätning saknas',
      message: 'Lagg till stressniva fore och efter nasta gang for att tydligare se effekten av ovningen.'
    };
  }

  const shift = after - before;
  if (shift <= -20) {
    return {
      title: 'Tydlig stressminskning',
      message: 'Din stressniva gick ner markant. Fortsatt med samma strategi i liknande situationer.'
    };
  }
  if (shift <= -5) {
    return {
      title: 'Bra stressreglering',
      message: 'Stressnivan minskade. Repetera ovrigt handlingssteg for att befasta effekten.'
    };
  }

  return {
    title: 'Stressen kvarstar delvis',
    message: 'Om stressen fortfarande ar hog, kombinera tanken med en kort andningspaus innan nasta steg.'
  };
};





// Helper function to format seconds into MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatReadingTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

// Moving static data outside component to improve performance and prevent re-creation on every render
// formatTime is already defined as a top-level helper

// interfaces are now imported from ../types/recommendation

const Recommendations: React.FC<RecommendationsProps> = React.memo(({ userId, wellnessGoals = EMPTY_WELLNESS_GOALS, compact = false }) => {
  const navigate = useNavigate();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const lastRecommendationsSignatureRef = useRef<string>('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [userPreferences] = useState<string[]>(['mindfulness', 'stress', 'anxiety']);
  const [fetchedWellnessGoals, setFetchedWellnessGoals] = useState<string[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [completedRecommendationIds, setCompletedRecommendationIds] = useState<Record<string, boolean>>({});
  const resolvedWellnessGoals = Array.isArray(wellnessGoals) ? wellnessGoals : EMPTY_WELLNESS_GOALS;
  const wellnessGoalsSignature = resolvedWellnessGoals.join('|');
  
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
  const [breathingUseSound, setBreathingUseSound] = useState(false);
  const [breathingUseHaptics, setBreathingUseHaptics] = useState(true);
  const [breathingStressBefore, setBreathingStressBefore] = useState<number | null>(null);
  const [breathingStressAfter, setBreathingStressAfter] = useState<number | null>(null);
  const [showBreathingScience, setShowBreathingScience] = useState(false);
  const [isBreathingFullscreen, setIsBreathingFullscreen] = useState(false);
  const breathingAudioContextRef = useRef<AudioContext | null>(null);
  const breathingOutcomeSyncedRef = useRef(false);
  
  // Breathing Exercise Hook
  const {
    isActive: isBreathingActive,
    isPaused: isBreathingPaused,
    phase: breathingPhase,
    cycleCount: breathingCount,
    phaseSecondsLeft,
    targetCycles,
    start: startBreathingExercise,
    pause: pauseBreathingExercise,
    resume: resumeBreathingExercise,
    stop: stopBreathingExercise
  } = useBreathingExercise({
    targetCycles: selectedBreathingCycles,
    onComplete: (cycles) => {
      breathingOutcomeSyncedRef.current = false;
      updateProgress('meditation', 4);
      updateProgress('exercise', 1);
      setRecommendations(prev =>
        prev.map(r => (r.id === 'stress-1' ? { ...r, completed: true } : r))
      );
      setCompletedRecommendationIds(prev => ({ ...prev, 'stress-1': true }));

      analytics.track('Recommendation Completed', {
        recommendationId: 'stress-1',
        type: 'meditation',
        duration: 4,
        source: 'breathing_auto',
        component: 'Recommendations',
      });

      const sessionData = {
        type: 'breathing',
        duration: 4,
        technique: '4-7-8',
        completedCycles: cycles,
        notes: `4-7-8 andningsövning - ${cycles} cykler slutförda | Stress fore/efter: ${breathingStressBefore ?? '-'} -> ${breathingStressAfter ?? '-'}`
      };
      handleSaveMeditationSession(sessionData);
      announceToScreenReader('Andningsövning slutförd! Bra jobbat!', 'polite');
    },
    onPhaseChange: (_, instruction) => {
      announceToScreenReader(instruction, 'polite');
    }
  });

  const playPhaseTone = useCallback((phase: string) => {
    if (!breathingUseSound || typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const frequencyMap: Record<string, number> = {
      exhale: 220,
      inhale: 440,
      hold: 330,
      exhale2: 220,
      completed: 520,
    };

    const frequency = frequencyMap[phase] || 300;

    try {
      const audioContext = breathingAudioContextRef.current ?? new AudioContextClass();
      breathingAudioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          // Resume can fail on restricted autoplay environments.
        });
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.03;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch (error) {
      logger.debug('Could not play breathing tone', { error });
    }
  }, [breathingUseSound]);

  const getBreathingCue = useCallback(() => {
    if (isBreathingPaused) {
      return {
        icon: '⏸️',
        title: 'Pausad',
        detail: 'Tryck Fortsätt när du vill fortsätta samma cykel.',
      };
    }

    switch (breathingPhase) {
      case 'exhale':
        return { icon: '🔵', title: 'Andas ut helt', detail: '2 sekunder - töm lungorna helt' };
      case 'inhale':
        return { icon: '🟢', title: 'Andas in', detail: '4 sekunder - fyll lungorna långsamt' };
      case 'hold':
        return { icon: '🟡', title: 'Håll andan', detail: '7 sekunder - håll kvar luften' };
      case 'exhale2':
        return { icon: '🔵', title: 'Andas ut långsamt', detail: '8 sekunder - töm lungorna helt' };
      case 'completed':
        return {
          icon: '🎉',
          title: 'Andningsövning slutförd!',
          detail: `Bra jobbat! Du har genomfört ${targetCycles} andningscykler enligt 4-7-8-metoden.`,
        };
      default:
        return {
          icon: '🫁',
          title: isBreathingActive ? 'Nästa cykel börjar...' : 'Redo att börja?',
          detail: '4-7-8 metoden hjälper till att minska stress och ångest.',
        };
    }
  }, [breathingPhase, isBreathingActive, isBreathingPaused, targetCycles]);

  const breathingCue = getBreathingCue();

  useEffect(() => {
    if (!isBreathingActive) return;
    if (isBreathingPaused) return;
    playPhaseTone(breathingPhase);

    if (
      breathingUseHaptics &&
      navigator.vibrate &&
      ['exhale', 'inhale', 'hold', 'exhale2', 'completed'].includes(breathingPhase)
    ) {
      navigator.vibrate(breathingPhase === 'completed' ? [80, 40, 120] : 35);
    }
  }, [breathingPhase, breathingUseHaptics, isBreathingActive, isBreathingPaused, playPhaseTone]);

  useEffect(() => {
    return () => {
      if (breathingAudioContextRef.current) {
        breathingAudioContextRef.current.close().catch(() => {
          // Best-effort cleanup.
        });
        breathingAudioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (breathingPhase !== 'completed') {
      breathingOutcomeSyncedRef.current = false;
      return;
    }

    if (breathingOutcomeSyncedRef.current) return;
    if (typeof breathingStressBefore !== 'number' || typeof breathingStressAfter !== 'number') return;

    breathingOutcomeSyncedRef.current = true;

    handleSaveMeditationSession({
      type: 'breathing',
      duration: 1,
      technique: '4-7-8-outcome',
      completedCycles: targetCycles,
      notes: `Uppfoljning stress fore/efter: ${breathingStressBefore} -> ${breathingStressAfter} (delta ${breathingStressAfter - breathingStressBefore})`
    }).catch((error: unknown) => {
      logger.debug('Could not sync breathing outcome', { error });
      breathingOutcomeSyncedRef.current = false;
    });
  }, [breathingPhase, breathingStressBefore, breathingStressAfter, handleSaveMeditationSession, targetCycles]);



  // Progressive Muscle Relaxation State (Refactored to use usePMR hook)
  const [relaxationDifficulty, setRelaxationDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [customTiming, setCustomTiming] = useState({ tense: 5, relax: 10 });
  const [breathingSync, setBreathingSync] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]); // Used for local history display

  // PMR Hook
  const {
    isActive: isRelaxationActive,
    phase: relaxationPhase,
    currentMuscleGroupIndex: currentMuscleGroup,
    timeLeft: relaxationCount,
    start: startProgressiveRelaxation,
    stop: stopProgressiveRelaxation
  } = usePMR({
    difficulty: relaxationDifficulty,
    customTiming,
    onComplete: (duration, count) => {
      logger.debug('💆 Progressive relaxation complete!', { duration });

      // Save session to history
      const newSession = {
        date: new Date().toISOString(),
        duration: duration,
        difficulty: relaxationDifficulty,
        muscleGroups: count
      };
      setSessionHistory(prev => [newSession, ...prev.slice(0, 9)]);

      // Update progress
      updateProgress('meditation', duration);

      // Save meditation session to backend
      const sessionData = {
        type: 'progressive_relaxation',
        duration: duration,
        technique: `beginner - ${relaxationDifficulty}`,
        completedCycles: count,
        notes: `Progressive muscle relaxation - ${relaxationDifficulty} level`
      };
      handleSaveMeditationSession(sessionData);
    },
    onPhaseChange: (phase, muscleGroup) => {
      if (phase === 'tense' && muscleGroup) {
        logger.debug(`💆 Starting: Tense ${muscleGroup.name}`);
        announceToScreenReader(`Spänn ${muscleGroup.name} ...`, 'polite');
      }
    }
  });
  const [loading, setLoading] = useState(!compact);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'duration' | 'difficulty'>('rating');
  const [feedbackByRecommendation, setFeedbackByRecommendation] = useState<Record<string, RecommendationFeedback | undefined>>({});
  const [userProgress, setUserProgress] = useState({
    exercisesCompleted: 0,
    meditationMinutes: 0,
    articlesRead: 0,
    weeklyGoalProgress: 0
  });

  // Journaling State (Refactored to use useJournaling)
  const [showJournalHistory, setShowJournalHistory] = useState(false);

  const {
    content: journalContent,
    setContent: setJournalContent,
    mood: journalMood,
    setMood: setJournalMood,
    tags: journalTags,
    setTags: setJournalTags,
    entries: journalEntries,
    isSaving: isSavingJournal,
    isLoading: isLoadingJournal,
    saveEntry: handleSaveJournalEntry,
    loadHistory: handleLoadJournalHistory
  } = useJournaling({
    user,
    announce: announceToScreenReader,
    onProgress: updateProgress
  });

  // Meditation Session State
  const [isMeditationActive, setIsMeditationActive] = useState(false);
  const [meditationTimeLeft, setMeditationTimeLeft] = useState(0);
  const [isMeditationPaused, setIsMeditationPaused] = useState(false);
  const [meditationTimer, setMeditationTimer] = useState<NodeJS.Timeout | null>(null);
  const [, setIsLoadingMeditation] = useState(false);
  const [, setMeditationSessions] = useState<any[]>([]);
  const [debugMode, setDebugMode] = useState(false);
  const showDebugTools = import.meta.env.DEV;

  // Pomodoro extra state
  const [pomodoroHistory, setPomodoroHistory] = useState<any[]>([]);
  const [pomodoroSettingsOpen, setPomodoroSettingsOpen] = useState(false);

  // KBT Exercise Hook
  const {
    phase: kbtPhase,
    thoughts: userThoughts,
    updateThoughts: updateThoughtsHook,
    timeLeft: kbtTimeLeft,
    isActive: isKbtActive,
    start: startKbtExercise,
    nextPhase: nextKbtPhase,
    stop: stopKbtExercise,
    setPhase: setKbtPhase,
    setThoughts: setKbtThoughts
  } = useKBTExercise({
    announce: announceToScreenReader,
    onComplete: () => {
      updateProgress('exercise', 15);
      announceToScreenReader('KBT-övning slutförd! Bra jobbat!', 'polite');
      if (user?.user_id) {
        localStorage.removeItem(`kbt_progress_${user.user_id}`);
      }
    }
  });

  const handleThoughtChange = (field: 'negative' | 'evidence' | 'alternative', value: string) => {
    updateThoughtsHook(field, value);
    if (detectCrisis(value)) {
      setShowCrisisAlert(true);
    }
  };

  const [kbtStep, setKbtStep] = useState(0);
  const [kbtBeliefBefore, setKbtBeliefBefore] = useState<number | null>(null);
  const [kbtBeliefAfter, setKbtBeliefAfter] = useState<number | null>(null);
  const [kbtStressBefore, setKbtStressBefore] = useState<number | null>(null);
  const [kbtStressAfter, setKbtStressAfter] = useState<number | null>(null);
  const [kbtActionPlan, setKbtActionPlan] = useState('');
  const [kbtExperimentHypothesis, setKbtExperimentHypothesis] = useState('');
  const [kbtExperimentMeasure, setKbtExperimentMeasure] = useState('');
  const [kbtSocraticReflection, setKbtSocraticReflection] = useState('');
  const [kbtIfThenPlan, setKbtIfThenPlan] = useState('');
  const [kbtCopingCard, setKbtCopingCard] = useState('');
  const [kbtExecutionConfidenceAfter, setKbtExecutionConfidenceAfter] = useState<number | null>(null);
  const [kbtObstaclePlan, setKbtObstaclePlan] = useState('');
  const [kbtFollowUpWindow, setKbtFollowUpWindow] = useState('I morgon bitti');
  const [kbtRehearsalContext, setKbtRehearsalContext] = useState('');
  const kbtCompletionSyncedRef = useRef(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  const activeKbtStep = getKbtStepFromPhase(kbtPhase);
  const kbtDistortionInsights = getKbtDistortionInsights(userThoughts.negative);
  const kbtProgressPercentage = kbtPhase === 'complete'
    ? 100
    : Math.round((activeKbtStep / KBT_TOTAL_STEPS) * 100);

  const startKbtFlow = useCallback(() => {
    setKbtStep(1);
    setKbtBeliefBefore(null);
    setKbtBeliefAfter(null);
    setKbtStressBefore(null);
    setKbtStressAfter(null);
    setKbtActionPlan('');
    setKbtExperimentHypothesis('');
    setKbtExperimentMeasure('');
    setKbtSocraticReflection('');
    setKbtIfThenPlan('');
    setKbtCopingCard('');
    setKbtExecutionConfidenceAfter(null);
    setKbtObstaclePlan('');
    setKbtFollowUpWindow('I morgon bitti');
    setKbtRehearsalContext('');
    startKbtExercise();
  }, [startKbtExercise]);

  const handleNextKbtPhase = useCallback(() => {
    if (kbtPhase === 'challenge' && kbtSocraticReflection.trim().length < KBT_MIN_SOCRATIC_REFLECTION_LENGTH) {
      announceToScreenReader(`Besvara reflektionsfragan med minst ${KBT_MIN_SOCRATIC_REFLECTION_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtBeliefAfter === null) {
      announceToScreenReader('Välj hur trovärdig den nya tanken känns innan du fortsätter', 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtStressAfter === null) {
      announceToScreenReader('Välj stressniva efter ovningen innan du fortsatter', 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtExecutionConfidenceAfter === null) {
      announceToScreenReader('Välj hur trygg du känner dig att genomföra planen i vardagen', 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtActionPlan.trim().length < KBT_MIN_ACTION_PLAN_LENGTH) {
      announceToScreenReader(`Skriv ett konkret handlingssteg med minst ${KBT_MIN_ACTION_PLAN_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtExperimentHypothesis.trim().length < KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH) {
      announceToScreenReader(`Skriv en testbar hypotes med minst ${KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtExperimentMeasure.trim().length < KBT_MIN_EXPERIMENT_MEASURE_LENGTH) {
      announceToScreenReader(`Beskriv vad du ska observera med minst ${KBT_MIN_EXPERIMENT_MEASURE_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtIfThenPlan.trim().length < KBT_MIN_IF_THEN_PLAN_LENGTH) {
      announceToScreenReader(`Skriv en om-så plan med minst ${KBT_MIN_IF_THEN_PLAN_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtCopingCard.trim().length < KBT_MIN_COPING_CARD_LENGTH) {
      announceToScreenReader(`Skriv ett kort coping-kort med minst ${KBT_MIN_COPING_CARD_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtObstaclePlan.trim().length < KBT_MIN_OBSTACLE_PLAN_LENGTH) {
      announceToScreenReader(`Beskriv en hinderplan med minst ${KBT_MIN_OBSTACLE_PLAN_LENGTH} tecken`, 'assertive');
      return;
    }
    if (kbtPhase === 'practice' && kbtRehearsalContext.trim().length < KBT_MIN_REHEARSAL_CONTEXT_LENGTH) {
      announceToScreenReader(`Beskriv var du repeterar tanken med minst ${KBT_MIN_REHEARSAL_CONTEXT_LENGTH} tecken`, 'assertive');
      return;
    }
    nextKbtPhase();
  }, [announceToScreenReader, kbtActionPlan, kbtBeliefAfter, kbtCopingCard, kbtExecutionConfidenceAfter, kbtExperimentHypothesis, kbtExperimentMeasure, kbtIfThenPlan, kbtObstaclePlan, kbtPhase, kbtRehearsalContext, kbtSocraticReflection, kbtStressAfter, nextKbtPhase]);

  // Daily Reminders State
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    dailyRemindersEnabled: false,
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
  const [articleReadingTimer, setArticleReadingTimer] = useState<NodeJS.Timeout | null>(null);
  const [articleCompleted, setArticleCompleted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // Load saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(`kbt_progress_${user?.user_id || 'anonymous'}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setKbtThoughts(parsed.thoughts || { negative: '', evidence: '', alternative: '' });
        setKbtPhase(parsed.phase || 'identify');
        setKbtStep(parsed.step || 0);
        setKbtBeliefBefore(typeof parsed.beliefBefore === 'number' ? parsed.beliefBefore : null);
        setKbtBeliefAfter(typeof parsed.beliefAfter === 'number' ? parsed.beliefAfter : null);
        setKbtStressBefore(typeof parsed.stressBefore === 'number' ? parsed.stressBefore : null);
        setKbtStressAfter(typeof parsed.stressAfter === 'number' ? parsed.stressAfter : null);
        setKbtActionPlan(typeof parsed.actionPlan === 'string' ? parsed.actionPlan : '');
        setKbtExperimentHypothesis(typeof parsed.experimentHypothesis === 'string' ? parsed.experimentHypothesis : '');
        setKbtExperimentMeasure(typeof parsed.experimentMeasure === 'string' ? parsed.experimentMeasure : '');
        setKbtSocraticReflection(typeof parsed.socraticReflection === 'string' ? parsed.socraticReflection : '');
        setKbtIfThenPlan(typeof parsed.ifThenPlan === 'string' ? parsed.ifThenPlan : '');
        setKbtCopingCard(typeof parsed.copingCard === 'string' ? parsed.copingCard : '');
        setKbtExecutionConfidenceAfter(typeof parsed.executionConfidenceAfter === 'number' ? parsed.executionConfidenceAfter : null);
        setKbtObstaclePlan(typeof parsed.obstaclePlan === 'string' ? parsed.obstaclePlan : '');
        setKbtFollowUpWindow(typeof parsed.followUpWindow === 'string' ? parsed.followUpWindow : 'I morgon bitti');
        setKbtRehearsalContext(typeof parsed.rehearsalContext === 'string' ? parsed.rehearsalContext : '');
        logger.debug('💾 Loaded saved KBT progress:', parsed);
      } catch (error) {
        logger.error('Failed to load KBT progress:', error);
      }
    }
  }, [user, setKbtThoughts, setKbtPhase, setKbtStep]);

  useEffect(() => {
    setKbtStep(kbtPhase === 'complete' ? KBT_TOTAL_STEPS : activeKbtStep);
  }, [activeKbtStep, kbtPhase]);

  // Save progress whenever it changes
  useEffect(() => {
    if (user?.user_id && (userThoughts.negative || userThoughts.evidence || userThoughts.alternative || kbtPhase !== 'identify')) {
      const progress = {
        thoughts: userThoughts,
        phase: kbtPhase,
        step: kbtStep,
        beliefBefore: kbtBeliefBefore,
        beliefAfter: kbtBeliefAfter,
        stressBefore: kbtStressBefore,
        stressAfter: kbtStressAfter,
        actionPlan: kbtActionPlan,
        experimentHypothesis: kbtExperimentHypothesis,
        experimentMeasure: kbtExperimentMeasure,
        socraticReflection: kbtSocraticReflection,
        ifThenPlan: kbtIfThenPlan,
        copingCard: kbtCopingCard,
        executionConfidenceAfter: kbtExecutionConfidenceAfter,
        obstaclePlan: kbtObstaclePlan,
        followUpWindow: kbtFollowUpWindow,
        rehearsalContext: kbtRehearsalContext,
        timestamp: Date.now()
      };
      localStorage.setItem(`kbt_progress_${user.user_id}`, JSON.stringify(progress));
      logger.debug('Saved KBT progress:', progress);
    }
  }, [userThoughts, kbtPhase, kbtStep, kbtBeliefBefore, kbtBeliefAfter, kbtStressBefore, kbtStressAfter, kbtActionPlan, kbtExperimentHypothesis, kbtExperimentMeasure, kbtSocraticReflection, kbtIfThenPlan, kbtCopingCard, kbtExecutionConfidenceAfter, kbtObstaclePlan, kbtFollowUpWindow, kbtRehearsalContext, user]);

  useEffect(() => {
    if (kbtPhase !== 'complete') {
      kbtCompletionSyncedRef.current = false;
      return;
    }

    if (kbtCompletionSyncedRef.current) return;
    kbtCompletionSyncedRef.current = true;

    const shift = typeof kbtBeliefBefore === 'number' && typeof kbtBeliefAfter === 'number'
      ? kbtBeliefAfter - kbtBeliefBefore
      : 0;

    const quality = calculateKbtSessionQuality({
      beliefBefore: kbtBeliefBefore,
      beliefAfter: kbtBeliefAfter,
      negative: userThoughts.negative,
      evidence: userThoughts.evidence,
      alternative: userThoughts.alternative,
      actionPlan: kbtActionPlan,
      obstaclePlan: kbtObstaclePlan,
      rehearsalContext: kbtRehearsalContext,
      experimentHypothesis: kbtExperimentHypothesis,
      experimentMeasure: kbtExperimentMeasure,
      socraticReflection: kbtSocraticReflection,
      ifThenPlan: kbtIfThenPlan,
      copingCard: kbtCopingCard,
      executionConfidenceAfter: kbtExecutionConfidenceAfter,
    });
    const successRate = Math.max(10, Math.min(100, Math.round((50 + shift + quality.score) / 2)));
    const notes = [
      `Negativ tanke: ${userThoughts.negative || 'Ingen angiven'}`,
      `Identifierade forvrangningar: ${kbtDistortionInsights.length > 0 ? kbtDistortionInsights.map((item) => item.label).join(', ') : 'Inga tydliga monster'}`,
      `Balanserad tanke: ${userThoughts.alternative || 'Ingen angiven'}`,
      `Skattning fore/efter: ${kbtBeliefBefore ?? '-'} -> ${kbtBeliefAfter ?? '-'}`,
      `Stress fore/efter: ${kbtStressBefore ?? '-'} -> ${kbtStressAfter ?? '-'}`,
      `Genomforandetillit: ${kbtExecutionConfidenceAfter ?? '-'}%`,
      `Sokratisk reflektion: ${kbtSocraticReflection || 'Ingen reflektion angiven'}`,
      `Om-sa plan: ${kbtIfThenPlan || 'Ingen om-sa plan angiven'}`,
      `Coping-kort: ${kbtCopingCard || 'Inget coping-kort angivet'}`,
      `Handlingssteg: ${kbtActionPlan || 'Inget handlingssteg angivet'}`,
      `Experimenthypotes: ${kbtExperimentHypothesis || 'Ingen hypotes angiven'}`,
      `Observationsmatt: ${kbtExperimentMeasure || 'Inget matt angivet'}`,
      `Hinderplan: ${kbtObstaclePlan || 'Ingen hinderplan angiven'}`,
      `Uppfoljning: ${kbtFollowUpWindow}, sammanhang: ${kbtRehearsalContext || 'Ej angivet'}`,
      `Kvalitetspoang: ${quality.score}/100 (${quality.label})`
    ].join(' | ');

    updateCBTProgress({
      exerciseId: 'stress-2-kbt-thought-record',
      successRate,
      timeSpent: 600,
      difficultyRating: 2,
      notes,
    }).catch((error) => {
      logger.debug('Could not sync KBT progress to backend', { error });
    });
  }, [kbtPhase, kbtBeliefBefore, kbtBeliefAfter, kbtStressBefore, kbtStressAfter, kbtExecutionConfidenceAfter, userThoughts.negative, userThoughts.evidence, userThoughts.alternative, kbtActionPlan, kbtExperimentHypothesis, kbtExperimentMeasure, kbtSocraticReflection, kbtIfThenPlan, kbtCopingCard, kbtObstaclePlan, kbtFollowUpWindow, kbtRehearsalContext, kbtDistortionInsights]);

  const loadRecommendations = useCallback((goals: string[], screenReader: typeof announceToScreenReader) => {
    const allRecommendations = RECOMMENDATIONS_POOL;
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
  }, [announceToScreenReader, compact]);

  // Fetch wellness goals on mount
  useEffect(() => {
    logger.debug('🔍 RECOMMENDATIONS COMPONENT - useEffect triggered', {
      user: user ? 'exists' : 'null',
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
  }, [compact, user?.user_id, wellnessGoalsSignature]);

  // Track page view only once on mount
  useEffect(() => {
    analytics.page('Recommendations', {
      component: 'Recommendations',
      userId: userId || user?.user_id,
      wellnessGoals: resolvedWellnessGoals.length > 0 ? resolvedWellnessGoals : fetchedWellnessGoals,
    });
  }, []); // Only run once on mount

  // Load recommendations when goals change
  useEffect(() => {
    const goalsToUse = resolvedWellnessGoals.length > 0 ? resolvedWellnessGoals : fetchedWellnessGoals;
    logger.debug('📋 Loading recommendations with goals:', goalsToUse);

    loadRecommendations(goalsToUse, announceToScreenReader);
  }, [wellnessGoalsSignature, fetchedWellnessGoals, loadRecommendations, announceToScreenReader]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (articleReadingTimer) {
        clearInterval(articleReadingTimer);
      }
      if (meditationTimer) {
        clearInterval(meditationTimer);
      }
    };
  }, [articleReadingTimer, meditationTimer]); // relaxationTimer and pomodoroTimer are managed by hooks

  // startBreathingExercise and stopBreathingExercise are now provided by the useBreathingExercise hook

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

    // Start reading timer
    const timer = setInterval(() => {
      setReadingTime(prev => prev + 1);
    }, 1000);
    setArticleReadingTimer(timer);

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
          console.error(e);
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
    if (articleReadingTimer) {
      clearInterval(articleReadingTimer);
      setArticleReadingTimer(null);
    }

    // Calculate reading speed and provide feedback
    const totalWords = neuroscienceArticleSections.reduce((total, section) => {
      // Create a temporary DOM element for safe HTML text extraction
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = section.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      return total + textContent.split(/\s+/).length;
    }, 0);

    const wordsPerMinute = Math.round((totalWords / readingTime) * 60);
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

  // Meditation Functions
  async function handleSaveMeditationSession(sessionData: any) {
    if (!user?.user_id) return;

    try {
      await saveMeditationSession(sessionData);
      logger.debug('✅ Meditation session saved to backend');

      // Refresh meditation history
      handleLoadMeditationHistory();
    } catch (error) {
      logger.error('Failed to save meditation session:', error);
    }
  }

  async function handleLoadMeditationHistory() {
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
  }

  // Load data on mount
  useEffect(() => {
    if (user?.user_id) {
      handleLoadJournalHistory();
      handleLoadMeditationHistory();
    }
  }, [user]);

  // Filter and sort recommendations
  const getFilteredRecommendations = () => {
    let filtered = [...recommendations]; // Create a copy to avoid mutating original

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(rec =>
        rec.title.toLowerCase().includes(searchLower) ||
        rec.description.toLowerCase().includes(searchLower) ||
        rec.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        rec.category.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(rec => rec.category === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'duration':
          return (a.duration || 0) - (b.duration || 0);
        case 'difficulty':
          const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        default:
          return 0;
      }
    });

    return filtered;
  };

  const categories = ['all', ...Array.from(new Set(recommendations.map(r => r.category))).sort()];
  const hasActiveFilters = searchTerm.trim().length > 0 || selectedCategory !== 'all' || sortBy !== 'rating';

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

  const registerFCMToken = async () => {
    try {
      // For web push notifications, we'd need Firebase SDK
      // For now, we'll simulate FCM token registration
      const mockToken = `web-fcm-token-${user?.user_id}-${Date.now()}`;
      await saveFCMToken(mockToken);
      setNotificationSettings(prev => ({ ...prev, fcmToken: true }));
      return true;
    } catch (error) {
      logger.error('Failed to register FCM token:', error);
      return false;
    }
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

      // Register FCM token
      const tokenRegistered = await registerFCMToken();
      if (!tokenRegistered) {
        alert('Kunde inte registrera notis-token. Försök igen.');
        setIsEnablingNotifications(false);
        return;
      }

      // Enable daily reminders
      await updateNotificationSettings({
        dailyRemindersEnabled: true,
        reminderTime: notificationSettings.reminderTime
      });

      setNotificationSettings(prev => ({ ...prev, dailyRemindersEnabled: true }));

      // Show success message
      alert(`✅ Dagliga påminnelser aktiverade!\n\nDu kommer få en vänlig påminnelse varje dag kl.${notificationSettings.reminderTime} att ta hand om din mentala hälsa.`);

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
        if (recommendation.id === 'stress-1') {
          setTimeout(() => startBreathingExercise(), 500);
        } else if (recommendation.id === 'stress-2') {
          setTimeout(() => startKbtFlow(), 500);
        } else if (recommendation.id === 'stress-3') {
          setTimeout(() => startProgressiveRelaxation(), 500);
        } else if (recommendation.id === 'generic-1') {
          setTimeout(() => startGratitudeChallenge(), 500);
        } else if (recommendation.id === 'focus-1') {
          setTimeout(() => startPomodoroTimer(), 500);
        } else if (recommendation.id === 'focus-3') {
          setTimeout(() => startArticleReading(), 500);
        } else if (recommendation.id === 'focus-2' || (recommendation.type === 'meditation' && !['stress-1', 'stress-3'].includes(recommendation.id))) {
          setTimeout(() => startMeditationSession(recommendation.duration || 10), 500);
        }

        // For articles, mark as read immediately when started
        if (recommendation.type === 'article') {
          updateProgress('article', 1);
        }
        break;
      case 'save':
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
      case 'share':
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

  const startMeditationSession = (duration: number) => {
    if (meditationTimer) {
      clearInterval(meditationTimer);
    }
    setIsMeditationActive(true);
    setMeditationTimeLeft(duration * 60);
    setIsMeditationPaused(false);

    const timer = setInterval(() => {
      setMeditationTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleMeditationComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setMeditationTimer(timer);
  };

  const toggleMeditationPause = () => {
    if (isMeditationPaused) {
      // Resume
      setIsMeditationPaused(false);
      const timer = setInterval(() => {
        setMeditationTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleMeditationComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setMeditationTimer(timer);
    } else {
      // Pause
      if (meditationTimer) {
        clearInterval(meditationTimer);
        setMeditationTimer(null);
      }
      setIsMeditationPaused(true);
    }
  };

  const stopMeditationSession = () => {
    if (meditationTimer) {
      clearInterval(meditationTimer);
      setMeditationTimer(null);
    }
    setIsMeditationActive(false);
    setMeditationTimeLeft(0);
    setIsMeditationPaused(false);
  };

  const handleMeditationComplete = async () => {
    setIsMeditationActive(false);
    setMeditationTimer(null);

    // Save progress and session
    if (selectedRecommendation && user?.user_id) {
      const recommendationId = selectedRecommendation.id;
      const alreadyCompleted = !!completedRecommendationIds[recommendationId];

      if (!alreadyCompleted) {
        updateProgress('meditation', selectedRecommendation.duration || 10);
      }

      setRecommendations(prev =>
        prev.map(r => (r.id === recommendationId ? { ...r, completed: true } : r))
      );
      setCompletedRecommendationIds(prev => ({ ...prev, [recommendationId]: true }));

      if (!alreadyCompleted) {
        analytics.track('Recommendation Completed', {
          recommendationId,
          type: selectedRecommendation.type,
          duration: selectedRecommendation.duration,
          source: 'meditation_timer',
          component: 'Recommendations',
        });
      }

      try {
        await saveMeditationSession({
          type: 'meditation',
          duration: selectedRecommendation.duration || 10,
          technique: selectedRecommendation.title,
          completedCycles: 1,
          notes: 'Completed via Recommendations panel'
        });
      } catch (error) {
        logger.error('Failed to save meditation session:', error);
      }
      announceToScreenReader(`${selectedRecommendation.title} slutförd! Bra jobbat!`, 'polite');
    }
  };

  const handleCloseContentModal = useCallback(() => {
    if (isBreathingActive) {
      stopBreathingExercise();
    }
    if (isRelaxationActive) {
      stopProgressiveRelaxation();
    }
    if (isKbtActive) {
      stopKbtExercise();
    }
    if (isPomodoroActive) {
      stopPomodoroTimer();
    }
    if (isMeditationActive || meditationTimer) {
      stopMeditationSession();
    }
    if (articleReadingTimer) {
      clearInterval(articleReadingTimer);
      setArticleReadingTimer(null);
    }
    setIsBreathingFullscreen(false);
    setShowBreathingScience(false);
    setBreathingStressBefore(null);
    setBreathingStressAfter(null);

    setShowContentModal(false);
    setSelectedRecommendation(null);
  }, [
    articleReadingTimer,
    isBreathingActive,
    isKbtActive,
    isMeditationActive,
    isPomodoroActive,
    isRelaxationActive,
    meditationTimer,
    stopBreathingExercise,
    stopKbtExercise,
    stopMeditationSession,
    stopPomodoroTimer,
    stopProgressiveRelaxation,
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
                      ? getCompactCtaLabel(rec.type)
                      : rec.type === 'meditation'
                        ? 'Starta passet'
                        : 'Läs mer'}
                    <span>→</span>
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

  const filteredRecommendations = getFilteredRecommendations();
  const selectedRecommendationId = selectedRecommendation?.id ?? '';
  const isStressBreathingRecommendation = selectedRecommendationId === 'stress-1';
  const isSelectedRecommendationCompleted = selectedRecommendationId
    ? !!completedRecommendationIds[selectedRecommendationId]
    : false;
  const canManuallyCompleteSelectedRecommendation = !isStressBreathingRecommendation || breathingPhase === 'completed';
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
              Personliga Rekommendationer 💡
            </h1>
            <p className="text-lg opacity-90 mb-4">
              Innehåll anpassat efter dina behov och framsteg
            </p>
            <p className="text-sm opacity-90 max-w-2xl">
              Här ser du personliga förslag baserade på dina mål. I Välmåendebiblioteket hittar du hela utbudet av övningar och innehåll.
            </p>
            {user && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  🧘 {fetchedWellnessGoals.length} Wellness-mål
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  🎯 {recommendations.length} Tillgängliga övningar
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  📚 Evidensbaserat innehåll
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
            <p className="text-sm opacity-75">Evidensbaserat innehåll</p>
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

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Sök rekommendationer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Sök rekommendationer"
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
              // Get category color for visual consistency
              const getCategoryColor = (category: string) => {
                const colors: Record<string, string> = {
                  'Stresshantering': 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
                  'Sömn': 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800',
                  'Fokus': 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800',
                  'Mental klarhet': 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
                  'Produktivitet': 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
                  'Relationer': 'bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800',
                };
                return colors[category] || 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
              };
              
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
                        onClick={() => handleRecommendationAction(recommendation, 'continue')}
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
                <div className={`${isBreathingFullscreen ? 'fixed inset-0 z-[260] overflow-y-auto bg-black/80 p-4 sm:p-8' : ''}`}>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-center sm:text-left">
                        🫁 Interaktiv Andningsguide
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBreathingUseSound(prev => !prev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${breathingUseSound ? 'bg-blue-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                        >
                          {breathingUseSound ? '🔊 Ljud på' : '🔈 Ljud av'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreathingUseHaptics(prev => !prev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${breathingUseHaptics ? 'bg-emerald-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                        >
                          {breathingUseHaptics ? '📳 Haptik på' : '📴 Haptik av'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsBreathingFullscreen(prev => !prev)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-white"
                        >
                          {isBreathingFullscreen ? '🗗 Avsluta helskärm' : '🗖 Helskärm'}
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                      Följ cue-texten i cirkeln och siffrorna för att skapa ett lugnt andningsmönster.
                    </p>

                    <div className="mb-4 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg text-left">
                      <label htmlFor="breathing-stress-before" className="text-sm font-medium text-rose-700 dark:text-rose-300 block mb-1">
                        Stress fore start ({breathingStressBefore ?? 0}/100)
                      </label>
                      <input
                        id="breathing-stress-before"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={breathingStressBefore ?? 0}
                        onChange={(e) => setBreathingStressBefore(Number(e.target.value))}
                        disabled={isBreathingActive || breathingPhase === 'completed'}
                        className="w-full accent-rose-600"
                      />
                      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                        Satt en snabb baslinje innan andningsrundan.
                      </p>
                    </div>

                    <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                      {[4, 8, 12].map((cycleOption) => (
                        <button
                          key={cycleOption}
                          type="button"
                          disabled={isBreathingActive}
                          onClick={() => setSelectedBreathingCycles(cycleOption as 4 | 8 | 12)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedBreathingCycles === cycleOption
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/80 dark:bg-gray-700 text-gray-700 dark:text-gray-200'} ${isBreathingActive ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-100 dark:hover:bg-gray-600'}`}
                        >
                          {cycleOption} cykler
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        <div className={`absolute inset-0 rounded-full border-4 transition-all duration-1000 ${breathingPhase === 'inhale' ? 'border-green-300 scale-150 opacity-60' : breathingPhase === 'exhale' || breathingPhase === 'exhale2' ? 'border-blue-300 scale-90 opacity-40' : 'border-gray-300 scale-100 opacity-20'}`}></div>
                        <div className={`absolute inset-2 rounded-full border-2 transition-all duration-1000 ${breathingPhase === 'hold' ? 'border-yellow-300 scale-110 opacity-50' : 'border-transparent scale-100 opacity-0'}`}></div>

                        <div
                          className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-1000 transform ${breathingPhase === 'exhale'
                            ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white scale-75 shadow-blue-500/50 shadow-lg'
                            : breathingPhase === 'inhale'
                              ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-125 shadow-green-500/50 shadow-xl animate-pulse'
                              : breathingPhase === 'hold'
                                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white scale-110 shadow-yellow-500/50 shadow-lg'
                                : breathingPhase === 'exhale2'
                                  ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white scale-75 shadow-blue-500/50 shadow-lg'
                                  : breathingPhase === 'completed'
                                    ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white scale-110 shadow-purple-500/50 shadow-xl'
                                    : 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700 scale-100 shadow-gray-500/20 shadow-md'} `}
                        >
                          <span className="text-xs font-semibold tracking-wide uppercase opacity-90">
                            {breathingCue.title}
                          </span>
                          <span className="text-3xl font-black leading-tight mt-1">
                            {breathingPhase === 'completed' ? '✓' : phaseSecondsLeft > 0 ? phaseSecondsLeft : '•'}
                          </span>
                          <span className="text-xs font-medium mt-1 opacity-90">
                            Cykel {Math.min(breathingCount + (isBreathingActive ? 1 : 0), targetCycles)} av {targetCycles}
                          </span>

                          {breathingPhase === 'inhale' && (
                            <div className="absolute inset-0 rounded-full border-2 border-green-300 animate-ping opacity-75"></div>
                          )}
                        </div>

                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex space-x-2">
                          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'exhale' ? 'bg-blue-500 scale-125 animate-pulse' : 'bg-gray-300'}`} />
                          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'inhale' ? 'bg-green-500 scale-125 animate-pulse' : 'bg-gray-300'}`} />
                          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'hold' ? 'bg-yellow-500 scale-125 animate-pulse' : 'bg-gray-300'}`} />
                          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'exhale2' ? 'bg-blue-600 scale-125 animate-pulse' : 'bg-gray-300'}`} />
                        </div>
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {breathingCue.icon} {breathingCue.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{breathingCue.detail}</p>
                    </div>

                    <div className="text-center mb-4">
                      <button
                        type="button"
                        onClick={() => setShowBreathingScience(prev => !prev)}
                        className="text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline"
                      >
                        {showBreathingScience ? 'Dölj' : 'Visa'}: Varför 4-7-8?
                      </button>
                      {showBreathingScience && (
                        <div className="mt-3 text-sm text-left bg-white/80 dark:bg-gray-800/70 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 text-gray-700 dark:text-gray-300">
                          4-7-8-andning förlänger utandningen, vilket kan aktivera kroppens lugn- och återhämtningssystem. Tekniken kan hjälpa till att sänka upplevd stress, stabilisera andningsrytmen och skapa bättre fokus i stunden.
                        </div>
                      )}
                    </div>

                    {breathingPhase === 'completed' && (
                      <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-left border border-emerald-100 dark:border-emerald-800">
                        <label htmlFor="breathing-stress-after" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 block mb-1">
                          Stress efter ovningen ({breathingStressAfter ?? 0}/100)
                        </label>
                        <input
                          id="breathing-stress-after"
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={breathingStressAfter ?? 0}
                          onChange={(e) => setBreathingStressAfter(Number(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                        {typeof breathingStressBefore === 'number' && typeof breathingStressAfter === 'number' && (
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                            Forandring: {breathingStressAfter - breathingStressBefore <= 0 ? '' : '+'}{breathingStressAfter - breathingStressBefore} poang
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-center gap-3">
                      {isBreathingActive ? (
                        <>
                          <button
                            onClick={isBreathingPaused ? resumeBreathingExercise : pauseBreathingExercise}
                            className={`px-6 py-3 ${isBreathingPaused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'} text-white font-medium rounded-lg transition-colors`}
                          >
                            {isBreathingPaused ? '▶️ Fortsätt' : '⏸️ Pausa'}
                          </button>
                          <button
                            onClick={stopBreathingExercise}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                          >
                            ⏹️ Stoppa
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            breathingOutcomeSyncedRef.current = false;
                            setBreathingStressAfter(null);
                            startBreathingExercise();
                          }}
                          disabled={breathingStressBefore === null}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                        >
                          {breathingPhase === 'completed' ? '🔁 Starta ny omgång' : '🚀 Starta andningsövning'}
                        </button>
                      )}
                    </div>
                    {!isBreathingActive && breathingStressBefore === null && (
                      <p className="text-center text-xs text-rose-600 dark:text-rose-300 mt-2">
                        Välj stressnivå före start för att kunna jämföra effekten efteråt.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Interactive KBT Exercise for Stress Management */}
              {selectedRecommendation.id === 'stress-2' && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 mb-4 border-2 border-purple-200 dark:border-purple-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    🧠 Interaktiv KBT-övning
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    Steg-för-steg guide för att hantera stressiga tankar genom kognitiv beteendeterapi
                  </p>

                  {/* Progress Indicator */}
                  <div className="mb-6">
                    <p className="text-center text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                      {kbtPhase === 'complete' ? 'KBT-övning klar' : `Steg ${activeKbtStep} av ${KBT_TOTAL_STEPS}`}
                    </p>
                    <div className="w-full h-2 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${kbtProgressPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-center items-center space-x-2">
                      {['identify', 'challenge', 'replace', 'practice'].map((phase, index) => (
                        <div
                          key={phase}
                          className={`w-3 h-3 rounded-full ${index < activeKbtStep
                            ? 'bg-purple-500'
                            : 'bg-gray-300'
                            } `}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timer */}
                  {isKbtActive && kbtTimeLeft > 0 && (
                    <div className="text-center mb-4">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {formatTime(kbtTimeLeft)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">kvar på detta steg</p>
                    </div>
                  )}

                  {/* KBT Content */}
                  <div className="space-y-4">
                    {kbtPhase === 'identify' && (
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          📝 Steg 1: Identifiera negativa tankar
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          Skriv ner en specifik stressig tanke som du har just nu. Vad säger din inre röst som skapar ångest?
                        </p>

                        {/* Example Thoughts */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-left">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Exempel på negativa tankar:</p>
                          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                            <li>• "Jag kommer att göra bort mig helt"</li>
                            <li>• "Ingen kommer att gilla det jag säger"</li>
                            <li>• "Jag är inte tillräckligt bra för detta"</li>
                            <li>• "Allt kommer att gå fel"</li>
                          </ul>
                        </div>

                        <textarea
                          value={userThoughts.negative}
                          onChange={(e) => handleThoughtChange('negative', e.target.value)}
                          placeholder="Skriv din negativa tanke här... (t.ex. 'Jag kommer att misslyckas')"
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={3}
                          minLength={KBT_MIN_NEGATIVE_LENGTH}
                          required
                        />
                        {userThoughts.negative.trim().length < KBT_MIN_NEGATIVE_LENGTH && userThoughts.negative.trim().length > 0 && (
                          <p className="text-red-500 text-sm mt-1">Skriv minst {KBT_MIN_NEGATIVE_LENGTH} tecken för att fortsätta</p>
                        )}
                      </div>
                    )}

                    {kbtPhase === 'challenge' && (
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          🔍 Steg 2: Utmana tanken med evidens
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          Analysera din tanke objektivt. Vilka konkreta bevis finns för och emot den?
                        </p>

                        {/* Current Thought Display */}
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">
                          <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Din negativa tanke:</p>
                          <p className="text-red-600 dark:text-red-400 italic">"{userThoughts.negative}"</p>
                        </div>

                        {kbtDistortionInsights.length > 0 && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-4 text-left border border-yellow-100 dark:border-yellow-800">
                            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-2">Mojliga tankefeller att utforska:</p>
                            {kbtDistortionInsights.map((insight) => (
                              <div key={insight.key} className="mb-2 last:mb-0">
                                <p className="text-sm text-yellow-700 dark:text-yellow-300"><strong>{insight.label}:</strong> {insight.hint}</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Fraga: {insight.reframeQuestion}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-4 text-left">
                          <label htmlFor="kbt-belief-before" className="text-sm font-medium text-purple-700 dark:text-purple-300 block mb-1">
                            Hur trovärdig känns den negativa tanken just nu? ({kbtBeliefBefore ?? 0}%)
                          </label>
                          <input
                            id="kbt-belief-before"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={kbtBeliefBefore ?? 0}
                            onChange={(e) => setKbtBeliefBefore(Number(e.target.value))}
                            className="w-full accent-purple-600"
                          />
                        </div>

                        <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg mb-4 text-left">
                          <label htmlFor="kbt-stress-before" className="text-sm font-medium text-rose-700 dark:text-rose-300 block mb-1">
                            Hur stark ar stressen i kroppen just nu? ({kbtStressBefore ?? 0}/100)
                          </label>
                          <input
                            id="kbt-stress-before"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={kbtStressBefore ?? 0}
                            onChange={(e) => setKbtStressBefore(Number(e.target.value))}
                            className="w-full accent-rose-600"
                          />
                        </div>

                        {/* Evidence Framework */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                            <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">✅ För tanken:</p>
                            <p className="text-xs text-green-600 dark:text-green-400">Vilka bevis stödjer denna tanke?</p>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                            <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">❌ Emot tanken:</p>
                            <p className="text-xs text-orange-600 dark:text-orange-400">Vilka bevis motsäger denna tanke?</p>
                          </div>
                        </div>

                        {/* Example */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-left">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Exempel på evidens-analys:</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            <strong>För:</strong> "Jag har misslyckats tidigare" <br />
                            <strong>Emot:</strong> "Jag har också lyckats många gånger och lärt mig av misstagen. De flesta människor misslyckas ibland."
                          </p>
                        </div>

                        <textarea
                          value={userThoughts.evidence}
                          onChange={(e) => handleThoughtChange('evidence', e.target.value)}
                          placeholder={`Analysera tanken \"${userThoughts.negative || '...'}\" med strukturen:\nFör: ...\nEmot: ...`}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={5}
                          minLength={KBT_MIN_EVIDENCE_LENGTH}
                          required
                        />
                        {userThoughts.evidence.trim().length < KBT_MIN_EVIDENCE_LENGTH && userThoughts.evidence.trim().length > 0 && (
                          <p className="text-red-500 text-sm mt-1">Beskriv minst {KBT_MIN_EVIDENCE_LENGTH} tecken för att fortsätta</p>
                        )}
                        {userThoughts.evidence.trim().length >= KBT_MIN_EVIDENCE_LENGTH && !/(för:|for:)/i.test(userThoughts.evidence) && (
                          <p className="text-amber-600 text-sm mt-1">Tips: Lägg till "För:" för tydlig struktur.</p>
                        )}
                        {userThoughts.evidence.trim().length >= KBT_MIN_EVIDENCE_LENGTH && !/(emot:|against:)/i.test(userThoughts.evidence) && (
                          <p className="text-amber-600 text-sm mt-1">Tips: Lägg till "Emot:" för att balansera analysen.</p>
                        )}

                        <div className="mt-4 bg-sky-50 dark:bg-sky-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-socratic-reflection" className="text-sm font-medium text-sky-700 dark:text-sky-300 block mb-1">
                            Sokratisk fraga: Om en van hade samma tanke, vad skulle du saga till hen utifran bevisen?
                          </label>
                          <textarea
                            id="kbt-socratic-reflection"
                            value={kbtSocraticReflection}
                            onChange={(e) => setKbtSocraticReflection(e.target.value)}
                            placeholder="Skriv ett kort, medkannande och faktabaserat svar som du sjalv kan anvanda."
                            className="w-full p-3 border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            rows={3}
                            minLength={KBT_MIN_SOCRATIC_REFLECTION_LENGTH}
                          />
                          {kbtSocraticReflection.trim().length > 0 && kbtSocraticReflection.trim().length < KBT_MIN_SOCRATIC_REFLECTION_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_SOCRATIC_REFLECTION_LENGTH} tecken for att forankra en hjalpsam inre dialog.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {kbtPhase === 'replace' && (
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          ✨ Steg 3: Ersätt med balanserad tanke
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          Skapa en mer balanserad och hjälpsam tanke baserat på bevisen från föregående steg.
                        </p>

                        {/* Current Thought vs Evidence Display */}
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Din negativa tanke:</p>
                              <p className="text-red-600 dark:text-red-400 text-sm italic">"{userThoughts.negative}"</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Din evidens-analys:</p>
                              <p className="text-blue-600 dark:text-blue-400 text-sm line-clamp-3">{userThoughts.evidence || 'Ingen analys angiven'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Balanced Thought Examples */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-4 text-left">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Exempel på balanserade tankar:</p>
                          <ul className="text-xs text-green-600 dark:text-green-400 space-y-1">
                            <li>• "Jag gör mitt bästa och det räcker ofta"</li>
                            <li>• "Misslyckanden är lärande tillfällen"</li>
                            <li>• "Jag har både styrkor och utmaningar, som alla andra"</li>
                            <li>• "Jag kan hantera utmaningar ett steg i taget"</li>
                          </ul>
                        </div>

                        {kbtDistortionInsights.length > 0 && (
                          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg mb-4 text-left border border-teal-100 dark:border-teal-800">
                            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300 mb-1">Riktad omformuleringshjalp</p>
                            <p className="text-sm text-teal-700 dark:text-teal-300">Utga fran: <strong>{kbtDistortionInsights[0].label}</strong></p>
                            <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">Prova att besvara: {kbtDistortionInsights[0].reframeQuestion}</p>
                          </div>
                        )}

                        <textarea
                          value={userThoughts.alternative}
                          onChange={(e) => handleThoughtChange('alternative', e.target.value)}
                          placeholder={`Skriv en balanserad tanke som svarar på:\n\"${userThoughts.negative || 'din tanke'}\"\nmed stöd av evidensen ovan.`}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={4}
                          minLength={KBT_MIN_ALTERNATIVE_LENGTH}
                          required
                        />
                        {userThoughts.alternative.trim().length < KBT_MIN_ALTERNATIVE_LENGTH && userThoughts.alternative.trim().length > 0 && (
                          <p className="text-red-500 text-sm mt-1">Skriv minst {KBT_MIN_ALTERNATIVE_LENGTH} tecken för att fortsätta</p>
                        )}
                      </div>
                    )}

                    {kbtPhase === 'practice' && (
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          🧘 Steg 4: Öva den nya tanken
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          Upprepa din balanserade tanke flera gånger. Känn hur den känns.
                        </p>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                          <p className="text-lg font-medium text-purple-700 dark:text-purple-300 mb-2">
                            "{userThoughts.alternative || 'Din balanserade tanke kommer här...'}"
                          </p>
                          <p className="text-sm text-purple-600 dark:text-purple-400">
                            Upprepa denna tanke och känn skillnaden i ditt sinne.
                          </p>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Utgångstanke</p>
                            <p className="text-sm text-red-600 dark:text-red-400 italic">"{userThoughts.negative || 'Ingen negativ tanke angiven'}"</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Din evidens</p>
                            <p className="text-sm text-blue-600 dark:text-blue-400 line-clamp-4">{userThoughts.evidence || 'Ingen evidensanalys angiven'}</p>
                          </div>
                        </div>

                        <div className="mt-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-belief-after" className="text-sm font-medium text-green-700 dark:text-green-300 block mb-1">
                            Hur trovärdig känns den nya tanken nu? ({kbtBeliefAfter ?? 0}%)
                          </label>
                          <input
                            id="kbt-belief-after"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={kbtBeliefAfter ?? 0}
                            onChange={(e) => setKbtBeliefAfter(Number(e.target.value))}
                            className="w-full accent-green-600"
                          />
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            När du klickar "Nästa steg" sparas detta som din efter-skattning.
                          </p>
                        </div>

                        <div className="mt-4 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-stress-after" className="text-sm font-medium text-rose-700 dark:text-rose-300 block mb-1">
                            Hur stark ar stressen nu efter ovningen? ({kbtStressAfter ?? 0}/100)
                          </label>
                          <input
                            id="kbt-stress-after"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={kbtStressAfter ?? 0}
                            onChange={(e) => setKbtStressAfter(Number(e.target.value))}
                            className="w-full accent-rose-600"
                          />
                        </div>

                        <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-execution-confidence-after" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 block mb-1">
                            Hur trygg ar du att faktiskt genomfora planen i vardagen? ({kbtExecutionConfidenceAfter ?? 0}%)
                          </label>
                          <input
                            id="kbt-execution-confidence-after"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={kbtExecutionConfidenceAfter ?? 0}
                            onChange={(e) => setKbtExecutionConfidenceAfter(Number(e.target.value))}
                            className="w-full accent-emerald-600"
                          />
                        </div>

                        <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-action-plan" className="text-sm font-medium text-indigo-700 dark:text-indigo-300 block mb-1">
                            Vad ar ett konkret mikro-steg du kan gora inom 24 timmar?
                          </label>
                          <textarea
                            id="kbt-action-plan"
                            value={kbtActionPlan}
                            onChange={(e) => setKbtActionPlan(e.target.value)}
                            placeholder="Exempel: Nar stressen kommer pa jobbet, tar jag 2 minuter och skriver en For/Emot-lista innan jag agerar."
                            className="w-full p-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            rows={3}
                            minLength={KBT_MIN_ACTION_PLAN_LENGTH}
                          />
                          {kbtActionPlan.trim().length > 0 && kbtActionPlan.trim().length < KBT_MIN_ACTION_PLAN_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_ACTION_PLAN_LENGTH} tecken for ett tydligt handlingssteg.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 bg-violet-50 dark:bg-violet-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-experiment-hypothesis" className="text-sm font-medium text-violet-700 dark:text-violet-300 block mb-1">
                            Beteendeexperiment: Vad tror du hander om du foljer den nya tanken?
                          </label>
                          <textarea
                            id="kbt-experiment-hypothesis"
                            value={kbtExperimentHypothesis}
                            onChange={(e) => setKbtExperimentHypothesis(e.target.value)}
                            placeholder="Exempel: Om jag genomfor uppgiften stegvis kommer stressen minska inom 10 minuter."
                            className="w-full p-3 border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            rows={3}
                            minLength={KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH}
                          />
                          {kbtExperimentHypothesis.trim().length > 0 && kbtExperimentHypothesis.trim().length < KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH} tecken for en testbar hypotes.
                            </p>
                          )}

                          <label htmlFor="kbt-experiment-measure" className="text-sm font-medium text-violet-700 dark:text-violet-300 block mt-3 mb-1">
                            Vad observerar du for att se om hypotesen stammer?
                          </label>
                          <textarea
                            id="kbt-experiment-measure"
                            value={kbtExperimentMeasure}
                            onChange={(e) => setKbtExperimentMeasure(e.target.value)}
                            placeholder="Exempel: Jag skattar stress var 5:e minut och noterar om jag faktiskt fortsatter uppgiften."
                            className="w-full p-3 border border-violet-200 dark:border-violet-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            rows={2}
                            minLength={KBT_MIN_EXPERIMENT_MEASURE_LENGTH}
                          />
                          {kbtExperimentMeasure.trim().length > 0 && kbtExperimentMeasure.trim().length < KBT_MIN_EXPERIMENT_MEASURE_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_EXPERIMENT_MEASURE_LENGTH} tecken for ett tydligt observationsmatt.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 bg-cyan-50 dark:bg-cyan-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-if-then-plan" className="text-sm font-medium text-cyan-700 dark:text-cyan-300 block mb-1">
                            Om-sa plan: Om stressen slar till, vad gor du da direkt?
                          </label>
                          <textarea
                            id="kbt-if-then-plan"
                            value={kbtIfThenPlan}
                            onChange={(e) => setKbtIfThenPlan(e.target.value)}
                            placeholder="Exempel: Om jag fastnar i oro, sa tar jag tre lugna andetag och gor forsta 2-minuterssteget i uppgiften."
                            className="w-full p-3 border border-cyan-200 dark:border-cyan-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            rows={3}
                            minLength={KBT_MIN_IF_THEN_PLAN_LENGTH}
                          />
                          {kbtIfThenPlan.trim().length > 0 && kbtIfThenPlan.trim().length < KBT_MIN_IF_THEN_PLAN_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_IF_THEN_PLAN_LENGTH} tecken for en tydlig om-sa plan.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 bg-lime-50 dark:bg-lime-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-coping-card" className="text-sm font-medium text-lime-700 dark:text-lime-300 block mb-1">
                            Coping-kort: Skriv en kort mening du kan lasa nar stressen stiger.
                          </label>
                          <textarea
                            id="kbt-coping-card"
                            value={kbtCopingCard}
                            onChange={(e) => setKbtCopingCard(e.target.value)}
                            placeholder="Exempel: Jag tar ett steg i taget, och jag behover inte vara perfekt for att gora framsteg."
                            className="w-full p-3 border border-lime-200 dark:border-lime-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            rows={2}
                            minLength={KBT_MIN_COPING_CARD_LENGTH}
                          />
                          {kbtCopingCard.trim().length > 0 && kbtCopingCard.trim().length < KBT_MIN_COPING_CARD_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_COPING_CARD_LENGTH} tecken for ett anvandbart coping-kort.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-obstacle-plan" className="text-sm font-medium text-amber-700 dark:text-amber-300 block mb-1">
                            Vilket hinder ar mest sannolikt, och hur svarar du om det uppstar?
                          </label>
                          <textarea
                            id="kbt-obstacle-plan"
                            value={kbtObstaclePlan}
                            onChange={(e) => setKbtObstaclePlan(e.target.value)}
                            placeholder="Exempel: Om jag undviker uppgiften efter lunch, da tar jag 5 minuter och borjar med minsta mojliga delsteg."
                            className="w-full p-3 border border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            rows={3}
                            minLength={KBT_MIN_OBSTACLE_PLAN_LENGTH}
                          />
                          {kbtObstaclePlan.trim().length > 0 && kbtObstaclePlan.trim().length < KBT_MIN_OBSTACLE_PLAN_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_OBSTACLE_PLAN_LENGTH} tecken for en tydlig hinderplan.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 bg-sky-50 dark:bg-sky-900/20 p-3 rounded-lg text-left">
                          <label htmlFor="kbt-follow-up-window" className="text-sm font-medium text-sky-700 dark:text-sky-300 block mb-1">
                            Nar repeterar du den balanserade tanken nasta gang?
                          </label>
                          <select
                            id="kbt-follow-up-window"
                            value={kbtFollowUpWindow}
                            onChange={(e) => setKbtFollowUpWindow(e.target.value)}
                            className="w-full p-2 border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          >
                            <option value="I kväll">I kväll</option>
                            <option value="I morgon bitti">I morgon bitti</option>
                            <option value="Inom 48 timmar">Inom 48 timmar</option>
                          </select>

                          <label htmlFor="kbt-rehearsal-context" className="text-sm font-medium text-sky-700 dark:text-sky-300 block mt-3 mb-1">
                            Var eller i vilken situation gor du repetitionen?
                          </label>
                          <textarea
                            id="kbt-rehearsal-context"
                            value={kbtRehearsalContext}
                            onChange={(e) => setKbtRehearsalContext(e.target.value)}
                            placeholder="Exempel: Pa bussen till jobbet, eller innan forsta motet pa morgonen."
                            className="w-full p-3 border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            rows={2}
                            minLength={KBT_MIN_REHEARSAL_CONTEXT_LENGTH}
                          />
                          {kbtRehearsalContext.trim().length > 0 && kbtRehearsalContext.trim().length < KBT_MIN_REHEARSAL_CONTEXT_LENGTH && (
                            <p className="text-red-500 text-sm mt-1">
                              Skriv minst {KBT_MIN_REHEARSAL_CONTEXT_LENGTH} tecken for tydligt sammanhang.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {kbtPhase === 'complete' && (
                      <div className="text-center">
                        {(() => {
                          const adaptiveFeedback = getKbtAdaptiveFeedback(kbtBeliefBefore, kbtBeliefAfter);
                          const stressFeedback = getKbtStressFeedback(kbtStressBefore, kbtStressAfter);
                          const quality = calculateKbtSessionQuality({
                            beliefBefore: kbtBeliefBefore,
                            beliefAfter: kbtBeliefAfter,
                            negative: userThoughts.negative,
                            evidence: userThoughts.evidence,
                            alternative: userThoughts.alternative,
                            actionPlan: kbtActionPlan,
                            obstaclePlan: kbtObstaclePlan,
                            rehearsalContext: kbtRehearsalContext,
                            experimentHypothesis: kbtExperimentHypothesis,
                            experimentMeasure: kbtExperimentMeasure,
                            socraticReflection: kbtSocraticReflection,
                            ifThenPlan: kbtIfThenPlan,
                            copingCard: kbtCopingCard,
                            executionConfidenceAfter: kbtExecutionConfidenceAfter,
                          });
                          return (
                            <>
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-3 text-left border border-blue-100 dark:border-blue-800">
                                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">{adaptiveFeedback.title}</p>
                                <p className="text-sm text-blue-700 dark:text-blue-300">{adaptiveFeedback.message}</p>
                              </div>
                              <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-lg mb-4 text-left border border-sky-100 dark:border-sky-800">
                                <p className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-1">Sessionens kvalitet: {quality.score}/100</p>
                                <p className="text-sm text-sky-700 dark:text-sky-300">{quality.label}</p>
                              </div>
                              <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg mb-4 text-left border border-rose-100 dark:border-rose-800">
                                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 mb-1">{stressFeedback.title}</p>
                                <p className="text-sm text-rose-700 dark:text-rose-300">{stressFeedback.message}</p>
                              </div>
                            </>
                          );
                        })()}
                        <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
                          ✅ KBT-övning Slutförd!
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          Bra jobbat! Du har framgångsrikt utmanat och ersatt en stressig tanke.
                        </p>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <h5 className="font-semibold text-green-700 dark:text-green-300 mb-2">Dina framsteg:</h5>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            <strong>Negativ tanke:</strong> {userThoughts.negative || 'Ingen angiven'}<br />
                            <strong>Balanserad tanke:</strong> {userThoughts.alternative || 'Ingen angiven'}
                          </p>
                          {typeof kbtBeliefBefore === 'number' && typeof kbtBeliefAfter === 'number' && (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-3">
                              <strong>Skattning:</strong> Från {kbtBeliefBefore}% till {kbtBeliefAfter}% ({kbtBeliefAfter - kbtBeliefBefore >= 0 ? '+' : ''}{kbtBeliefAfter - kbtBeliefBefore} procentenheter)
                            </p>
                          )}
                          {typeof kbtStressBefore === 'number' && typeof kbtStressAfter === 'number' && (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                              <strong>Stressnivå:</strong> Från {kbtStressBefore}/100 till {kbtStressAfter}/100 ({kbtStressAfter - kbtStressBefore <= 0 ? '' : '+'}{kbtStressAfter - kbtStressBefore})
                            </p>
                          )}
                          {typeof kbtExecutionConfidenceAfter === 'number' && (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                              <strong>Genomforandetillit:</strong> {kbtExecutionConfidenceAfter}%
                            </p>
                          )}
                          <p className="text-sm text-green-700 dark:text-green-300 mt-3">
                            <strong>Ditt nästa steg:</strong> {kbtActionPlan || 'Inget handlingssteg angivet'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Din hinderplan:</strong> {kbtObstaclePlan || 'Ingen hinderplan angiven'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Experimenthypotes:</strong> {kbtExperimentHypothesis || 'Ingen hypotes angiven'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Vad du observerar:</strong> {kbtExperimentMeasure || 'Inget observationsmatt angivet'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Sokratisk reflektion:</strong> {kbtSocraticReflection || 'Ingen reflektion angiven'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Om-sa plan:</strong> {kbtIfThenPlan || 'Ingen om-sa plan angiven'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Coping-kort:</strong> {kbtCopingCard || 'Inget coping-kort angivet'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                            <strong>Uppföljning:</strong> {kbtFollowUpWindow} ({kbtRehearsalContext || 'Sammanhang ej angivet'})
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Control Buttons */}
                  <div className="flex justify-center gap-3 mt-6">
                    {!isKbtActive ? (
                      <button
                        onClick={startKbtFlow}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                      >
                        🚀 Starta KBT-övning
                      </button>
                    ) : kbtPhase !== 'complete' ? (
                      <>
                        <button
                          onClick={handleNextKbtPhase}
                          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                        >
                          Nästa Steg →
                        </button>
                        <button
                          onClick={stopKbtExercise}
                          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                        >
                          ⏹️ Stoppa
                        </button>
                      </>
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
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    📝 Journaling för Mental Klarhet
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    Skriv ner dina tankar för att skapa klarhet och få perspektiv på dina känslor.
                  </p>

                  {/* Journal Input */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dina Tankar & Känslor
                      </label>
                      <textarea
                        value={journalContent}
                        onChange={(e) => setJournalContent(e.target.value)}
                        placeholder="Skriv fritt om vad som händer i ditt liv just nu... Vad känner du? Vad tänker du? Vad har hänt idag?"
                        className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        disabled={isSavingJournal}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {journalContent.length} tecken
                      </p>
                    </div>

                    {/* Mood Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Humör (valfritt)
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mood) => (
                          <button
                            key={mood}
                            onClick={() => setJournalMood(journalMood === mood ? undefined : mood)}
                            className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${journalMood === mood
                              ? 'bg-blue-500 text-white scale-110'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                              } `}
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Taggar (valfritt)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['stress', 'ångest', 'glädje', 'oro', 'tacksamhet', 'reflektion', 'mål', 'relationer'].map((tag) => (
                          <button
                            key={tag}
                            onClick={() => {
                              setJournalTags(prev =>
                                prev.includes(tag)
                                  ? prev.filter(t => t !== tag)
                                  : [...prev, tag]
                              );
                            }}
                            className={`px-3 py-1 rounded-full text-sm transition-all ${journalTags.includes(tag)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                              } `}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Journal History Toggle */}
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => setShowJournalHistory(!showJournalHistory)}
                      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <span>{showJournalHistory ? '▼' : '▶'}</span>
                      {showJournalHistory ? 'Dölj tidigare anteckningar' : 'Visa tidigare anteckningar'}
                      {journalEntries.length > 0 && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">
                          {journalEntries.length}
                        </span>
                      )}
                    </button>

                    {showJournalHistory && (
                      <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                        {isLoadingJournal ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Laddar journal...</p>
                          </div>
                        ) : journalEntries.length > 0 ? (
                          journalEntries.map((entry: any) => (
                            <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(entry.createdAt).toLocaleDateString('sv-SE')}
                                </span>
                                {entry.mood && (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                    Humör: {entry.mood}/10
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {entry.content}
                              </p>
                              {entry.tags && entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {entry.tags.map((tag: string) => (
                                    <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            Inga tidigare journalanteckningar än.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Control Buttons */}
                  <div className="flex justify-center gap-3 mt-6">
                    <button
                      onClick={handleSaveJournalEntry}
                      disabled={!journalContent.trim() || isSavingJournal}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      {isSavingJournal ? '💾 Sparar...' : '📝 Spara Journalanteckning'}
                    </button>
                    <button
                      onClick={handleCloseContentModal}
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Stäng
                    </button>
                  </div>
                </div>
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
                              saveGratitudeEntry(gratitudeDay, currentEntries).then(() => {
                                nextGratitudeDay();
                              });
                            } else {
                              announceToScreenReader('Skriv minst 3 saker du är tacksam för', 'assertive');
                            }
                          }}
                          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                          disabled={(gratitudeEntries[gratitudeDay] || []).filter(e => e.trim()).length < 3 || isSavingGratitude || (gratitudeEntries[gratitudeDay] && gratitudeEntries[gratitudeDay].filter(e => e.trim()).length >= 3)}
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
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 mb-4 border-2 border-green-200 dark:border-green-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    💆 Progressiv Muskelavslappning
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                    Följ guiden genom olika muskelgrupper för djup avslappning
                  </p>

                  {/* Progress Indicator */}
                  <div className="flex justify-center mb-6">
                    <div className="flex items-center space-x-1">
                      {muscleGroups.map((group, index) => (
                        <div
                          key={group.name}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${index < currentMuscleGroup
                            ? 'bg-green-500 text-white shadow-lg'
                            : index === currentMuscleGroup && isRelaxationActive
                              ? 'bg-blue-500 text-white animate-pulse shadow-lg scale-110'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            } `}
                          title={group.name}
                        >
                          {group.image}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settings Panel */}
                  {!isRelaxationActive && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        ⚙️ Anpassa Övning
                      </h4>
                      <div className="space-y-3">
                        {/* Difficulty Level */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Svårighetsgrad
                          </label>
                          <select
                            value={relaxationDifficulty}
                            onChange={(e) => setRelaxationDifficulty(e.target.value as any)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          >
                            <option value="beginner">Nybörjare (5s spänn, 10s slappna)</option>
                            <option value="intermediate">Medel (7s spänn, 15s slappna)</option>
                            <option value="advanced">Avancerad (10s spänn, 20s slappna)</option>
                          </select>
                        </div>

                        {/* Custom Timing */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Spänn (sekunder)
                            </label>
                            <input
                              type="number"
                              min="3"
                              max="15"
                              value={customTiming.tense}
                              onChange={(e) => setCustomTiming(prev => ({ ...prev, tense: parseInt(e.target.value) || 5 }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Slappna (sekunder)
                            </label>
                            <input
                              type="number"
                              min="5"
                              max="30"
                              value={customTiming.relax}
                              onChange={(e) => setCustomTiming(prev => ({ ...prev, relax: parseInt(e.target.value) || 10 }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Breathing Sync */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            🫁 Andningssynkronisering
                          </label>
                          <button
                            onClick={() => setBreathingSync(!breathingSync)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${breathingSync ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                              } `}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${breathingSync ? 'translate-x-6' : 'translate-x-1'
                                } `}
                            />
                          </button>
                        </div>

                        {/* Session History */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            📊 Tidigare Sessioner
                          </label>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {sessionHistory.length > 0 ? (
                              <div className="space-y-1">
                                {sessionHistory.slice(-3).map((session: any) => (
                                  <div key={session.date} className="flex justify-between">
                                    <span>{new Date(session.date).toLocaleDateString()}</span>
                                    <span>{session.duration}min</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span>Inga tidigare sessioner</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current Instruction */}
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-4">
                      {relaxationPhase === 'prepare' && '🧘'}
                      {relaxationPhase === 'tense' && '💪'}
                      {relaxationPhase === 'relax' && '😌'}
                      {relaxationPhase === 'completed' && '🎉'}
                    </div>

                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {relaxationPhase === 'prepare' && 'Förberedelse'}
                      {relaxationPhase === 'tense' && `Spänn: ${muscleGroups[currentMuscleGroup]?.name || 'musklerna'} `}
                      {relaxationPhase === 'relax' && `Slappna av: ${muscleGroups[currentMuscleGroup]?.name || 'musklerna'} `}
                      {relaxationPhase === 'completed' && 'Övning slutförd!'}
                    </h4>

                    <div className="text-center mb-4">
                      {/* Visual representation */}
                      {relaxationPhase === 'tense' && muscleGroups[currentMuscleGroup] && (
                        <div className="mb-3">
                          <div className="text-6xl mb-2 animate-pulse">
                            {muscleGroups[currentMuscleGroup].image}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                            {muscleGroups[currentMuscleGroup].visual}
                          </p>
                        </div>
                      )}

                      {/* Breathing Guide when enabled */}
                      {breathingSync && isRelaxationActive && relaxationPhase !== 'completed' && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-2xl">🫁</span>
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              {relaxationPhase === 'tense' ? 'Andas in när du spänner...' :
                                relaxationPhase === 'relax' ? 'Andas ut när du slappnar...' :
                                  'Andas lugnt och naturligt...'}
                            </span>
                          </div>
                          <div className="flex justify-center">
                            <div className={`w-16 h-16 rounded-full border-4 transition-all duration-1000 ${relaxationPhase === 'tense' ? 'border-green-400 bg-green-100 scale-125' :
                              relaxationPhase === 'relax' ? 'border-blue-400 bg-blue-100 scale-90' :
                                'border-gray-300 bg-gray-50 scale-100'
                              } `}></div>
                          </div>
                        </div>
                      )}

                      <p className="text-gray-700 dark:text-gray-300">
                        {relaxationPhase === 'prepare' && 'Sitt eller ligg bekvämt. Andas lugnt.'}
                        {relaxationPhase === 'tense' && muscleGroups[currentMuscleGroup]?.instruction}
                        {relaxationPhase === 'relax' && 'Släpp spänningen långsamt och känn avslappningen...'}
                        {relaxationPhase === 'completed' && 'Bra jobbat! Du har genomfört progressiv muskelavslappning.'}
                      </p>
                    </div>

                    {/* Timer */}
                    {isRelaxationActive && relaxationPhase !== 'completed' && (
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">
                        {relaxationCount}
                      </div>
                    )}
                  </div>

                  {/* Control Buttons */}
                  <div className="flex justify-center gap-3">
                    {!isRelaxationActive ? (
                      <button
                        onClick={startProgressiveRelaxation}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                      >
                        🚀 Starta Muskelavslappning
                      </button>
                    ) : relaxationPhase !== 'completed' ? (
                      <button
                        onClick={stopProgressiveRelaxation}
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
                </div>
              )}

              {/* Generic Meditation Player */}
              {selectedRecommendation.type === 'meditation' && !['stress-1', 'stress-3'].includes(selectedRecommendation.id) && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-8 mb-6 border-2 border-purple-200 dark:border-purple-800 text-center shadow-lg">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => !isMeditationActive && startMeditationSession(selectedRecommendation.duration || 10)}
                      className="w-40 h-40 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center mb-8 relative shadow-inner group transition-all"
                    >
                      <div className={`absolute inset-0 rounded-full border-4 border-purple-500/20 ${!isMeditationPaused && isMeditationActive ? 'animate-ping' : ''}`} />
                      <span className={`text-6xl transition-transform ${!isMeditationPaused && isMeditationActive ? 'scale-110' : 'group-hover:scale-110'}`} role="img" aria-label="meditation">🧘</span>
                    </button>

                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedRecommendation.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm">
                      {isMeditationActive ? 'Fokusera på din andning och var närvarande i nuet.' : 'Redo att börja? Hitta en bekväm position.'}
                    </p>

                    <div className="text-6xl font-mono font-bold text-purple-600 dark:text-purple-400 mb-10 tracking-widest bg-white dark:bg-gray-800 px-8 py-4 rounded-3xl shadow-lg border border-purple-100 dark:border-purple-900">
                      {formatTime(meditationTimeLeft || (selectedRecommendation.duration || 10) * 60)}
                    </div>

                    <div className="flex items-center gap-6">
                      <button
                        onClick={stopMeditationSession}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all text-gray-600 dark:text-gray-300"
                        title="Stoppa"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                      </button>

                      <button
                        onClick={toggleMeditationPause}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xl hover:scale-105 active:scale-95"
                      >
                        {isMeditationPaused || !isMeditationActive ? (
                          <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        ) : (
                          <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        )}
                      </button>

                      <button
                        onClick={handleMeditationComplete}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-all text-green-600 dark:text-green-400"
                        title="Snabb-slutför"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </button>
                    </div>

                    {!isMeditationActive && meditationTimeLeft === 0 && (
                      <div className="mt-8 animate-bounce">
                        <p className="text-green-600 dark:text-green-400 font-bold text-xl">✨ Passet Slutfört! ✨</p>
                      </div>
                    )}
                  </div>
                </div>
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
                  Slutför {targetCycles} cykler först. När texten visar "Andningsövning slutförd" kan du markera aktiviteten.
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
          {(() => {
            logger.debug('🎯 RENDERING PROGRESS UI - current userProgress:', userProgress);
            return null;
          })()}
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



