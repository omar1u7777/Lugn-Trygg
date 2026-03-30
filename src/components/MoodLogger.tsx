import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  FaceFrownIcon,
  FaceSmileIcon,
  MinusCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { logMood, getMoods } from '../api/api';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Card } from './ui/tailwind';
import { UsageLimitBanner } from './UsageLimitBanner';
import { logger } from '../utils/logger';
import { getMoodLabel, getMoodScoreFromLabel } from '../features/mood/utils';


interface MoodLoggerProps {
  onMoodLogged?: (mood?: number, note?: string) => void;
}

interface RecentMood {
  id?: string;
  mood: string;
  score: number;
  timestamp: Date;
  note?: string;
}

interface RecentMoodGroup {
  key: string;
  label: string;
  entries: RecentMood[];
}

type TimestampLike = Date | string | number | { toDate?: () => Date } | null | undefined;

interface MoodApiEntry {
  id?: string;
  docId?: string;
  timestamp?: TimestampLike;
  mood_text?: string;
  mood?: string;
  note?: string;
  score?: number;
  sentiment_score?: number;
}

interface ApiErrorLike {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
}

const DUPLICATE_MOOD_COOLDOWN_MS = 5 * 60 * 1000;
const VALID_MOOD_LABELS = new Set(['ledsen', 'orolig', 'neutral', 'bra', 'glad', 'super']);

const normalizeMoodLabel = (rawLabel: string, score: number): string => {
  const trimmed = rawLabel.trim();
  if (!trimmed) {
    return getMoodLabel(score);
  }

  const normalized = trimmed.toLowerCase();
  const looksLikeSentence = trimmed.length > 18 || normalized.includes(' ');

  // If backend text looks like a note/sentence instead of a mood word,
  // fall back to deterministic label from score.
  if (!VALID_MOOD_LABELS.has(normalized) || looksLikeSentence) {
    return getMoodLabel(score);
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const getReflectionPromptByScore = (score: number): string => {
  if (score <= 3) {
    return 'Vad skulle kännas mest hjälpsamt för dig de kommande 60 minuterna?';
  }
  if (score <= 5) {
    return 'Vad har påverkat ditt mående mest hittills idag?';
  }
  if (score <= 8) {
    return 'Vad bidrog till att du känner dig okej eller bra just nu?';
  }
  return 'Vad vill du ta med dig från den här positiva känslan resten av dagen?';
};

const getMoodVisual = (score: number) => {
  if (score >= 10) {
    return {
      Icon: SparklesIcon,
      iconClass: 'text-amber-600 dark:text-amber-300',
      iconBgClass: 'bg-amber-50 dark:bg-amber-900/30',
      scoreBadgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    };
  }

  if (score >= 8) {
    return {
      Icon: FaceSmileIcon,
      iconClass: 'text-emerald-600 dark:text-emerald-300',
      iconBgClass: 'bg-emerald-50 dark:bg-emerald-900/30',
      scoreBadgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    };
  }

  if (score >= 7) {
    return {
      Icon: FaceSmileIcon,
      iconClass: 'text-teal-600 dark:text-teal-300',
      iconBgClass: 'bg-teal-50 dark:bg-teal-900/30',
      scoreBadgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    };
  }

  if (score >= 5) {
    return {
      Icon: MinusCircleIcon,
      iconClass: 'text-slate-600 dark:text-slate-300',
      iconBgClass: 'bg-slate-100 dark:bg-slate-700/40',
      scoreBadgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    };
  }

  if (score >= 3) {
    return {
      Icon: ExclamationTriangleIcon,
      iconClass: 'text-orange-600 dark:text-orange-300',
      iconBgClass: 'bg-orange-50 dark:bg-orange-900/30',
      scoreBadgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    };
  }

  return {
    Icon: FaceFrownIcon,
    iconClass: 'text-rose-600 dark:text-rose-300',
    iconBgClass: 'bg-rose-50 dark:bg-rose-900/30',
    scoreBadgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  };
};

const isSameCalendarDay = (left: Date, right: Date): boolean => {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const getDayGroupLabel = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date, today)) {
    return 'Idag';
  }

  if (isSameCalendarDay(date, yesterday)) {
    return 'Igår';
  }

  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
  });
};

const getLocalDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MoodLogger: React.FC<MoodLoggerProps> = ({ onMoodLogged }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const { canLogMood, incrementMoodLog, getRemainingMoodLogs, plan, refreshSubscription } = useSubscription();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [recentMoods, setRecentMoods] = useState<RecentMood[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const lastMoodSubmissionRef = useRef<{ moodScore: number; timestampMs: number } | null>(null);

  // Kolla om användaren kan logga fler humör
  const canLogMore = canLogMood();
  const _remainingLogs = getRemainingMoodLogs();

  useEffect(() => {
    analytics.page('Mood Logger', {
      component: 'MoodLogger',
    });
  }, []);

  const moods = [
    { emoji: '😢', label: 'Ledsen', value: 2, description: 'Känner mig ledsen eller nedstämd', bgColor: 'bg-[#bae1ff]/20', borderColor: 'border-[#bae1ff]', selectedBg: 'bg-[#bae1ff]/30' },
    { emoji: '😟', label: 'Orolig', value: 3, description: 'Känner oro eller ångest', bgColor: 'bg-[#e4c1f9]/20', borderColor: 'border-[#e4c1f9]', selectedBg: 'bg-[#e4c1f9]/30' },
    { emoji: '😐', label: 'Neutral', value: 5, description: 'Känner mig varken bra eller dåligt', bgColor: 'bg-[#ffd8a8]/20', borderColor: 'border-[#ffd8a8]', selectedBg: 'bg-[#ffd8a8]/30' },
    { emoji: '🙂', label: 'Bra', value: 7, description: 'Känner mig ganska bra', bgColor: 'bg-[#dcedc1]/20', borderColor: 'border-[#dcedc1]', selectedBg: 'bg-[#dcedc1]/30' },
    { emoji: '😊', label: 'Glad', value: 8, description: 'Känner mig glad och positiv', bgColor: 'bg-[#a8e6cf]/20', borderColor: 'border-[#a8e6cf]', selectedBg: 'bg-[#a8e6cf]/30' },
    { emoji: '🤩', label: 'Super', value: 10, description: 'Känner mig fantastisk!', bgColor: 'bg-[#ffd8a8]/20', borderColor: 'border-[#fbbf24]', selectedBg: 'bg-[#fbbf24]/20' },
  ];

  const selectedMoodMeta = selectedMood !== null ? moods.find((m) => m.value === selectedMood) : null;
  const trimmedNote = note.trim();
  const hasMeaningfulNote = trimmedNote.length >= 15;
  const hasSelectedMood = selectedMood !== null;

  // Progress: mood selection is required (70%), note is optional but adds qualitative depth (remaining 30%).
  const checkInProgress = hasSelectedMood ? (hasMeaningfulNote ? 100 : 70) : 0;
  const checkInProgressLabel =
    checkInProgress === 0
      ? t('moodLogger.checkInProgressEmpty', 'Välj ett humör för att starta check-in')
      : checkInProgress < 100
        ? t('moodLogger.checkInProgressPartial', 'Du kan logga nu, men en kort anteckning ger bättre insikter över tid')
        : t('moodLogger.checkInProgressComplete', 'Check-in komplett: humör + reflektion redo att loggas');

  // Keyboard shortcuts för mood val (1-6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = parseInt(e.key);
      if (key >= 1 && key <= 6 && !e.ctrlKey && !e.metaKey && !isLogging) {
        e.preventDefault();
        const mood = moods[key - 1];
        if (mood) handleMoodSelect(mood);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moods, isLogging]);

  const handleMoodSelect = (mood: typeof moods[0]) => {
    setSelectedMood(mood.value);
    setLimitError(null);
    announceToScreenReader(t('moodLogger.moodSelected', 'Valde humör: {{mood}}', { mood: mood.label }), 'polite');

    analytics.track('Mood Selected', {
      mood_value: mood.value,
      mood_label: mood.label,
      component: 'MoodLogger',
    });
  };

  const isDuplicateMoodWithinCooldown = useCallback(
    (moodScore: number) => {
      const now = Date.now();

      const latestSubmission = lastMoodSubmissionRef.current;
      if (
        latestSubmission &&
        latestSubmission.moodScore === moodScore &&
        now - latestSubmission.timestampMs < DUPLICATE_MOOD_COOLDOWN_MS
      ) {
        return true;
      }

      return recentMoods.some(
        (entry) =>
          entry.score === moodScore &&
          now - entry.timestamp.getTime() < DUPLICATE_MOOD_COOLDOWN_MS
      );
    },
    [recentMoods]
  );

  const handleLogMood = async () => {
    if (selectedMood === null || !user?.user_id) {
      logger.warn('⚠️ MoodLogger - Missing selected mood or user');
      return;
    }

    if (submitLockRef.current || isLogging) {
      return;
    }

    // Kolla om användaren har nått sin gräns
    if (!canLogMore) {
      announceToScreenReader(t('moodLogger.dailyLimitReached'), 'assertive');
      return;
    }

    if (isDuplicateMoodWithinCooldown(selectedMood)) {
      const duplicateMessage = t('moodLogger.duplicateMoodWarning', 'Du loggade samma humör nyligen. Vänta några minuter innan du loggar samma känsla igen.');
      setLimitError(duplicateMessage);
      announceToScreenReader(duplicateMessage, 'polite');
      return;
    }

    submitLockRef.current = true;
    setIsLogging(true);
    setLimitError(null);
    try {
      // Find the mood object to get label
      const moodObj = moods.find(m => m.value === selectedMood);
      const moodText = moodObj?.label || 'Neutral';
      const trimmedNote = note.trim();

      // Log mood to backend with text, score and mood_text label
      await logMood(user.user_id, {
        score: selectedMood,
        mood_text: moodText,
        note: trimmedNote || `Känner mig ${moodText.toLowerCase()}`,
      });

      // Öka användning för gratisanvändare
      incrementMoodLog();
      lastMoodSubmissionRef.current = { moodScore: selectedMood, timestampMs: Date.now() };

      analytics.track('Mood Logged', {
        mood_value: selectedMood,
        mood_text: moodText,
        has_note: note.length > 0,
        component: 'MoodLogger',
        subscription_tier: plan.tier,
      });

      announceToScreenReader(t('moodLogger.moodLoggedSuccess'), 'polite');

      onMoodLogged?.(selectedMood, trimmedNote);

      // Refresh recent moods
      await loadRecentMoods();

      // Reset form
      setSelectedMood(null);
      setNote('');

    } catch (error: unknown) {
      logger.error('Failed to log mood:', error);
      const apiError = error as ApiErrorLike;
      const quotaExceeded = Boolean(
        apiError.response?.status === 429
      );

      if (quotaExceeded) {
        const serverMessage = apiError.response?.data?.error;
        const friendlyMessage = serverMessage || t('moodLogger.dailyLimitReachedMessage', 'Du har nått din dagliga gräns för humörloggningar.');
        setLimitError(friendlyMessage);
        announceToScreenReader(friendlyMessage, 'assertive');
        refreshSubscription().catch(() => null);
      } else {
        announceToScreenReader(t('moodLogger.moodLogFailed'), 'assertive');
      }
    } finally {
      setIsLogging(false);
      submitLockRef.current = false;
    }
  };

  const loadRecentMoods = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const moodsResponse = await getMoods(user.user_id);
      const normalized: RecentMood[] = (moodsResponse || [])
        .map((mood: MoodApiEntry) => {
          const rawTimestamp = mood?.timestamp;
          const timestamp =
            rawTimestamp &&
            typeof rawTimestamp === 'object' &&
            'toDate' in rawTimestamp &&
            typeof rawTimestamp.toDate === 'function'
            ? rawTimestamp.toDate()
            : new Date(rawTimestamp || Date.now());

          // Get mood text - prefer mood_text from backend, fallback to note
          let moodText = mood.mood_text || mood.mood || '';
          
          // Check if mood text or note is encrypted (starts with U2FsdGVk)
          // If so, show a placeholder instead of raw encrypted data
          if (moodText.startsWith('U2FsdGVk')) {
            moodText = t('moodLogger.notePlaceholder', 'Anteckning');
          }
          if (mood.note && typeof mood.note === 'string' && mood.note.startsWith('U2FsdGVk')) {
            // Note is encrypted, don't show it
            moodText = moodText || t('moodLogger.unknownMood', 'Humör');
          }
          
          // Derive proper label from score when text is generic 'neutral' or missing
          // This fixes legacy moods that were stored with 'neutral' regardless of score

          // Get score - handle different possible field names
          let score: number | null = null;
          if (typeof mood.score === 'number' && mood.score >= 1 && mood.score <= 10) {
            score = mood.score;
          } else if (typeof mood.sentiment_score === 'number') {
            // Convert sentiment score (-1 to 1) to 1-10 scale
            score = Math.round((mood.sentiment_score + 1) * 4.5 + 1);
          }

          // Legacy data can contain score=0; infer from label when possible.
          if (score === null || score === 0) {
            score = getMoodScoreFromLabel(moodText) ?? score;
          }

          // Ensure UI always shows a valid 1-10 score.
          score = Math.max(1, Math.min(10, score ?? 5));

          // Use score as source of truth so label/emoji/score stay consistent in history cards.
          moodText = getMoodLabel(score);

          return {
            id: mood.id || mood.docId,
            mood: moodText,
            score: score,
            timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
            note: mood.note || undefined,
          };
        })
        .filter((mood, index, arr) => {
          // Prevent duplicate cards when backend returns repeated records.
          // Inkluderar deduplicering baserat på tid (inom 5 min)
          return (
            index ===
            arr.findIndex((candidate) => {
              if (candidate.id && mood.id && candidate.id === mood.id) return true;
              
              const timeDiffMs = Math.abs(candidate.timestamp.getTime() - mood.timestamp.getTime());
              const isSameMood = candidate.score === mood.score && candidate.mood === mood.mood;
              
              return isSameMood && timeDiffMs < 5 * 60 * 1000;
            })
          );
        })
        .sort((a: RecentMood, b: RecentMood) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);

      setRecentMoods(normalized);
    } catch (error) {
      logger.error('Failed to load recent moods:', error);
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (user?.user_id) {
      void loadRecentMoods();
    }
  }, [loadRecentMoods, user?.user_id]);

  const groupedRecentMoods = useMemo<RecentMoodGroup[]>(() => {
    return recentMoods.reduce<RecentMoodGroup[]>((groups, mood) => {
      const groupKey = getLocalDayKey(mood.timestamp);
      const existingGroup = groups.find((group) => group.key === groupKey);

      if (existingGroup) {
        existingGroup.entries.push(mood);
        return groups;
      }

      groups.push({
        key: groupKey,
        label: getDayGroupLabel(mood.timestamp),
        entries: [mood],
      });

      return groups;
    }, []);
  }, [recentMoods]);

  // Beräkna veckans streak (antal loggningar denna vecka)
  const weeklyStreak = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Måndag
    startOfWeek.setHours(0, 0, 0, 0);
    
    return recentMoods.filter(mood => mood.timestamp >= startOfWeek).length;
  }, [recentMoods]);

  // Beräkna trend (jämför med föregående humör)
  const getTrend = (currentIndex: number, allEntries: RecentMood[]): 'up' | 'down' | 'stable' | null => {
    if (currentIndex >= allEntries.length - 1) return null;
    const current = allEntries[currentIndex].score;
    const previous = allEntries[currentIndex + 1]?.score;
    if (!previous) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Back to Dashboard Button - Only show if onMoodLogged is provided */}
      {onMoodLogged && (
        <div className="mb-6">
          <button
            onClick={() => {
              logger.debug('🔙 Back button clicked, calling onMoodLogged');
              onMoodLogged();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label={t('moodLogger.backToDashboard', 'Tillbaka till dashboard')}
          >
            <span aria-hidden="true">←</span>
            {t('moodLogger.backToDashboard', 'Tillbaka till Dashboard')}
          </button>
        </div>
      )}

      {/* The main heading is removed since WorldClassDashboard handles it, reducing duplicate text */}
      
      {/* Usage Limit Banner för planer med gränser */}
      {plan.limits.moodLogsPerDay !== -1 && (
        <div className="mb-6">
          <UsageLimitBanner limitType="moodLogs" />
        </div>
      )}

      {limitError && (
        <p className="-mt-4 mb-6 text-sm text-red-600 dark:text-red-400 text-center" role="alert">
          {limitError}
        </p>
      )}

      {/* Mood Selection */}
      <Card className="mb-6">
        <div className="p-4 sm:p-6">
          <div className="mb-5 rounded-xl border border-[#d6efe9] dark:border-primary-800 bg-[#f4fbf9] dark:bg-primary-900/20 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-[#1e5f54] dark:text-primary-300">
                {t('moodLogger.checkInProgress', 'Check-in progress')}
              </p>
              <span className="text-sm font-semibold text-[#1e5f54] dark:text-primary-300" aria-live="polite">
                {checkInProgress}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#d8efe9] dark:bg-primary-800/60 rounded-full overflow-hidden" role="progressbar" aria-valuenow={checkInProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Check-in progress">
              <div
                className="h-full bg-gradient-to-r from-[#2c8374] to-[#4ba99b] dark:from-[#4ba99b] dark:to-[#6bc4b5] transition-all duration-500"
                style={{ width: `${checkInProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs sm:text-sm text-[#33665e] dark:text-primary-200">
              {checkInProgressLabel}
            </p>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
            {t('moodLogger.selectMood', 'Välj ditt humör')}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-6">
            {t('moodLogger.keyboardTip', 'Tips: Tryck 1-6 på tangentbordet för snabbval ⌨️')}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
            {moods.map((mood, index) => (
              <button
                key={mood.value}
                onClick={() => handleMoodSelect(mood)}
                disabled={isLogging}
                style={{ animationDelay: `${index * 0.08}s` }}
                className={`
                  p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 text-center
                  transform hover:scale-105 hover:-translate-y-1
                  focus:outline-none focus:ring-2 focus:ring-[#2c8374] focus:ring-offset-2
                  animate-[fadeIn_0.4s_ease-out_forwards] opacity-0
                  ${selectedMood === mood.value
                    ? `${mood.borderColor} ${mood.selectedBg} shadow-lg ring-2 ring-[#2c8374]/30 scale-105`
                    : `border-[#e8dcd0] ${mood.bgColor} hover:${mood.borderColor} hover:shadow-md`
                  }
                `}
                aria-label={`${mood.label}: ${mood.description}`}
                aria-pressed={selectedMood === mood.value}
              >
                <div className={`text-4xl sm:text-5xl mb-3 transition-transform duration-300 ${selectedMood === mood.value ? 'scale-110 animate-bounce' : 'hover:scale-110'}`}>
                  {mood.emoji}
                </div>
                <div className="font-semibold text-sm text-[#2f2a24]">{mood.label}</div>
                <div className="text-xs text-[#6d645d] mt-1 font-medium">{mood.value}/10</div>
              </button>
            ))}
          </div>

          {selectedMood && (
            <div className="text-center">
              <span className="inline-block px-4 py-2 bg-[#2c8374]/15 text-[#1e5f54] rounded-full text-sm font-medium">
                {t('moodLogger.selectedMood', 'Valt humör: {{mood}}', { mood: moods.find(m => m.value === selectedMood)?.label })}
              </span>
              
              {/* Celebration vid 100% progress */}
              {checkInProgress === 100 && (
                <div className="mt-2 animate-bounce text-emerald-500 text-sm">
                  {t('moodLogger.readyToLog', '✨ Perfekt! Redo att logga ✨')}
                </div>
              )}
              
              {/* Self-compassion text för låga humör (2-3) */}
              {selectedMood <= 3 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  {t('moodLogger.hardDaySupport', 'Det är okej att ha svåra dagar. Du gör ditt bäst. 💙')}
                </p>
              )}
              
              <p className="mt-3 text-sm text-[#6d645d] dark:text-gray-300 max-w-xl mx-auto" aria-live="polite">
                {getReflectionPromptByScore(selectedMood)}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Optional Note */}
      {selectedMood && (
        <Card className="mb-6">
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('moodLogger.addNote', 'Lägg till en anteckning (valfritt)')}
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('moodLogger.notePlaceholder', 'Vad får dig att känna så här idag? ✨')}
              className="w-full p-4 border-2 border-[#e8dcd0] rounded-2xl resize-none transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-[#2c8374]/30 focus:border-[#2c8374]
                bg-white/80 backdrop-blur-sm text-[#2f2a24] placeholder-[#a89f97]
                dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              rows={3}
              maxLength={200}
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className={`font-medium ${hasMeaningfulNote ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#6d645d] dark:text-gray-400'}`}>
                {hasMeaningfulNote ? t('moodLogger.reflectionAdded', 'Reflektion tillagd') : t('moodLogger.characterTip', 'Tips: 15+ tecken ger bättre personlig uppföljning')}
              </span>
              <span className="text-[#6d645d] dark:text-gray-400 font-medium">
                {note.length}/200 {t('moodLogger.characters', 'tecken')}
              </span>
            </div>
          </div>
        </Card>
      )}


      {/* Log Button med network error handling */}
      {selectedMood && (
        <div className="text-center">
          {limitError?.includes('Network') || limitError?.includes('timeout') ? (
            <div className="space-y-3">
              <p className="text-amber-600 dark:text-amber-400 text-sm">
                {t('moodLogger.networkError', 'Nätverksfel. Kunde inte ansluta till servern.')}
              </p>
              <button
                onClick={handleLogMood}
                disabled={isLogging}
                className="px-6 py-3 text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors inline-flex items-center gap-2"
              >
                {isLogging ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('moodLogger.retrying', 'Försöker igen...')}
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    {t('moodLogger.tryAgain', 'Försök igen')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogMood}
              disabled={isLogging || !canLogMore}
              className="px-6 sm:px-8 py-3 text-base sm:text-lg font-medium text-white bg-[#2c8374] hover:bg-[#1e5f54] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2c8374] focus:ring-offset-2 inline-flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              {isLogging ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('moodLogger.connecting', 'Ansluter till server...')}
                </>
              ) : !canLogMore ? (
                <>
                  <span>🔒</span>
                  {t('moodLogger.dailyLimitReachedButton', 'Daglig gräns nådd')}
                </>
              ) : (
                <>
                  <span>✅</span>
                  {hasMeaningfulNote ? t('moodLogger.logCompleteCheckIn', 'Logga komplett check-in') : t('moodLogger.logMood', 'Logga humör')}
                </>
              )}
            </button>
          )}
          {!canLogMore && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('moodLogger.upgradeForUnlimited', 'Uppgradera till Premium för obegränsade loggningar')}
            </p>
          )}
        </div>
      )}

      {/* Recent Moods */}
      <Card className="mt-8 border border-[#f2e4d4]">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-[#2f2a24] dark:text-white flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-[#2c8374]" aria-hidden="true" />
              {t('moodLogger.recentMoods', 'Dina senaste humör')}
            </h3>
            {/* Weekly streak indicator */}
            {weeklyStreak > 0 && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                {t('moodLogger.logsThisWeek', '{{count}} loggningar denna vecka 💪', { count: weeklyStreak })}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {groupedRecentMoods.length > 0 ? (
              groupedRecentMoods.map((group) => (
                <section key={group.key} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#6d645d] dark:text-gray-400">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.entries.map((mood, index) => {
                      const moodVisual = getMoodVisual(mood.score);
                      const MoodIcon = moodVisual.Icon;
                      
                      // Flatten all entries to calculate trend
                      const allEntries = groupedRecentMoods.flatMap(g => g.entries);
                      const moodIndex = allEntries.findIndex(e => e.id === mood.id);
                      const trend = getTrend(moodIndex, allEntries);

                      return (
                        <div 
                          key={mood.id || `${group.key}-${index}`} 
                          className="group flex items-center justify-between py-3 px-3 rounded-xl hover:bg-[#fff7f0] dark:hover:bg-slate-800/70 transition-colors border-b border-[#f2e4d4] dark:border-slate-700 last:border-0"
                          title={mood.note || undefined}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${moodVisual.iconBgClass}`} aria-hidden="true">
                              <MoodIcon className={`w-5 h-5 ${moodVisual.iconClass}`} />
                            </div>
                            <div>
                              <div className="font-medium text-[#2f2a24] dark:text-white flex items-center gap-2">
                                {mood.mood || t('mood.unknown', 'Humör')}
                                {/* Trend indicator */}
                                {trend && (
                                  <span className={`text-xs ${
                                    trend === 'up' ? 'text-emerald-500' : 
                                    trend === 'down' ? 'text-orange-500' : 
                                    'text-gray-400'
                                  }`}>
                                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-[#6d645d] dark:text-gray-400">
                                {mood.timestamp.toLocaleTimeString('sv-SE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${moodVisual.scoreBadgeClass}`}>
                            {mood.score}/10
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p className="mb-1">{t('moodLogger.noMoodsYet', 'Inga humör loggade ännu')}</p>
                <p className="text-sm">{t('moodLogger.startLogging', 'Börja logga dina humör för att se historik här')}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MoodLogger;
