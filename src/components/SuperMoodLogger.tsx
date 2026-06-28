/**
 * SuperMoodLogger - The Ultimate Mood Tracking System
 * Combines best features from all mood loggers:
 * - Circumplex Model (Valence + Arousal)
 * - Tag System (Multi-select)
 * - Recent moods display
 * - Voice recording
 * - Premium UX
 */

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  FaceFrownIcon,
  FaceSmileIcon,
  MinusCircleIcon,
  SparklesIcon,
  MicrophoneIcon,
} from '@heroicons/react/24/outline';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { logMood, getMoods } from '../api/api';
import { api } from '../api/client';
import { API_ENDPOINTS } from '../api/constants';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Card } from './ui/tailwind';
import { CircumplexSliders } from './mood/CircumplexSliders';
import { TagSelector } from './mood/TagSelector';
import { logger } from '../utils/logger';
import { getMoodLabel } from '../features/mood/utils';
import type { AxiosError } from 'axios';

interface SuperMoodLoggerProps {
  onMoodLogged?: (mood?: number, note?: string) => void;
  showRecentMoods?: boolean;
  enableVoiceRecording?: boolean;
}

interface RecentMood {
  id?: string;
  mood: string;
  score: number;
  timestamp: Date;
  note?: string;
  tags?: string[];
  valence?: number;
  arousal?: number;
}

/** Timestamp shapes returned by the API (Firestore, ISO string, epoch, Date) */
type FirestoreTimestamp = { toDate: () => Date };
type RawTimestamp = FirestoreTimestamp | string | number | Date;

/** Raw mood entry from API — fields may vary since backend is flexible */
interface RawMoodEntry {
  id?: string;
  docId?: string;
  score?: number;
  sentiment_score?: number;
  mood_text?: string;
  note?: string;
  tags?: string[];
  valence?: number;
  arousal?: number;
  timestamp?: RawTimestamp;
}

interface RecentMoodGroup {
  key: string;
  label: string;
  entries: RecentMood[];
}

const DUPLICATE_MOOD_COOLDOWN_MS = 5 * 60 * 1000;

const getMoodVisual = (score: number) => {
  if (score >= 10) {
    return {
      Icon: SparklesIcon,
      emoji: '🤩',
      iconClass: 'text-amber-600 dark:text-amber-300',
      iconBgClass: 'bg-amber-50 dark:bg-amber-900/30',
      scoreBadgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    };
  }
  if (score >= 8) {
    return {
      Icon: FaceSmileIcon,
      emoji: '😊',
      iconClass: 'text-emerald-600 dark:text-emerald-300',
      iconBgClass: 'bg-emerald-50 dark:bg-emerald-900/30',
      scoreBadgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    };
  }
  if (score >= 7) {
    return {
      Icon: FaceSmileIcon,
      emoji: '🙂',
      iconClass: 'text-teal-600 dark:text-teal-300',
      iconBgClass: 'bg-teal-50 dark:bg-teal-900/30',
      scoreBadgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    };
  }
  if (score >= 5) {
    return {
      Icon: MinusCircleIcon,
      emoji: '😐',
      iconClass: 'text-slate-600 dark:text-slate-300',
      iconBgClass: 'bg-slate-100 dark:bg-slate-700/40',
      scoreBadgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    };
  }
  if (score >= 3) {
    return {
      Icon: ExclamationTriangleIcon,
      emoji: '😟',
      iconClass: 'text-orange-600 dark:text-orange-300',
      iconBgClass: 'bg-orange-50 dark:bg-orange-900/30',
      scoreBadgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    };
  }
  return {
    Icon: FaceFrownIcon,
    emoji: '😢',
    iconClass: 'text-rose-600 dark:text-rose-300',
    iconBgClass: 'bg-rose-50 dark:bg-rose-900/30',
    scoreBadgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  };
};

const getReflectionPrompt = (score: number, t: (key: string) => string): string => {
  if (score <= 3) return t('moodLogger.reflectionPrompts.low');
  if (score <= 5) return t('moodLogger.reflectionPrompts.mid');
  if (score <= 8) return t('moodLogger.reflectionPrompts.good');
  return t('moodLogger.reflectionPrompts.high');
};

/** Convert any raw timestamp shape into a Date (or null if invalid/missing). */
function parseTimestamp(raw: RawTimestamp | undefined): Date | null {
  if (!raw) return null;
  if (typeof raw === 'object' && 'toDate' in raw && typeof raw.toDate === 'function') {
    return raw.toDate();
  }
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

const MOODS = [
  { emoji: '😢', labelKey: 'sad', value: 2 },
  { emoji: '😟', labelKey: 'anxious', value: 3 },
  { emoji: '😐', labelKey: 'neutral', value: 5 },
  { emoji: '🙂', labelKey: 'good', value: 7 },
  { emoji: '😊', labelKey: 'happy', value: 8 },
  { emoji: '🤩', labelKey: 'super', value: 10 },
];

export const SuperMoodLogger: React.FC<SuperMoodLoggerProps> = ({
  onMoodLogged,
  showRecentMoods = false,
  enableVoiceRecording = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'no' ? 'nb-NO' : i18n.language === 'en' ? 'en-US' : 'sv-SE';
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const { canLogMood, incrementMoodLog, plan } = useSubscription();

  // Mood selection
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  
  // Circumplex Model
  const [valence, setValence] = useState(5);
  const [arousal, setArousal] = useState(5);
  
  // Tags and context
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [context, setContext] = useState('');
  
  // UI state
  const [isLogging, setIsLogging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentMoods, setRecentMoods] = useState<RecentMood[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);
  
  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const lastMoodSubmissionRef = useRef<{ moodScore: number; timestampMs: number } | null>(null);
  const submitLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const moods = MOODS;

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const loadRecentMoods = useCallback(async () => {
    if (!user?.user_id) return;

    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const moodsResponse = await getMoods(user.user_id, abortControllerRef.current.signal);
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return;
      
      const normalized: RecentMood[] = (moodsResponse || [])
        .map((mood: RawMoodEntry, index: number): RecentMood | null => {
          const timestamp = parseTimestamp(mood.timestamp);

          // Skip entries with invalid timestamps
          if (!timestamp) {
            return null;
          }

          const score = mood.score || mood.sentiment_score || 5;
          // Always derive display label from score for consistency.
          // Old entries may have incorrect mood_text (e.g., "neutral" for all scores).
          const moodText = getMoodLabel(score);

          const entry: RecentMood = {
            id: mood.id || mood.docId || `${timestamp.getTime()}-${score}-${index}`,
            mood: moodText,
            score,
            timestamp,
          };
          if (mood.note !== undefined) entry.note = mood.note;
          if (mood.tags !== undefined) entry.tags = mood.tags;
          if (mood.valence !== undefined) entry.valence = mood.valence;
          if (mood.arousal !== undefined) entry.arousal = mood.arousal;
          return entry;
        })
        .filter((mood): mood is RecentMood => mood !== null)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      setRecentMoods(normalized);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      logger.error('Failed to load recent moods:', err);
    } finally {
      if (abortControllerRef.current?.signal.aborted) {
        abortControllerRef.current = null;
      }
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (showRecentMoods && user?.user_id) {
      void loadRecentMoods();
    }
  }, [user?.user_id, showRecentMoods, loadRecentMoods]);

  const handleMoodSelect = useCallback((mood: typeof moods[0]) => {
    setSelectedMood(mood.value);
    
    // Auto-adjust Circumplex values
    if (mood.value <= 3) {
      setValence(3);
      setArousal(mood.value === 2 ? 3 : 6);
    } else if (mood.value <= 5) {
      setValence(5);
      setArousal(5);
    } else if (mood.value <= 7) {
      setValence(7);
      setArousal(6);
    } else {
      setValence(9);
      setArousal(mood.value === 10 ? 9 : 7);
    }
    
    announceToScreenReader(t('moodLogger.moodSelected', { mood: t(`moodLogger.moodLabels.${mood.labelKey}`) }) || t(`moodLogger.moodLabels.${mood.labelKey}`), 'polite');
  }, [t, announceToScreenReader]);

  const handleResetAdvanced = useCallback(() => {
    setValence(5);
    setArousal(5);
    setSelectedTags([]);
    setContext('');
  }, []);

  const handleQuadrantChange = useCallback((score: number) => {
    setSelectedMood(score);
  }, []);

  const isDuplicateMoodWithinCooldown = (moodScore: number): boolean => {
    const last = lastMoodSubmissionRef.current;
    if (!last) return false;
    
    const now = Date.now();
    const elapsed = now - last.timestampMs;
    
    return last.moodScore === moodScore && elapsed < DUPLICATE_MOOD_COOLDOWN_MS;
  };

  const handleLogMood = useCallback(async () => {
    if (selectedMood === null || !user?.user_id) return;
    if (isLogging || submitLockRef.current) return;

    if (!canLogMood()) {
      const message = t('moodLogger.dailyLimitReached', 'Du har nått din dagliga gräns för humörloggningar.');
      setLimitError(message);
      announceToScreenReader(message, 'assertive');
      return;
    }

    if (isDuplicateMoodWithinCooldown(selectedMood)) {
      announceToScreenReader(t('moodLogger.duplicateWarning', 'Du loggade precis samma humör'), 'polite');
      return;
    }

    // Validate note: if provided, must have at least 3 unique non-whitespace characters
    if (note.trim()) {
      const uniqueChars = new Set(note.replace(/\s/g, ''));
      if (uniqueChars.size < 3) {
        const message = t('moodLogger.noteTooSimple', 'Anteckningen verkar vara för upprepad. Skriv något mer meningsfullt.');
        setLimitError(message);
        announceToScreenReader(message, 'assertive');
        return;
      }
    }

    submitLockRef.current = true;
    setIsLogging(true);
    setLimitError(null);

    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const moodText = getMoodLabel(selectedMood);
      const trimmedNote = note.trim();

      if (audioBlob) {
        const formData = new FormData();
        formData.append('score', String(selectedMood));
        formData.append('mood_text', moodText);
        formData.append('note', trimmedNote);
        if (showAdvanced && valence) formData.append('valence', String(valence));
        if (showAdvanced && arousal) formData.append('arousal', String(arousal));
        if (selectedTags.length > 0) formData.append('tags', JSON.stringify(selectedTags));
        if (context.trim()) formData.append('context', context.trim());
        formData.append('audio', audioBlob, 'recording.webm');

        await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, formData, { signal: abortControllerRef.current!.signal });
      } else {
        await logMood(user.user_id, {
          score: selectedMood,
          mood_text: moodText,
          note: trimmedNote,
          valence: showAdvanced ? valence : undefined,
          arousal: showAdvanced ? arousal : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          context: context.trim() || undefined,
        }, undefined, abortControllerRef.current!.signal);
      }

      if (!isMountedRef.current) return;

      incrementMoodLog();
      lastMoodSubmissionRef.current = { moodScore: selectedMood, timestampMs: Date.now() };

      analytics.track('Mood Logged', {
        mood_value: selectedMood,
        mood_text: moodText,
        has_note: trimmedNote.length > 0,
        has_tags: selectedTags.length > 0,
        has_circumplex: showAdvanced,
        has_voice: !!audioBlob,
        subscription_tier: plan.tier,
      });

      announceToScreenReader(t('moodLogger.moodLoggedSuccess', 'Humör loggat!'), 'polite');
      onMoodLogged?.(selectedMood, trimmedNote);

      // Refresh recent moods
      if (showRecentMoods) {
        await loadRecentMoods();
      }

      if (!isMountedRef.current) return;

      // Reset form
      setSelectedMood(null);
      setNote('');
      setContext('');
      setSelectedTags([]);
      setValence(5);
      setArousal(5);
      setShowAdvanced(false);
      setAudioBlob(null);

    } catch (error: unknown) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      logger.error('Failed to log mood:', error);
      const axiosError = error as AxiosError<{ error?: string }>;
      const quotaExceeded = axiosError.response?.status === 429;
      
      if (quotaExceeded) {
        const serverMessage = axiosError.response?.data?.error;
        const friendlyMessage = serverMessage || t('moodLogger.dailyLimitReachedMessage');
        setLimitError(friendlyMessage);
        announceToScreenReader(friendlyMessage, 'assertive');
      } else {
        const friendlyMessage = t('moodLogger.moodLogFailed', 'Kunde inte logga humör. Försök igen.');
        announceToScreenReader(friendlyMessage, 'assertive');
        setLimitError(friendlyMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLogging(false);
      }
      submitLockRef.current = false;
      abortControllerRef.current = null;
    }
  }, [selectedMood, user, isLogging, canLogMood, t, announceToScreenReader, moods, note, showAdvanced, valence, arousal, selectedTags, context, audioBlob, plan.tier, onMoodLogged, showRecentMoods, loadRecentMoods, incrementMoodLog]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (isMountedRef.current) {
          setAudioBlob(blob);
        }
      };

      mediaRecorder.start();
      if (isMountedRef.current) {
        setIsRecording(true);
      }
    } catch (err) {
      logger.error('Failed to start recording', err as Error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (isMountedRef.current) {
        setIsRecording(false);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const groupedMoods = useMemo(() => {
    return recentMoods.reduce<RecentMoodGroup[]>((groups, mood) => {
      const dayKey = mood.timestamp.toLocaleDateString(locale);
      const today = new Date().toLocaleDateString(locale);
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(locale);

      let label = dayKey;
      if (dayKey === today) label = t('moodLogger.today', 'Idag');
      else if (dayKey === yesterday) label = t('moodLogger.yesterday', 'Igår');

      let group = groups.find(g => g.key === dayKey);
      if (!group) {
        group = { key: dayKey, label, entries: [] };
        groups.push(group);
      }
      group.entries.push(mood);
      return groups;
    }, []);
  }, [recentMoods, t, locale]);

  const canSubmit = selectedMood !== null;
  const reflectionPrompt = selectedMood !== null ? getReflectionPrompt(selectedMood, t) : '';

  return (
    <div className="space-y-6">
      {/* Main Logger Card */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('moodLogger.title', 'Hur mår du?')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('moodLogger.subtitle', 'Logga ditt humör för att följa dina mönster över tid')}
            </p>
          </div>

          {/* Limit Error */}
          {limitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{limitError}</p>
            </div>
          )}

          {/* Mood Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('moodLogger.selectMood', 'Välj humör')} <span className="text-red-500" title={t('moodLogger.required', 'Obligatoriskt')} aria-label={t('moodLogger.required', 'Obligatoriskt')}>*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {moods.map(mood => {
                const isSelected = selectedMood === mood.value;
                
                return (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => handleMoodSelect(mood)}
                    disabled={isLogging}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900 scale-105'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:scale-102'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
                    `}
                  >
                    <div className="text-4xl mb-2">{mood.emoji}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t(`moodLogger.moodLabels.${mood.labelKey}`)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {mood.value}/10
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reflection Prompt */}
          {selectedMood !== null && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 italic">
                💭 {reflectionPrompt}
              </p>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('moodLogger.note', 'Anteckning (valfritt)')}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={reflectionPrompt || t('moodLogger.notePlaceholder', 'Vad tänker du på just nu?')}
              disabled={isLogging}
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {note.length}/1000
            </p>
          </div>

          {/* Voice Recording */}
          {enableVoiceRecording && (
            <div>
              <button
                type="button"
                onClick={() => isRecording ? stopRecording() : startRecording()}
                disabled={isLogging}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors
                  ${isRecording 
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <MicrophoneIcon className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {isRecording ? t('moodLogger.stopRecording', 'Stoppa inspelning') : t('moodLogger.startRecording', 'Spela in röst')}
                </span>
              </button>
              {audioBlob && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✓ {t('moodLogger.audioRecorded', 'Röstinspelning klar')}
                </p>
              )}
            </div>
          )}

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            {showAdvanced 
              ? t('moodLogger.hideAdvanced', '▼ Dölj avancerade alternativ')
              : t('moodLogger.showAdvanced', '▶ Visa avancerade alternativ (Circumplex + Taggar)')
            }
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-6 p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
              <CircumplexSliders
                valence={valence}
                arousal={arousal}
                onValenceChange={setValence}
                onArousalChange={setArousal}
                disabled={isLogging}
                onQuadrantChange={handleQuadrantChange}
              />

              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                disabled={isLogging}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('moodLogger.context', 'Kontext (valfritt)')}
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={t('moodLogger.contextPlaceholder', 't.ex. "hemma", "på jobbet", "ute"')}
                  disabled={isLogging}
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Reset Advanced */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetAdvanced}
                  disabled={isLogging}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('moodLogger.resetAdvanced', 'Återställ avancerat')}
                </button>
              </div>

              {/* Submit button inside advanced section */}
              <button
                onClick={handleLogMood}
                disabled={!canSubmit || isLogging}
                className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
                         transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLogging
                  ? t('moodLogger.logging', 'Loggar...')
                  : t('moodLogger.logMood', 'Logga humör')
                }
              </button>
            </div>
          )}

          {/* Submit Button (hidden when advanced is open — advanced section has its own) */}
          {!showAdvanced && (
            <button
              onClick={handleLogMood}
              disabled={!canSubmit || isLogging}
              className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
                       transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLogging 
                ? t('moodLogger.logging', 'Loggar...')
                : t('moodLogger.logMood', 'Logga humör')
              }
            </button>
          )}
        </div>
      </Card>

      {/* Recent Moods - Hidden on dashboard to prevent layout shift */}
      {showRecentMoods && recentMoods.length > 0 && (
        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            {t('moodLogger.recentMoods', 'Dina senaste humör')}
          </h3>
          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="space-y-4">
              {groupedMoods.map(group => (
                <div key={group.key}>
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {group.label}
                  </h4>
                  <div className="space-y-2">
                    {group.entries.map((mood, _idx) => {
                      const visual = getMoodVisual(mood.score);
                      const Icon = visual.Icon;

                      return (
                        <div
                          key={mood.id}
                          className={`p-2 rounded-lg border ${visual.iconBgClass} border-gray-200 dark:border-gray-700`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-lg ${visual.iconBgClass} flex-shrink-0`}>
                              <Icon className={`w-4 h-4 ${visual.iconClass}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {mood.mood}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${visual.scoreBadgeClass} flex-shrink-0`}>
                                  {mood.score}/10
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                                  {mood.timestamp.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {mood.note && (
                                <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate mt-0.5">
                                  {mood.note}
                                </p>
                              )}
                              {mood.tags && mood.tags.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {mood.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="text-[8px] px-1 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full font-medium">
                                      #{tag}
                                    </span>
                                  ))}
                                  {mood.tags.length > 2 && (
                                    <span className="text-[8px] text-gray-500 dark:text-gray-400">
                                      +{mood.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
