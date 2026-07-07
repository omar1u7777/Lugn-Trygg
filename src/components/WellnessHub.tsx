import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SparklesIcon,
  MusicalNoteIcon,
  HandRaisedIcon,
  CloudIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  HeartIcon,
  FireIcon,
  MoonIcon,
  SunIcon,
  ArrowRightIcon,
  PencilSquareIcon,
  XMarkIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import RelaxingSounds from './RelaxingSounds';
import WellnessGoalsOnboarding from './Wellness/WellnessGoalsOnboarding';
import useAuth from '../hooks/useAuth';
import { getMoods, saveMeditationSession, getMeditationSessions, getWellnessGoals } from '../api/api';
import { getWellnessGoalIcon } from '../constants/wellnessGoals';
import { Button } from './ui/tailwind'; // Keep compatible
import OptimizedImage from './ui/OptimizedImage';
import { getWellnessHeroImageId } from '../config/env';
import { logger } from '../utils/logger';
const BreathingExercise = lazy(() => import('./recommendations/BreathingExercise').then(m => ({ default: m.BreathingExercise })));


// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

const WELLNESS_HERO_IMAGE_ID = getWellnessHeroImageId();
const WELLNESS_HERO_FALLBACK_SRC = 'https://res.cloudinary.com/dxmijbysc/image/upload/c_scale,w_auto,dpr_auto,q_auto,f_auto/hero-bild_pfcdsx.jpg';

interface WellnessStats {
  meditationMinutes: number;
  breathingExercises: number;
  relaxationSessions: number;
  streakDays: number;
}

type SessionType = MeditationOption['type'];

interface MeditationOption {
  id: string;
  title: string;
  duration: number;
  type: 'guided_meditation' | 'breathing_exercise' | 'soundscape';
  description: string;
  image?: string; // Placeholder for future images
  color?: string;
  icon?: React.ReactNode;
}

interface ActivityRecord {
  created_at?: string;
  createdAt?: string;
  date?: string;
  timestamp?: string;
  [key: string]: unknown;
}

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseRecordDate = (record: ActivityRecord): Date | null => {
  const candidate = [record.created_at, record.createdAt, record.date, record.timestamp]
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  if (!candidate || typeof candidate !== 'string') {
    return null;
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateCurrentStreak = (records: ActivityRecord[]): number => {
  const daySet = new Set<string>();

  records.forEach((record) => {
    const parsedDate = parseRecordDate(record);
    if (parsedDate) {
      daySet.add(toDateKey(parsedDate));
    }
  });

  if (daySet.size === 0) {
    return 0;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor: Date | null = daySet.has(toDateKey(today)) ? today : daySet.has(toDateKey(yesterday)) ? yesterday : null;
  if (!cursor) {
    return 0;
  }

  let streak = 0;
  while (daySet.has(toDateKey(cursor))) {
    streak += 1;
    const prevDay = new Date(cursor);
    prevDay.setDate(prevDay.getDate() - 1);
    cursor = prevDay;
  }

  return streak;
};

export const calculateWellnessStreak = (records: ActivityRecord[]): number =>
  calculateCurrentStreak(records);

export const applySessionCompletionStats = (
  prevStats: WellnessStats,
  sessionType: SessionType,
  durationMinutes: number
): WellnessStats => {
  const safeDuration = Math.max(1, Math.round(durationMinutes));

  const isMindfulness = sessionType === 'guided_meditation' || sessionType === 'soundscape';
  const isBreathing = sessionType === 'breathing_exercise';

  return {
    ...prevStats,
    meditationMinutes: isMindfulness ? prevStats.meditationMinutes + safeDuration : prevStats.meditationMinutes,
    breathingExercises: isBreathing ? prevStats.breathingExercises + 1 : prevStats.breathingExercises,
    relaxationSessions: !isBreathing && !isMindfulness ? prevStats.relaxationSessions + 1 : prevStats.relaxationSessions,
  };
};

const formatStreakLabel = (days: number, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const normalized = Math.max(0, days);
  return t('wellnessHub.streakDays', { count: normalized });
};

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------

const SLEEP_STORY_URLS: Record<string, string> = {
  's1': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
  's2': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg',
  's3': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Meditation_im_Liegen_%2820_Min.%29.ogg',
};

// Audio URLs for guided meditations (ambient sounds as guided audio fallback)
const MEDITATION_AUDIO_URLS: Record<string, string> = {
  '1': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
  '2': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Meditation_im_Liegen_%2820_Min.%29.ogg',
  '3': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg',
};

const CategoryPill: React.FC<{
  active: boolean;
  label: string;
  icon: React.ReactNode;
  testId?: string;
  onClick: () => void
}> = ({ active, label, icon, testId, onClick }) => (
  <button
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    data-testid={testId}
    className={`
      flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105
      ${active
        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 ring-2 ring-primary-600 ring-offset-2 dark:ring-offset-slate-900'
        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400'}
    `}
  >
    {icon}
    {label}
  </button>
);

const BentoCard: React.FC<{
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  imageHtml?: React.ReactNode;
  accentColor?: string;
}> = ({ children, className = '', onClick, title, subtitle, icon, imageHtml, accentColor = 'bg-primary-500' }) => (
  <div
    onClick={onClick}
    className={`
      group relative overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-slate-900/50 transition-all duration-500 cursor-pointer
      ${className}
    `}
  >
    {imageHtml && (
      <div className="absolute inset-0 z-0 transition-transform duration-700 group-hover:scale-110 opacity-90">
        {imageHtml}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>
    )}

    <div className={`relative z-10 p-6 h-full flex flex-col ${imageHtml ? 'justify-end text-white' : ''}`}>
      {(icon || title) && (
        <div className="mb-auto w-full flex justify-between items-start">
          {icon && (
            <div className={`w-10 h-10 rounded-2xl ${imageHtml ? 'bg-white/20 backdrop-blur-md' : accentColor + ' bg-opacity-10 text-primary-600'} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:rotate-6`}>
              {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${imageHtml ? 'text-white' : ''}` })}
            </div>
          )}
        </div>
      )}

      <div>
        {title && <h3 className={`text-xl font-bold mb-1 ${imageHtml ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{title}</h3>}
        {subtitle && <p className={`text-sm ${imageHtml ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{subtitle}</p>}
        {children}
      </div>

      {imageHtml && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
          <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
            <ArrowRightIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  </div>
);

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const WellnessHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<'all' | 'meditation' | 'breathing' | 'sounds' | 'sleep'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // State
  const [wellnessStats, setWellnessStats] = useState<WellnessStats>({
    meditationMinutes: 0,
    breathingExercises: 0,
    relaxationSessions: 0,
    streakDays: 0
  });
  const [userGoals, setUserGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Meditation Playback State
  const [selectedMeditation, setSelectedMeditation] = useState<MeditationOption | null>(null);
  const [isMeditationActive, setIsMeditationActive] = useState(false);
  const [meditationTimeLeft, setMeditationTimeLeft] = useState(0);
  const [meditationStartTime, setMeditationStartTime] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const meditationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedDurationMsRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<Date | null>(null);
  const completeMeditationRef = useRef<() => Promise<void>>();
  const meditationAudioRef = useRef<HTMLAudioElement | null>(null);
  const sleepSectionRef = useRef<HTMLElement | null>(null);

  // UI State
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [activeBreathingExercise, setActiveBreathingExercise] = useState<MeditationOption | null>(null);
  const [selectedSleepStory, setSelectedSleepStory] = useState<MeditationOption | null>(null);
  const [sleepStoryPlaying, setSleepStoryPlaying] = useState(false);
  const [sleepStoryTimeLeft, setSleepStoryTimeLeft] = useState(0);
  const sleepStoryAudioRef = useRef<HTMLAudioElement | null>(null);
  const sleepStoryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----------------------------------------------------------------------
  // Data Fetching
  // ----------------------------------------------------------------------

  const fetchWellnessData = useCallback(async () => {
    if (!user?.user_id) { setLoading(false); return; }

    // Cancel any in-flight request to prevent race conditions and state updates on unmount
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      // Parallel Fetch
      const [moodsResult, sessionsResult, goalsResult] = await Promise.allSettled([
        getMoods(user.user_id),
        getMeditationSessions(100),
        getWellnessGoals()
      ]);

      if (controller.signal.aborted) return;

      const moods = moodsResult.status === 'fulfilled' ? moodsResult.value : [];
      const sessionData = sessionsResult.status === 'fulfilled' ? sessionsResult.value : { sessions: [] };
      const sessions = sessionData.sessions || [];
      const activeGoals = goalsResult.status === 'fulfilled' ? goalsResult.value : [];

      setUserGoals(activeGoals);

      // Calculate Stats
      let mins = 0;
      let breathing = 0;
      let relax = 0;

      type SessionItem = { type?: string; duration?: number };
      (sessions as SessionItem[]).forEach((s) => {
        if (s.type === 'breathing_exercise') {
          breathing++;
        } else if (s.type === 'guided_meditation' || s.type === 'soundscape') {
          mins += s.duration || 0;
        } else {
          relax++;
        }
      });

      const streak = calculateCurrentStreak([
        ...(Array.isArray(moods) ? moods : []),
        ...(Array.isArray(sessions) ? sessions : [])
      ]);

      setWellnessStats({
        meditationMinutes: mins, // Real data only — no fabricated fallback
        breathingExercises: breathing,
        relaxationSessions: relax,
        streakDays: streak
      });

    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 401) {
        setError(t('wellnessHub.loadError', 'Kunde inte ladda wellness-data.'));
      }
      logger.error('Failed to load wellness data:', err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [user?.user_id, t]);

  useEffect(() => {
    fetchWellnessData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchWellnessData]);
  useEffect(() => { return () => { if (meditationTimerRef.current) clearInterval(meditationTimerRef.current); if (meditationAudioRef.current) { meditationAudioRef.current.pause(); meditationAudioRef.current = null; } }; }, []);

  // ----------------------------------------------------------------------
  // Timer Logic
  // ----------------------------------------------------------------------

  const completeMeditation = async () => {
    if (!selectedMeditation || !meditationStartTime || !user?.user_id) return;
    // Subtract total paused time from raw elapsed time so saved duration reflects active playback only
    const rawElapsedMs = new Date().getTime() - meditationStartTime.getTime();
    const activeDurationMs = Math.max(0, rawElapsedMs - pausedDurationMsRef.current);
    const duration = Math.round(activeDurationMs / 1000 / 60); // mins
    const safeDuration = Math.max(1, duration);

    // Save to backend
    try {
      await saveMeditationSession({
        type: selectedMeditation.type,
        duration: safeDuration,
        technique: selectedMeditation.title,
        completedCycles: 1,
        notes: 'Completed session'
      });

      // Optimistic update
      setWellnessStats(prev => ({
        ...applySessionCompletionStats(prev, selectedMeditation.type, safeDuration)
      }));
    } catch (e) { logger.error('Failed to save meditation session:', e); }

    resetMeditationState();
  };

  // Keep ref current so interval callback always calls latest completeMeditation
  completeMeditationRef.current = completeMeditation;

  const resetMeditationState = () => {
    if (meditationTimerRef.current) clearInterval(meditationTimerRef.current);
    if (meditationAudioRef.current) {
      meditationAudioRef.current.pause();
      meditationAudioRef.current = null;
    }
    setIsMeditationActive(false);
    setSelectedMeditation(null);
    setMeditationTimeLeft(0);
    setMeditationStartTime(null);
    setIsPaused(false);
    pausedDurationMsRef.current = 0;
    pauseStartTimeRef.current = null;
  };

  const stopMeditation = async () => {
    // Save partial session if user started and at least some time elapsed
    if (selectedMeditation && meditationStartTime && user?.user_id) {
      const rawElapsedMs = new Date().getTime() - meditationStartTime.getTime();
      const activeDurationMs = Math.max(0, rawElapsedMs - pausedDurationMsRef.current);
      const duration = Math.round(activeDurationMs / 1000 / 60);
      if (duration >= 1) {
        try {
          await saveMeditationSession({
            type: selectedMeditation.type,
            duration,
            technique: selectedMeditation.title,
            completedCycles: 1,
            notes: 'Session stopped early by user'
          });
          setWellnessStats(prev => ({
            ...applySessionCompletionStats(prev, selectedMeditation.type, duration)
          }));
        } catch (e) { logger.error('Failed to save partial meditation session:', e); }
      }
    }
    resetMeditationState();
  };

  const startMeditation = (meditation: MeditationOption) => {
    setSelectedMeditation(meditation);
    setIsMeditationActive(true);
    setMeditationTimeLeft(meditation.duration * 60);
    setMeditationStartTime(new Date());
    setIsPaused(false);
    pausedDurationMsRef.current = 0;
    pauseStartTimeRef.current = null;
    if (meditationTimerRef.current) clearInterval(meditationTimerRef.current);

    // Play guided meditation audio
    const audioUrl = MEDITATION_AUDIO_URLS[meditation.id];
    if (audioUrl) {
      if (meditationAudioRef.current) {
        meditationAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audio.volume = 0.6;
      audio.preload = 'auto';
      audio.loop = true;
      meditationAudioRef.current = audio;
      audio.play()?.catch((e) => {
        logger.error('Meditation audio playback failed:', e);
      });
    }

    meditationTimerRef.current = setInterval(() => {
      setMeditationTimeLeft(prev => {
        if (prev <= 1) { completeMeditationRef.current?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const togglePause = () => {
    if (isPaused) {
      // Resume: accumulate paused duration
      if (pauseStartTimeRef.current) {
        pausedDurationMsRef.current += new Date().getTime() - pauseStartTimeRef.current.getTime();
      }
      pauseStartTimeRef.current = null;
      setIsPaused(false);
      if (meditationAudioRef.current) {
        meditationAudioRef.current.play()?.catch((e) => logger.error('Audio resume failed:', e));
      }
      meditationTimerRef.current = setInterval(() => {
        setMeditationTimeLeft(prev => {
          if (prev <= 1) { completeMeditationRef.current?.(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Pause
      if (meditationTimerRef.current) clearInterval(meditationTimerRef.current);
      if (meditationAudioRef.current) {
        meditationAudioRef.current.pause();
      }
      pauseStartTimeRef.current = new Date();
      setIsPaused(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Sleep Story Playback ──────────────────────────────────────────────

  const stopSleepStory = useCallback(() => {
    if (sleepStoryAudioRef.current) {
      sleepStoryAudioRef.current.pause();
      sleepStoryAudioRef.current = null;
    }
    if (sleepStoryTimerRef.current) {
      clearInterval(sleepStoryTimerRef.current);
      sleepStoryTimerRef.current = null;
    }
    setSleepStoryPlaying(false);
    setSleepStoryTimeLeft(0);
    setSelectedSleepStory(null);
  }, []);

  const playSleepStory = useCallback((story: MeditationOption) => {
    stopSleepStory();
    const url = SLEEP_STORY_URLS[story.id];
    if (!url) {
      logger.error('Sleep story playback failed: No URL for story', story.id);
      return;
    }

    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.preload = 'auto';
    sleepStoryAudioRef.current = audio;

    setSelectedSleepStory(story);
    setSleepStoryTimeLeft(story.duration * 60);
    setSleepStoryPlaying(true);

    audio.addEventListener('error', () => {
      logger.error('Sleep story playback failed: Audio load error for', story.id);
      stopSleepStory();
    });

    audio.addEventListener('ended', () => {
      logger.info('Sleep story ended naturally:', story.id);
      stopSleepStory();
    });

    audio.play()?.catch((e) => {
      logger.error('Sleep story playback failed:', e);
      stopSleepStory();
    });

    sleepStoryTimerRef.current = setInterval(() => {
      setSleepStoryTimeLeft((prev) => {
        if (prev <= 1) {
          stopSleepStory();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopSleepStory]);

  useEffect(() => {
    return () => {
      if (sleepStoryAudioRef.current) {
        sleepStoryAudioRef.current.pause();
        sleepStoryAudioRef.current = null;
      }
      if (sleepStoryTimerRef.current) {
        clearInterval(sleepStoryTimerRef.current);
      }
    };
  }, []);


  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------

  // Content Data – titles/descriptions from i18n
  type WellnessDataItem = { id: string; title: string; description: string };
  const wdMed = (t('wellnessData.meditations', { returnObjects: true }) as WellnessDataItem[]) || [];
  const wdBr  = (t('wellnessData.breathingExercises', { returnObjects: true }) as WellnessDataItem[]) || [];
  const wdSl  = (t('wellnessData.sleepStories', { returnObjects: true }) as WellnessDataItem[]) || [];

  const meditations: MeditationOption[] = [
    { id: '1', title: wdMed[0]?.title || 'Snabb Avkoppling', duration: 5, type: 'guided_meditation', description: wdMed[0]?.description || 'Perfekt för en paus', icon: <SparklesIcon /> },
    { id: '2', title: wdMed[1]?.title || 'Djup Sömn', duration: 20, type: 'guided_meditation', description: wdMed[1]?.description || 'Somna lättare ikväll', icon: <MoonIcon /> },
    { id: '3', title: wdMed[2]?.title || 'Morgonfokus', duration: 10, type: 'guided_meditation', description: wdMed[2]?.description || 'Starta dagen rätt', icon: <SunIcon /> },
  ];

  const breathingExercises: MeditationOption[] = [
    { id: 'b1', title: wdBr[0]?.title || '4-7-8 Andning', duration: 4, type: 'breathing_exercise', description: wdBr[0]?.description || 'För ångestdämpning', icon: <CloudIcon /> },
    { id: 'b2', title: wdBr[1]?.title || 'Fyrkantsandning', duration: 5, type: 'breathing_exercise', description: wdBr[1]?.description || 'För balans och lugn', icon: <StopIcon /> },
  ];

  const sleepStories: MeditationOption[] = [
    { id: 's1', title: wdSl[0]?.title || 'Stjärnresan', duration: 12, type: 'soundscape', description: wdSl[0]?.description || 'Lugn godnattsaga för nedvarvning', icon: <MoonIcon /> },
    { id: 's2', title: wdSl[1]?.title || 'Regnskogens vila', duration: 15, type: 'soundscape', description: wdSl[1]?.description || 'Mjuk berättelse med naturljud', icon: <MusicalNoteIcon /> },
    { id: 's3', title: wdSl[2]?.title || 'Havets andetag', duration: 20, type: 'soundscape', description: wdSl[2]?.description || 'Djup vila med havsrytm och guidning', icon: <CloudIcon /> },
  ];

  // Time-based daily recommendation (Fix 4)
  const currentHour = new Date().getHours();
  const dailyRecIndex = currentHour >= 5 && currentHour < 11 ? 2 : currentHour >= 11 && currentHour < 17 ? 0 : 1;
  const dailyRec = meditations[dailyRecIndex] || meditations[0];
  const dailyRecLabel = dailyRecIndex === 2 ? t('wellnessHub.morningFocus') : dailyRecIndex === 0 ? t('wellnessHub.quickRelax', 'Snabb avkoppling') : t('wellnessHub.deepSleep', 'Djup sömn');

  // Search filtering (Fix 10)
  const filterBySearch = (items: MeditationOption[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
  };
  const filteredMeditations = filterBySearch(meditations);
  const filteredBreathing = filterBySearch(breathingExercises);
  const filteredSleepStories = filterBySearch(sleepStories);

  return (
    <div className="min-h-screen pb-20 bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* 1. Header / Hero Section */}
      <div className="relative bg-white dark:bg-slate-900 pb-12 pt-8 sm:pt-12 px-4 sm:px-6 lg:px-8 shadow-sm rounded-b-[2.5rem]">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
                {t('wellnessHub.title')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                {t('wellnessHub.subtitle')}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                {t('wellnessHub.description')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Streak / Stats Badge — always visible (Fix 5) */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full border border-orange-100 dark:border-orange-800/50">
                <FireIcon className="w-5 h-5" />
                <span className="font-semibold text-sm sm:text-base">{formatStreakLabel(wellnessStats.streakDays, t)}</span>
              </div>
            </div>
          </header>

          {/* Hero Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-auto md:h-[420px]">
            {/* Main Hero Card */}
            <div className="md:col-span-2 lg:col-span-2 h-full">
              <BentoCard
                className="h-full min-h-[300px]"
                title={t('wellnessHub.dailyRec')}
                subtitle={t('wellnessHub.dailyRecSub')}
                imageHtml={<OptimizedImage src={WELLNESS_HERO_IMAGE_ID} alt="Wellness" className="w-full h-full object-cover" width={800} height={400} fallbackSrc={WELLNESS_HERO_FALLBACK_SRC} />}
                onClick={() => {
                  if (dailyRec) startMeditation(dailyRec);
                }}
              >
                <div className="mt-4" data-testid="wellness-daily-recommendation">
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/20">
                    {dailyRec.duration} min • {dailyRecLabel}
                  </span>
                </div>
              </BentoCard>
            </div>

            {/* Stats & Goals */}
            <div className="flex flex-col gap-6 h-full md:col-span-1 lg:col-span-1">
              <BentoCard
                className="flex-1 bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-900/20 dark:to-green-900/20"
                title={`${wellnessStats.meditationMinutes}m`}
                subtitle={t('wellnessHub.mindfulness')}
                icon={<HeartIcon />}
                accentColor="bg-teal-500"
              >
                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-slate-800/60 px-3 py-2">
                    <span>{t('wellnessHub.breathingSessions')}</span>
                    <strong>{wellnessStats.breathingExercises}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-slate-800/60 px-3 py-2">
                    <span>{t('wellnessHub.otherSessions')}</span>
                    <strong>{wellnessStats.relaxationSessions}</strong>
                  </div>
                </div>
              </BentoCard>
              <BentoCard
                className="flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"
                title={t('wellnessHub.sleepTitle')}
                subtitle={t('wellnessHub.sleepSub')}
                icon={<MoonIcon />}
                accentColor="bg-indigo-500"
                onClick={() => sleepSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              />
            </div>

            {/* My Goals Card */}
            <div className="md:col-span-3 lg:col-span-1 h-full">
              <BentoCard
                className="h-full bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-sky-100 dark:border-sky-800/30"
                title={t('wellnessHub.myGoals')}
                subtitle={userGoals.length > 0 ? t('wellnessHub.activeGoals', { count: userGoals.length }) : t('wellnessHub.setGoals')}
                icon={<PencilSquareIcon />}
                accentColor="bg-sky-500"
                onClick={() => setShowGoalsModal(true)}
              >
                <div className="mt-4 space-y-2" data-testid="wellness-goals-card">
                  {userGoals.length > 0 ? (
                    userGoals.slice(0, 3).map((goal) => (
                      <div key={goal} className="flex items-center gap-2 p-2 bg-white/60 dark:bg-slate-800/60 rounded-lg text-sm text-slate-700 dark:text-slate-300 shadow-sm">
                        <span className="text-lg" aria-hidden="true">{getWellnessGoalIcon(goal)}</span>
                        {goal}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col gap-2 mt-2">
                      <p className="text-xs text-slate-500">{t('wellnessHub.noGoals')}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-sky-600 bg-sky-100 dark:bg-sky-900/30 w-full justify-start"
                        onClick={() => setShowGoalsModal(true)}
                      >
                        {t('wellnessHub.addGoal')}
                      </Button>
                    </div>
                  )}
                </div>
              </BentoCard>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
            {t('common.loading', 'Laddar...')}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 p-4 text-center">
            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            <button
              onClick={fetchWellnessData}
              className="mt-2 text-xs px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200 transition-colors"
            >
              {t('common.retry', 'Försök igen')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Search Bar + Navigation Pills */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-8">
        {/* Search input (Fix 10) */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('wellnessHub.search', 'Sök övningar...')}
            className="w-full max-w-md pl-12 pr-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-3 pb-2 overflow-x-auto scrollbar-hide">
          <CategoryPill active={activeCategory === 'all'} label={t('wellnessHub.catAll')} icon={<SparklesIcon className="w-4 h-4" />} testId="wellness-category-all" onClick={() => setActiveCategory('all')} />
          <CategoryPill active={activeCategory === 'meditation'} label={t('wellnessHub.catMeditation')} icon={<HandRaisedIcon className="w-4 h-4" />} testId="wellness-category-meditation" onClick={() => setActiveCategory('meditation')} />
          <CategoryPill active={activeCategory === 'breathing'} label={t('wellnessHub.catBreathing')} icon={<CloudIcon className="w-4 h-4" />} testId="wellness-category-breathing" onClick={() => setActiveCategory('breathing')} />
          <CategoryPill active={activeCategory === 'sounds'} label={t('wellnessHub.catSounds')} icon={<MusicalNoteIcon className="w-4 h-4" />} testId="wellness-category-sounds" onClick={() => setActiveCategory('sounds')} />
          <CategoryPill active={activeCategory === 'sleep'} label={t('wellnessHub.catSleep')} icon={<MoonIcon className="w-4 h-4" />} testId="wellness-category-sleep" onClick={() => setActiveCategory('sleep')} />
          <button
            onClick={() => navigate('/recommendations')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 bg-primary-50 dark:bg-slate-800 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-slate-700"
          >
            <SparklesIcon className="w-4 h-4" />
            {t('wellnessHub.recommendations')}
          </button>
        </div>
      </div>

      {/* 3. Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Active Player Overlay */}
        {isMeditationActive && selectedMeditation && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">{t('wellnessHub.nowPlaying')}</h3>
                <button onClick={stopMeditation} aria-label={t('wellnessHub.stopMeditation')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <StopIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="flex flex-col items-center mb-8">
                <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-primary-200 to-primary-100 dark:from-primary-900/40 dark:to-primary-800/30 flex items-center justify-center mb-6 relative">
                  <div className={`absolute inset-0 rounded-full border-4 border-primary-100 ${!isPaused ? 'animate-ping' : ''} opacity-20`} />
                  {selectedMeditation.icon ? React.cloneElement(selectedMeditation.icon as React.ReactElement, { className: 'w-16 h-16 text-primary-600' }) : <SparklesIcon className="w-16 h-16 text-primary-600" />}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">{selectedMeditation.title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-center">{selectedMeditation.description}</p>
              </div>

              <div className="text-5xl font-mono text-center font-bold text-primary-600 dark:text-primary-400 mb-4 tracking-wider">
                {formatTime(meditationTimeLeft)}
              </div>

              {/* Progress bar (Fix 7) */}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-8">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-1000" style={{ width: `${((selectedMeditation.duration * 60 - meditationTimeLeft) / (selectedMeditation.duration * 60)) * 100}%` }} />
              </div>

              <div className="flex justify-center gap-6">
                <button
                  onClick={togglePause}
                  aria-label={isPaused ? t('wellnessHub.resumeMeditation') : t('wellnessHub.pauseMeditation')}
                  className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/40 hover:scale-105 transition-transform"
                >
                  {isPaused ? <PlayIcon className="w-8 h-8 ml-1" /> : <PauseIcon className="w-8 h-8" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Goals Modal */}
        {showGoalsModal && (
          <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setShowGoalsModal(false)}
                aria-label={t('wellnessHub.close')}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>

              <div className="p-2 sm:p-4">
                <WellnessGoalsOnboarding
                  {...(user?.user_id ? { userId: user.user_id } : {})}
                  initialGoals={userGoals}
                  onComplete={(goals) => {
                    setUserGoals(goals);
                    setShowGoalsModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Breathing Exercise Modal */}
        {activeBreathingExercise && (
          <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setActiveBreathingExercise(null)}
                aria-label={t('wellnessHub.close')}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
              <div className="p-4 sm:p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">{activeBreathingExercise.title}</h2>
                <Suspense fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                }>
                  <BreathingExercise
                    {...(user?.user_id ? { userId: user.user_id } : {})}
                    onComplete={(cycles) => {
                      setWellnessStats(prev => ({
                        ...applySessionCompletionStats(prev, 'breathing_exercise', activeBreathingExercise.duration)
                      }));
                      if (user?.user_id) {
                        saveMeditationSession({
                          type: 'breathing_exercise',
                          duration: activeBreathingExercise.duration,
                          technique: activeBreathingExercise.title,
                          completedCycles: cycles,
                          notes: 'Completed breathing exercise'
                        }).catch(e => logger.error('Failed to save breathing session:', e));
                      }
                      setActiveBreathingExercise(null);
                    }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* Categories Display */}
        {(activeCategory === 'all' || activeCategory === 'meditation') && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 rounded-full bg-primary-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('wellnessHub.guidedMeditations')}</h2>
              </div>
              <Button variant="ghost" className="text-primary-600" onClick={() => setActiveCategory('meditation')}>{t('wellnessHub.viewAll')}</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMeditations.map(m => (
                <div key={m.id} role="button" tabIndex={0} onClick={() => startMeditation(m)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startMeditation(m); } }} className="group relative bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 hover:border-primary-300 dark:hover:border-primary-700/50 hover:shadow-xl hover:shadow-primary-100/50 dark:hover:shadow-slate-900/30 transition-all duration-300 cursor-pointer overflow-hidden">
                  {isMeditationActive && selectedMeditation?.id === m.id && (
                    <span className="absolute top-3 right-3 px-2 py-1 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1 z-10">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      {t('wellnessHub.nowPlaying')}
                    </span>
                  )}
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary-50 dark:bg-primary-900/10 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 text-primary-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                      {m.icon}
                    </div>
                    <span className="text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <span className="text-[10px]">⏱</span> {m.duration} {t('wellnessHub.minutes')}
                    </span>
                  </div>
                  <h3 className="relative text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{m.title}</h3>
                  <p className="relative text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{m.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeCategory === 'all' || activeCategory === 'breathing') && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 rounded-full bg-accent-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('wellnessHub.breathingExercisesTitle')}</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBreathing.map(b => (
                <div key={b.id} role="button" tabIndex={0} onClick={() => setActiveBreathingExercise(b)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveBreathingExercise(b); } }} className="group relative bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 hover:border-accent-300 dark:hover:border-accent-700/50 hover:shadow-xl hover:shadow-accent-100/50 dark:hover:shadow-slate-900/30 transition-all duration-300 cursor-pointer overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-accent-50 dark:bg-accent-900/10 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-100 to-accent-50 dark:from-accent-900/30 dark:to-accent-800/20 text-accent-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                      {b.icon}
                    </div>
                    <span className="text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <span className="text-[10px]">⏱</span> {b.duration} {t('wellnessHub.minutes')}
                    </span>
                  </div>
                  <h3 className="relative text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">{b.title}</h3>
                  <p className="relative text-sm text-gray-500 dark:text-gray-400">{b.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeCategory === 'all' || activeCategory === 'sounds') && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-8 rounded-full bg-teal-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('wellnessHub.relaxingSoundsTitle')}</h2>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow duration-300">
              <RelaxingSounds onClose={() => { }} embedded />
            </div>
          </section>
        )}

        {(activeCategory === 'all' || activeCategory === 'sleep') && (
          <section className="mb-12" data-testid="wellness-sleep-section" ref={sleepSectionRef}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 rounded-full bg-indigo-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('wellnessHub.sleepAndRest')}</h2>
              </div>
              <Button variant="ghost" className="text-primary-600" onClick={() => sleepSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}>{t('wellnessHub.playStories')}</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSleepStories.map((story) => (
                <div
                  key={story.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => playSleepStory(story)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playSleepStory(story); } }}
                  className="group relative bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-700/50 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-slate-900/30 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-indigo-50 dark:bg-indigo-900/10 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 text-indigo-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                      {story.icon}
                    </div>
                    <span className="text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <span className="text-[10px]">⏱</span> {story.duration} {t('wellnessHub.minutes')}
                    </span>
                  </div>
                  <h3 className="relative text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{story.title}</h3>
                  <p className="relative text-sm text-gray-500 dark:text-gray-400">{story.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sleep Story Player Modal */}
      {selectedSleepStory && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">{t('wellnessHub.sleepStory', 'Sovsaga')}</h3>
              <button onClick={stopSleepStory} aria-label={t('wellnessHub.close')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-8">
              <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-indigo-200 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/30 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/40 animate-ping opacity-20" />
                {selectedSleepStory.icon ? React.cloneElement(selectedSleepStory.icon as React.ReactElement, { className: 'w-16 h-16 text-indigo-600' }) : <MoonIcon className="w-16 h-16 text-indigo-600" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">{selectedSleepStory.title}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-center">{selectedSleepStory.description}</p>
            </div>

            <div className="text-5xl font-mono text-center font-bold text-indigo-600 dark:text-indigo-400 mb-8 tracking-wider">
              {formatTime(sleepStoryTimeLeft)}
            </div>

            <div className="flex justify-center gap-6">
              <button
                onClick={() => {
                  if (sleepStoryAudioRef.current) {
                    if (sleepStoryPlaying) {
                      sleepStoryAudioRef.current.pause();
                      if (sleepStoryTimerRef.current) {
                        clearInterval(sleepStoryTimerRef.current);
                        sleepStoryTimerRef.current = null;
                      }
                      setSleepStoryPlaying(false);
                    } else {
                      sleepStoryAudioRef.current.play()?.catch(e => logger.error('Resume failed:', e));
                      sleepStoryTimerRef.current = setInterval(() => {
                        setSleepStoryTimeLeft((prev) => {
                          if (prev <= 1) { stopSleepStory(); return 0; }
                          return prev - 1;
                        });
                      }, 1000);
                      setSleepStoryPlaying(true);
                    }
                  }
                }}
                aria-label={sleepStoryPlaying ? t('wellnessHub.pauseMeditation') : t('wellnessHub.resumeMeditation')}
                className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:scale-105 transition-transform"
              >
                {sleepStoryPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
              </button>
              <button
                onClick={stopSleepStory}
                aria-label={t('wellnessHub.stopMeditation')}
                className="w-16 h-16 rounded-full bg-gray-400 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <StopIcon className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WellnessHub;
