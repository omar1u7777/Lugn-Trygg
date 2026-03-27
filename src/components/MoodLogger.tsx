import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { logMood, getMoods } from '../api/api';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Card } from './ui/tailwind';
import { UsageLimitBanner } from './UsageLimitBanner';
import { logger } from '../utils/logger';


interface MoodLoggerProps {
  onMoodLogged?: (mood?: number, note?: string) => void;
}

interface RecentMood {
  id?: string;
  mood: string;
  score: number;
  timestamp: Date;
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

const getMoodLabelFromScore = (score: number): string => {
  if (score >= 9) return 'Super';
  if (score >= 7) return 'Glad';
  if (score >= 5) return 'Bra';
  if (score >= 4) return 'Neutral';
  if (score >= 2) return 'Orolig';
  return 'Ledsen';
};

const normalizeMoodLabel = (rawLabel: string, score: number): string => {
  const trimmed = rawLabel.trim();
  if (!trimmed) {
    return getMoodLabelFromScore(score);
  }

  const normalized = trimmed.toLowerCase();
  const looksLikeSentence = trimmed.length > 18 || normalized.includes(' ');

  // If backend text looks like a note/sentence instead of a mood word,
  // fall back to deterministic label from score.
  if (!VALID_MOOD_LABELS.has(normalized) || looksLikeSentence) {
    return getMoodLabelFromScore(score);
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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

  const handleMoodSelect = (mood: typeof moods[0]) => {
    setSelectedMood(mood.value);
    setLimitError(null);
    announceToScreenReader(`Valde humör: ${mood.label}`, 'polite');

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
      announceToScreenReader('Du har nått din dagliga gräns för humörloggningar', 'assertive');
      return;
    }

    if (isDuplicateMoodWithinCooldown(selectedMood)) {
      const duplicateMessage = 'Du loggade samma humör nyligen. Vänta några minuter innan du loggar samma känsla igen.';
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

      announceToScreenReader('Humör loggat framgångsrikt', 'polite');

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
        const friendlyMessage = serverMessage || 'Du har nått din dagliga gräns för humörloggningar.';
        setLimitError(friendlyMessage);
        announceToScreenReader(friendlyMessage, 'assertive');
        refreshSubscription().catch(() => null);
      } else {
        announceToScreenReader('Misslyckades att logga humör', 'assertive');
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
            moodText = 'Anteckning';
          }
          if (mood.note && typeof mood.note === 'string' && mood.note.startsWith('U2FsdGVk')) {
            // Note is encrypted, don't show it
            moodText = moodText || 'Humör';
          }
          
          // Derive proper label from score when text is generic 'neutral' or missing
          // This fixes legacy moods that were stored with 'neutral' regardless of score

          // Get score - handle different possible field names
          let score = 0;
          if (typeof mood.score === 'number') {
            score = mood.score;
          } else if (typeof mood.sentiment_score === 'number') {
            // Convert sentiment score (-1 to 1) to 1-10 scale
            score = Math.round((mood.sentiment_score + 1) * 4.5 + 1);
          }
          // Clamp to 0-10 range
          score = Math.max(0, Math.min(10, score));

          moodText = normalizeMoodLabel(moodText, score);

          return {
            id: mood.id || mood.docId,
            mood: moodText,
            score: score,
            timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
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
            aria-label="Tillbaka till dashboard"
          >
            <span aria-hidden="true">←</span>
            Tillbaka till Dashboard
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-6">
            Välj ditt humör
          </h2>

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
                Valt humör: {moods.find(m => m.value === selectedMood)?.label}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Optional Note */}
      {selectedMood && (
        <Card className="mb-6">
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Lägg till en anteckning (valfritt)
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vad får dig att känna så här idag? ✨"
              className="w-full p-4 border-2 border-[#e8dcd0] rounded-2xl resize-none transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-[#2c8374]/30 focus:border-[#2c8374]
                bg-white/80 backdrop-blur-sm text-[#2f2a24] placeholder-[#a89f97]
                dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              rows={3}
              maxLength={200}
            />
            <div className="text-right text-sm text-[#6d645d] mt-2 font-medium">
              {note.length}/200 tecken
            </div>
          </div>
        </Card>
      )}


      {/* Log Button */}
      {selectedMood && (
        <div className="text-center">
          <button
            onClick={handleLogMood}
            disabled={isLogging || !canLogMore}
            className="px-6 sm:px-8 py-3 text-base sm:text-lg font-medium text-white bg-[#2c8374] hover:bg-[#1e5f54] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2c8374] focus:ring-offset-2 inline-flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            {isLogging ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loggar humör...
              </>
            ) : !canLogMore ? (
              <>
                <span>🔒</span>
                Daglig gräns nådd
              </>
            ) : (
              <>
                <span>✅</span>
                Logga humör
              </>
            )}
          </button>
          {!canLogMore && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Uppgradera till Premium för obegränsade loggningar
            </p>
          )}
        </div>
      )}

      {/* Recent Moods */}
      <Card className="mt-8 border border-[#f2e4d4]">
        <div className="p-4 sm:p-6">
          <h3 className="text-xl font-semibold text-[#2f2a24] dark:text-white mb-4 flex items-center gap-2">
            <span>📊</span> Dina senaste humör
          </h3>
          <div className="space-y-3">
            {recentMoods.length > 0 ? (
              recentMoods.map((mood, index) => {
                // Determine emoji based on score (1-10 scale)
                const getEmoji = (score: number) => {
                  if (score >= 9) return '🤩';  // Super (9-10)
                  if (score >= 7) return '😊';  // Glad (7-8)
                  if (score >= 5) return '🙂';  // Bra (5-6)
                  if (score >= 4) return '😐';  // Neutral (4)
                  if (score >= 2) return '😟';  // Orolig (2-3)
                  return '😢';                   // Ledsen (0-1)
                };
                
                return (
                <div key={mood.id || index} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-[#fff7f0] dark:hover:bg-slate-800/70 transition-colors border-b border-[#f2e4d4] dark:border-slate-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#fff7f0] flex items-center justify-center">
                      <span className="text-xl">
                        {getEmoji(mood.score)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-[#2f2a24] dark:text-white">{mood.mood || t('mood.unknown', 'Humör')}</div>
                      <div className="text-sm text-[#6d645d] dark:text-gray-400">
                        {mood.timestamp.toLocaleDateString('sv-SE', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-[#2c8374]/10 text-[#1e5f54] rounded-full text-sm font-semibold">
                    {mood.score}/10
                  </span>
                </div>
              );
              })
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p className="mb-1">Inga humör loggade ännu</p>
                <p className="text-sm">Börja logga dina humör för att se historik här</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MoodLogger;
