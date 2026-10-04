import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, lazy, Suspense } from 'react';
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
import { useWellnessTimer } from '../hooks/useWellnessTimer';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
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
  image?: string;
  color?: string;
  icon?: React.ReactNode;
  technique?: string;
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

// These are ambient recordings, not narrated stories. The copy in
// wellnessData describes them as such — promising a "godnattsaga" and then
// playing surf is a claim the app cannot keep.
//
// A third file (Meditation_im_Liegen) used to sit here and in the meditation
// map. It is twenty minutes of spoken German, served to Swedish users under a
// Swedish title. There is no honest label for that, so it is gone.
//
// Hotlinking Wikimedia is still the wrong long-term answer: it rate-limits
// under load (a 429 was observed during this work) and their hotlinking policy
// is not a hosting agreement. Real Swedish guided audio on our own CDN is what
// this should become.
const SLEEP_STORY_URLS: Record<string, string> = {
  's1': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
  's2': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg',
  's3': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
};

// Ambient audio. There is no guidance track behind these yet, which is why
// the descriptions no longer claim one.
const MEDITATION_AUDIO_URLS: Record<string, string> = {
  '1': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
  '2': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg',
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
  const [meditationStartTime, setMeditationStartTime] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  // The guided-meditation audio is hotlinked from an external host that rate
  // limits, so failing to load is a normal condition at scale, not an edge case.
  const [meditationAudioFailed, setMeditationAudioFailed] = useState(false);
  const pausedDurationMsRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<Date | null>(null);
  const completeMeditationRef = useRef<() => Promise<void>>();
  const isSavingMeditationRef = useRef(false);
  const selectedMeditationRef = useRef<MeditationOption | null>(null);
  const sleepSectionRef = useRef<HTMLElement | null>(null);
  // Countdown + audio lifecycles are owned by dedicated hooks (single interval
  // per hook, cleanup on unmount) instead of hand-rolled refs.
  const meditationTimer = useWellnessTimer({ onComplete: () => { void completeMeditationRef.current?.(); } });
  const meditationAudio = useAudioPlayback();

  // UI State
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [activeBreathingExercise, setActiveBreathingExercise] = useState<MeditationOption | null>(null);
  const [selectedSleepStory, setSelectedSleepStory] = useState<MeditationOption | null>(null);
  const [sleepStoryPlaying, setSleepStoryPlaying] = useState(false);
  const sleepStorySaveRef = useRef<(() => void) | null>(null);
  const selectedSleepStoryRef = useRef<MeditationOption | null>(null);
  const stopSleepStoryRef = useRef<((shouldSave?: boolean) => void) | null>(null);
  const sleepStoryTimer = useWellnessTimer({ onComplete: () => stopSleepStoryRef.current?.(true) });
  const sleepStoryAudio = useAudioPlayback();

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
        getMoods(user.user_id, controller.signal),
        getMeditationSessions(100, controller.signal),
        getWellnessGoals(controller.signal)
      ]);

      if (controller.signal.aborted) return;

      const moods = moodsResult.status === 'fulfilled' ? moodsResult.value : [];
      const sessionData = sessionsResult.status === 'fulfilled' ? sessionsResult.value : { sessions: [] };
      const sessions = sessionData.sessions || [];
      const activeGoals = goalsResult.status === 'fulfilled' ? goalsResult.value : [];

      // Promise.allSettled never rejects, so on its own this silently
      // degrades a real failure (e.g. getMeditationSessions throwing on a
      // network/auth error) into "0 minutes, no goals" with no indication
      // anything went wrong. Surface it through the same error banner used
      // for a total failure, while still rendering whatever data did load.
      if ([moodsResult, sessionsResult, goalsResult].some(r => r.status === 'rejected')) {
        setError(t('wellnessHub.loadError', 'Kunde inte ladda wellness-data.'));
      }

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
  // Save an in-progress meditation on unmount. Interval + audio teardown is
  // handled by the timer/audio hooks' own cleanup.
  useEffect(() => {
    return () => {
      if (selectedMeditationRef.current && !isSavingMeditationRef.current && completeMeditationRef.current) {
        if (pauseStartTimeRef.current) {
          pausedDurationMsRef.current += new Date().getTime() - pauseStartTimeRef.current.getTime();
          pauseStartTimeRef.current = null;
        }
        completeMeditationRef.current();
      }
    };
  }, []);

  // ----------------------------------------------------------------------
  // Timer Logic
  // ----------------------------------------------------------------------

  const resetMeditationState = () => {
    meditationTimer.stop();
    meditationAudio.stop();
    setIsMeditationActive(false);
    setSelectedMeditation(null);
    setMeditationStartTime(null);
    setIsPaused(false);
    pausedDurationMsRef.current = 0;
    pauseStartTimeRef.current = null;
  };

  const completeMeditation = async () => {
    if (!selectedMeditation || !meditationStartTime || !user?.user_id) return;
    if (isSavingMeditationRef.current) return;
    isSavingMeditationRef.current = true;

    // Clear timer immediately to prevent stopMeditation from double-saving
    meditationTimer.pause();

    const med = selectedMeditation;
    const startTime = meditationStartTime;
    // Subtract total paused time from raw elapsed time so saved duration reflects active playback only
    const rawElapsedMs = new Date().getTime() - startTime.getTime();
    const activeDurationMs = Math.max(0, rawElapsedMs - pausedDurationMsRef.current);
    const duration = Math.round(activeDurationMs / 1000 / 60); // mins
    const safeDuration = Math.max(1, duration);

    // Save to backend
    try {
      await saveMeditationSession({
        type: med.type,
        duration: safeDuration,
        technique: med.title,
        completedCycles: 1,
        notes: 'Completed session'
      });

      // Optimistic update
      setWellnessStats(prev => ({
        ...applySessionCompletionStats(prev, med.type, safeDuration)
      }));
    } catch (e) { logger.error('Failed to save meditation session:', e); }

    isSavingMeditationRef.current = false;
    resetMeditationState();
  };

  // Keep refs in sync after commit: selectedMeditation for unmount cleanup,
  // completeMeditation so the interval callback always calls the latest one.
  useLayoutEffect(() => {
    selectedMeditationRef.current = selectedMeditation;
    completeMeditationRef.current = completeMeditation;
  });

  const stopMeditation = async () => {
    // Save partial session if user started and at least some time elapsed
    if (selectedMeditation && meditationStartTime && user?.user_id && !isSavingMeditationRef.current) {
      isSavingMeditationRef.current = true;
      const med = selectedMeditation;
      const startTime = meditationStartTime;
      const pausedMs = pausedDurationMsRef.current;

      // Clear timer immediately to prevent race with completeMeditation
      meditationTimer.pause();

      const rawElapsedMs = new Date().getTime() - startTime.getTime();
      const activeDurationMs = Math.max(0, rawElapsedMs - pausedMs);
      const duration = Math.round(activeDurationMs / 1000 / 60);
      if (duration >= 1) {
        try {
          await saveMeditationSession({
            type: med.type,
            duration,
            technique: med.title,
            completedCycles: 1,
            notes: 'Session stopped early by user'
          });
          setWellnessStats(prev => ({
            ...applySessionCompletionStats(prev, med.type, duration)
          }));
        } catch (e) { logger.error('Failed to save partial meditation session:', e); }
      }
      isSavingMeditationRef.current = false;
    }
    resetMeditationState();
  };

  const startMeditation = (meditation: MeditationOption) => {
    isSavingMeditationRef.current = false;
    setSelectedMeditation(meditation);
    setIsMeditationActive(true);
    setMeditationStartTime(new Date());
    setIsPaused(false);
    pausedDurationMsRef.current = 0;
    pauseStartTimeRef.current = null;

    // Play guided meditation audio (play() replaces any current audio)
    setMeditationAudioFailed(false);
    const audioUrl = MEDITATION_AUDIO_URLS[meditation.id];
    if (audioUrl) {
      meditationAudio.play(audioUrl, {
        loop: true,
        volume: 0.6,
        // Without this the timer still runs and the player still shows
        // "Nu spelas" when the audio never loads, so the user sits through a
        // silent session with nothing indicating anything went wrong. Sleep
        // stories already handled this; meditations did not.
        onError: () => {
          logger.error('Meditation audio failed to load:', meditation.id);
          setMeditationAudioFailed(true);
        },
      });
    }

    meditationTimer.start(meditation.duration * 60);
  };

  const togglePause = () => {
    if (isPaused) {
      // Resume: accumulate paused duration
      if (pauseStartTimeRef.current) {
        pausedDurationMsRef.current += new Date().getTime() - pauseStartTimeRef.current.getTime();
      }
      pauseStartTimeRef.current = null;
      setIsPaused(false);
      meditationAudio.resume();
      meditationTimer.resume();
    } else {
      // Pause
      meditationTimer.pause();
      meditationAudio.pause();
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

  const stopSleepStory = useCallback((shouldSave: boolean = false) => {
    if (shouldSave && sleepStorySaveRef.current) {
      sleepStorySaveRef.current();
    }
    sleepStoryAudio.stop();
    sleepStoryTimer.stop();
    setSleepStoryPlaying(false);
    setSelectedSleepStory(null);
  }, [sleepStoryAudio, sleepStoryTimer]);

  // Timer onComplete fires from inside the hook — keep the latest closure.
  useLayoutEffect(() => {
    stopSleepStoryRef.current = stopSleepStory;
  }, [stopSleepStory]);

  const playSleepStory = useCallback((story: MeditationOption) => {
    stopSleepStory(true);
    const url = SLEEP_STORY_URLS[story.id];
    if (!url) {
      logger.error('Sleep story playback failed: No URL for story', story.id);
      return;
    }

    setSelectedSleepStory(story);
    setSleepStoryPlaying(true);

    sleepStoryAudio.play(url, {
      volume: 0.6,
      onEnded: () => {
        logger.info('Sleep story ended naturally:', story.id);
        stopSleepStoryRef.current?.(true);
      },
      onError: () => {
        logger.error('Sleep story playback failed: Audio load error for', story.id);
        stopSleepStoryRef.current?.();
      },
    });

    sleepStoryTimer.start(story.duration * 60);
  }, [stopSleepStory, sleepStoryAudio, sleepStoryTimer]);

  useEffect(() => {
    return () => {
      // Save in-progress sessions on unmount; audio + timer teardown is
      // handled by the hooks' own cleanup.
      if (selectedSleepStoryRef.current && sleepStorySaveRef.current) {
        sleepStorySaveRef.current();
      }
    };
  }, []);

  // Save sleep story session to backend when story stops/completes. Both
  // refs are read from cleanup and stop handlers, so they are refreshed
  // after every commit rather than during render.
  useLayoutEffect(() => {
    selectedSleepStoryRef.current = selectedSleepStory;
    sleepStorySaveRef.current = () => {
      if (!selectedSleepStory || !user?.user_id) return;
      const story = selectedSleepStory;
      const elapsedSeconds = story.duration * 60 - sleepStoryTimer.timeLeft;
      if (elapsedSeconds < 60) return;
      const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
      saveMeditationSession({
        type: 'soundscape',
        duration: durationMinutes,
        technique: story.title,
        completedCycles: 1,
        notes: 'Completed sleep story'
      }).catch(e => logger.error('Failed to save sleep story session:', e));
      setWellnessStats(prev => applySessionCompletionStats(prev, 'soundscape', durationMinutes));
    };
  });

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
    { id: 'b1', title: wdBr[0]?.title || '4-7-8 Andning', duration: 1, type: 'breathing_exercise', description: wdBr[0]?.description || 'För ångestdämpning', icon: <CloudIcon />, technique: '4-7-8' },
    { id: 'b2', title: wdBr[1]?.title || 'Fyrkantsandning', duration: 1, type: 'breathing_exercise', description: wdBr[1]?.description || 'För balans och lugn', icon: <StopIcon />, technique: 'box' },
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
  const dailyRecSub = dailyRecIndex === 2 ? t('wellnessHub.dailyRecSubMorning') : dailyRecIndex === 0 ? t('wellnessHub.dailyRecSubDay') : t('wellnessHub.dailyRecSubEvening');

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
                subtitle={dailyRecSub}
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
                {meditationAudioFailed && (
                  <p
                    role="status"
                    className="mt-3 text-sm text-center text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2"
                  >
                    {t('wellnessHub.audioUnavailable', 'Ljudet kunde inte spelas upp. Timern fortsätter — du kan meditera i tystnad eller försöka igen senare.')}
                  </p>
                )}
              </div>

              <div className="text-5xl font-mono text-center font-bold text-primary-600 dark:text-primary-400 mb-4 tracking-wider">
                {formatTime(meditationTimer.timeLeft)}
              </div>

              {/* Progress bar (Fix 7) */}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-8">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-1000" style={{ width: `${((selectedMeditation.duration * 60 - meditationTimer.timeLeft) / (selectedMeditation.duration * 60)) * 100}%` }} />
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
                    {...(activeBreathingExercise.technique ? { technique: activeBreathingExercise.technique } : {})}
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
              <button onClick={() => stopSleepStory(true)} aria-label={t('wellnessHub.close')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
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
              {formatTime(sleepStoryTimer.timeLeft)}
            </div>

            <div className="flex justify-center gap-6">
              <button
                onClick={() => {
                  if (!selectedSleepStory) return;
                  if (sleepStoryPlaying) {
                    sleepStoryAudio.pause();
                    sleepStoryTimer.pause();
                    setSleepStoryPlaying(false);
                  } else {
                    sleepStoryAudio.resume();
                    sleepStoryTimer.resume();
                    setSleepStoryPlaying(true);
                  }
                }}
                aria-label={sleepStoryPlaying ? t('wellnessHub.pauseMeditation') : t('wellnessHub.resumeMeditation')}
                className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:scale-105 transition-transform"
              >
                {sleepStoryPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
              </button>
              <button
                onClick={() => stopSleepStory(true)}
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
