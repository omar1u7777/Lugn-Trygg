/**
 * Daily Insights Component
 * Fetches AI-powered personalised insights from the v2 backend engine.
 * The backend performs: linear regression, Cohen's d, Pearson correlation,
 * CBT/ACT domain classification, circadian analysis, and social rhythm metrics.
 *
 * 100% Tailwind Native - No MUI Dependencies
 */

import React, { useCallback, useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  LightBulbIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { trackEvent } from '../services/analytics';
import { logger } from '../utils/logger';
import {
  generateInsights,
  getPendingInsights,
  dismissInsight,
  markInsightActionTaken,
  type BackendInsight,
} from '../api/insights';

interface DailyInsightsProps {
  userId: string;
}

/** Map urgency to visual styling */
const URGENCY_STYLES: Record<string, { border: string; icon: React.ReactNode; badge: string }> = {
  high: {
    border: 'border-rose-300 dark:border-rose-700',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    icon: <ExclamationTriangleIcon className="w-5 h-5 text-rose-500" />,
  },
  medium: {
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    icon: <InformationCircleIcon className="w-5 h-5 text-amber-500" />,
  },
  low: {
    border: 'border-teal-200 dark:border-teal-700',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
    icon: <LightBulbIcon className="w-5 h-5 text-teal-500" />,
  },
};

/** Map CBT/ACT domain to i18n key suffix */
const DOMAIN_KEYS: readonly string[] = [
  'behavioral_activation',
  'cognitive_restructuring',
  'sleep_hygiene',
  'social_connection',
  'mindfulness',
  'physical_activity',
  'emotion_regulation',
] as const;

const GENERATE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes — backend already caches via _already_generated_today

export const DailyInsights: React.FC<DailyInsightsProps> = ({ userId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<BackendInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const isMounted = useRef(true);

  const abortControllerRef = useRef<AbortController | null>(null);

  const MAX_RETRIES = 3;
  const GENERATE_CACHE_KEY = 'insights_last_generate';

  const loadInsights = useCallback(async () => {
    if (!userId) return;

    // Cancel any in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      // Try pending insights first (already generated, no cost)
      let pending = await getPendingInsights(userId, controller.signal);

      // If none pending, trigger generation (runs v2 ML pipeline)
      // Backend already caches via _already_generated_today(), so frontend cooldown
      // is just a short anti-spam guard, not a hard 12h block.
      if (pending.length === 0 && !controller.signal.aborted) {
        const lastGenerate = localStorage.getItem(GENERATE_CACHE_KEY);
        const now = Date.now();
        const shouldGenerate = !lastGenerate || (now - parseInt(lastGenerate, 10)) > GENERATE_COOLDOWN_MS;

        if (shouldGenerate) {
          setGenerating(true);
          const generated = await generateInsights(userId, controller.signal);
          pending = generated;
          localStorage.setItem(GENERATE_CACHE_KEY, String(now));
        }
      }

      if (!controller.signal.aborted) {
        setInsights(pending);
        setRetryCount(0);
        trackEvent('daily_insights_viewed', { userId, count: pending.length });
      }
    } catch (err) {
      if ((err instanceof Error && err.name === 'AbortError') || controller.signal.aborted) {
        return; // Ignore abort errors
      }
      logger.error('Failed to load insights:', err);
      setRetryCount(c => c + 1);
      setError(t('insights.error'));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setGenerating(false);
      }
    }
  }, [userId, t]);

  useEffect(() => {
    loadInsights();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadInsights]);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      isMounted.current = false;
      Object.values(timeoutRef.current).forEach(clearTimeout);
      timeoutRef.current = {};
    };
  }, []);

  const handleDismiss = async (insightId: string) => {
    if (!userId) return;
    setActionStates(s => ({ ...s, [insightId]: 'loading' }));
    try {
      await dismissInsight(insightId, abortControllerRef.current?.signal);
      setInsights(prev => prev.filter(i => i.insight_id !== insightId));
      trackEvent('insight_dismissed', { userId, insightId });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('Failed to dismiss insight:', err);
      setActionStates(s => ({ ...s, [insightId]: 'idle' }));
      setActionError(t('insights.error'));
    }
  };

  const handleAction = async (insightId: string, action: string) => {
    if (!userId) return;
    setActionStates(s => ({ ...s, [insightId]: 'loading' }));
    try {
      await markInsightActionTaken(insightId, action, abortControllerRef.current?.signal);
      setActionStates(s => ({ ...s, [insightId]: 'done' }));
      trackEvent('insight_action_taken', { userId, insightId, action });

      // Navigate to mood logging if action suggests it (multilingual)
      const moodNavKeywords = ['logga', 'månde', 'mood', 'log', 'humør', 'logg'];
      if (moodNavKeywords.some(kw => action.toLowerCase().includes(kw))) {
        navigate('/mood-basic');
      }

      // Remove after short delay to show confirmation
      const timeoutId = setTimeout(() => {
        if (isMounted.current) {
          setInsights(prev => prev.filter(i => i.insight_id !== insightId));
          setActionStates(s => { const n = { ...s }; delete n[insightId]; return n; });
        }
        delete timeoutRef.current[insightId];
      }, 1200);
      timeoutRef.current[insightId] = timeoutId;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('Failed to record insight action:', err);
      setActionStates(s => ({ ...s, [insightId]: 'idle' }));
      setActionError(t('insights.error'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <ArrowPathIcon className="w-8 h-8 text-teal-400 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('insights.loading', 'Analyserar dina mönster…')}
        </p>
      </div>
    );
  }

  if (error) {
    const maxRetriesReached = retryCount >= MAX_RETRIES;
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 p-6 text-center space-y-3">
        <ExclamationTriangleIcon className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        <button
          onClick={loadInsights}
          disabled={maxRetriesReached}
          className="text-xs px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {maxRetriesReached
            ? t('insights.retryLater', 'Försök igen senare')
            : t('common.retry', 'Försök igen')}
        </button>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center space-y-4">
        <LightBulbIcon className="w-10 h-10 text-teal-300 mx-auto" />
        <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
          {t('insights.noInsights', 'Inga insikter just nu')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('insights.noInsightsHint', 'Logga ditt mående regelbundet så genereras personliga insikter efter hand.')}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {t('dailyInsights.minMoodsRequired')}
        </p>
        <button
          onClick={loadInsights}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {t('insights.generating', 'Genererar...')}
            </>
          ) : (
            <>
              <LightBulbIcon className="w-4 h-4" />
              {t('insights.generate', 'Generera insikter')}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-rose-700 dark:text-rose-300">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-600 text-sm"
            aria-label={t('dailyInsights.close')}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      <AnimatePresence mode="popLayout">
        {insights.map((insight, index) => {
          const urgency = insight.urgency ?? 'low';
          const style = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.low!;
          const actionState = actionStates[insight.insight_id] ?? 'idle';
          const domainKey = DOMAIN_KEYS.includes(insight.domain) ? insight.domain : null;
          const domainLabel = domainKey ? t(`dailyInsights.domains.${domainKey}`) : insight.domain;

          return (
            <motion.div
              key={insight.insight_id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: index * 0.07 }}
            >
              <div className={`relative rounded-2xl border bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow ${style.border}`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0">{style.icon}</div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate">
                      {insight.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleDismiss(insight.insight_id)}
                    disabled={actionState === 'loading'}
                    className="flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={t('dailyInsights.close')}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Domain badge */}
                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3 ${style.badge}`}>
                  {domainLabel}
                </span>

                {/* Message */}
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  {insight.message}
                </p>

                {/* Recommendation block — hidden when identical to the action button label */}
                {insight.recommendation && insight.recommendation !== insight.suggested_action && (
                  <div className="bg-teal-50 dark:bg-teal-900/30 rounded-xl p-3 mb-4">
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-0.5">
                      {t('insights.recommendation', 'Rekommendation')}
                    </p>
                    <p className="text-xs text-teal-600 dark:text-teal-400">
                      {insight.recommendation}
                    </p>
                  </div>
                )}

                {/* Action CTA */}
                {insight.suggested_action && (
                  <button
                    onClick={() => handleAction(insight.insight_id, insight.suggested_action)}
                    disabled={actionState !== 'idle'}
                    className={`w-full py-2 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      actionState === 'done'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default'
                        : 'bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60 disabled:cursor-not-allowed'
                    }`}
                  >
                    {actionState === 'done' ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircleIcon className="w-4 h-4" />
                        {t('dailyInsights.done')}
                      </span>
                    ) : actionState === 'loading' ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      insight.suggested_action
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default DailyInsights;

