/**
 * SuperMoodLogger - The Ultimate Mood Tracking System
 * Combines best features from all mood loggers:
 * - Circumplex Model (Valence + Arousal)
 * - Tag System (Multi-select)
 * - Recent moods display
 * - Voice recording
 * - Premium UX
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChartBarIcon,
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
  timestamp?: { toDate: () => Date } | string | number | Date;
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

const getReflectionPrompt = (score: number): string => {
  if (score <= 3) return 'Vad skulle kännas mest hjälpsamt för dig de kommande 60 minuterna?';
  if (score <= 5) return 'Vad har påverkat ditt mående mest hittills idag?';
  if (score <= 8) return 'Vad bidrog till att du känner dig okej eller bra just nu?';
  return 'Vad vill du ta med dig från den här positiva känslan resten av dagen?';
};

export const SuperMoodLogger: React.FC<SuperMoodLoggerProps> = ({
  onMoodLogged,
  showRecentMoods = false,
  enableVoiceRecording = false,
}) => {
  const { t } = useTranslation();
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
  
  const lastMoodSubmissionRef = useRef<{ moodScore: number; timestampMs: number } | null>(null);
  const submitLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const moods = [
    { emoji: '😢', label: 'Ledsen', value: 2, description: 'Känner mig ledsen eller nedstämd' },
    { emoji: '😟', label: 'Orolig', value: 3, description: 'Känner oro eller ångest' },
    { emoji: '😐', label: 'Neutral', value: 5, description: 'Känner mig varken bra eller dåligt' },
    { emoji: '🙂', label: 'Bra', value: 7, description: 'Känner mig ganska bra' },
    { emoji: '😊', label: 'Glad', value: 8, description: 'Känner mig glad och positiv' },
    { emoji: '🤩', label: 'Super', value: 10, description: 'Känner mig fantastisk!' },
  ];

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const loadRecentMoods = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const moodsResponse = await getMoods(user.user_id);
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) return;
      
      const normalized: RecentMood[] = (moodsResponse || [])
        .map((mood: RawMoodEntry) => {
          const timestamp = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
          const score = mood.score || mood.sentiment_score || 5;
          // Always derive display label from score for consistency.
          // Old entries may have incorrect mood_text (e.g., "neutral" for all scores).
          const moodText = getMoodLabel(score);
          
          return {
            id: mood.id || mood.docId,
            mood: moodText,
            score,
            timestamp,
            note: mood.note,
            tags: mood.tags,
            valence: mood.valence,
            arousal: mood.arousal,
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      setRecentMoods(normalized);
    } catch (err) {
      logger.error('Failed to load recent moods:', err);
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (showRecentMoods && user?.user_id) {
      void loadRecentMoods();
    }
  }, [user?.user_id, showRecentMoods, loadRecentMoods]);

  const handleMoodSelect = (mood: typeof moods[0]) => {
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
    
    announceToScreenReader(t('moodLogger.moodSelected', 'Valde humör: {{mood}}', { mood: mood.label }), 'polite');
  };

  const isDuplicateMoodWithinCooldown = (moodScore: number): boolean => {
    const last = lastMoodSubmissionRef.current;
    if (!last) return false;
    
    const now = Date.now();
    const elapsed = now - last.timestampMs;
    
    return last.moodScore === moodScore && elapsed < DUPLICATE_MOOD_COOLDOWN_MS;
  };

  const handleLogMood = async () => {
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

    submitLockRef.current = true;
    setIsLogging(true);
    setLimitError(null);

    try {
      const moodObj = moods.find(m => m.value === selectedMood);
      const moodText = moodObj?.label || 'Neutral';
      const trimmedNote = note.trim();

      if (audioBlob) {
        const formData = new FormData();
        formData.append('score', String(selectedMood));
        formData.append('mood_text', moodText);
        formData.append('note', trimmedNote || `Känner mig ${moodText.toLowerCase()}`);
        if (showAdvanced && valence) formData.append('valence', String(valence));
        if (showAdvanced && arousal) formData.append('arousal', String(arousal));
        if (selectedTags.length > 0) formData.append('tags', JSON.stringify(selectedTags));
        if (context.trim()) formData.append('context', context.trim());
        formData.append('audio', audioBlob, 'recording.webm');

        await api.post(API_ENDPOINTS.MOOD.LOG_MOOD, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await logMood(user.user_id, {
          score: selectedMood,
          mood_text: moodText,
          note: trimmedNote || `Känner mig ${moodText.toLowerCase()}`,
          valence: showAdvanced ? valence : undefined,
          arousal: showAdvanced ? arousal : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          context: context.trim() || undefined,
        });
      }

      incrementMoodLog();
      lastMoodSubmissionRef.current = { moodScore: selectedMood, timestampMs: Date.now() };

      analytics.track('Mood Logged', {
        mood_value: selectedMood,
        mood_text: moodText,
        has_note: note.length > 0,
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
        setLimitError(friendlyMessage); // Reuse limitError state for general errors
      }
    } finally {
      setIsLogging(false);
      submitLockRef.current = false;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      logger.error('Failed to start recording', err as Error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const groupedMoods = recentMoods.reduce<RecentMoodGroup[]>((groups, mood) => {
    const dayKey = mood.timestamp.toLocaleDateString('sv-SE');
    const today = new Date().toLocaleDateString('sv-SE');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');
    
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

  const canSubmit = selectedMood !== null;
  const reflectionPrompt = selectedMood !== null ? getReflectionPrompt(selectedMood) : '';

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
              {t('moodLogger.selectMood', 'Välj humör')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {moods.map(mood => {
                const _visual = getMoodVisual(mood.value);
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
                      {mood.label}
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
            </div>
          )}

          {/* Submit Button */}
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
      </Card>

      {/* Recent Moods */}
      {showRecentMoods && recentMoods.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('moodLogger.recentMoods', 'Senaste humörloggningar')}
            </h3>
          </div>

          <div className="space-y-4">
            {groupedMoods.map(group => (
              <div key={group.key}>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {group.label}
                </h4>
                <div className="space-y-2">
                  {group.entries.map((mood, idx) => {
                    const visual = getMoodVisual(mood.score);
                    const Icon = visual.Icon;
                    
                    return (
                      <div
                        key={mood.id || idx}
                        className={`p-3 rounded-lg border ${visual.iconBgClass} border-gray-200 dark:border-gray-700`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${visual.iconBgClass}`}>
                            <Icon className={`w-5 h-5 ${visual.iconClass}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {mood.mood}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${visual.scoreBadgeClass}`}>
                                {mood.score}/10
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {mood.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {mood.note && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {mood.note}
                              </p>
                            )}
                            {mood.tags && mood.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {mood.tags.map((tag, tidx) => (
                                  <span
                                    key={tidx}
                                    className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs"
                                  >
                                    #{tag}
                                  </span>
                                ))}
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
        </Card>
      )}
    </div>
  );
};
