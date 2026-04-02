/**
 * Daily Insights Component
 * Fetches AI-powered personalised insights from the v2 backend engine.
 * The backend performs: linear regression, Cohen's d, Pearson correlation,
 * CBT/ACT domain classification, circadian analysis, and social rhythm metrics.
 *
 * 100% Tailwind Native - No MUI Dependencies
 */

import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  LightBulbIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { trackEvent } from '../services/analytics';
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
    border: 'border-indigo-200 dark:border-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    icon: <LightBulbIcon className="w-5 h-5 text-indigo-500" />,
  },
};

/** Map CBT/ACT domain to Swedish label */
const DOMAIN_LABELS: Record<string, string> = {
  behavioral_activation: 'Beteendeaktivering',
  cognitive_restructuring: 'Kognitiv omstrukturering',
  sleep_hygiene: 'Sömnhygien',
  social_connection: 'Social kontakt',
  mindfulness: 'Mindfulness',
  physical_activity: 'Fysisk aktivitet',
  emotion_regulation: 'Känslohantering',
};

export const DailyInsights: React.FC<DailyInsightsProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<BackendInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});

  const loadInsights = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Try pending insights first (already generated, no cost)
      let pending = await getPendingInsights(userId);

      // If none pending, trigger generation (runs v2 ML pipeline)
      if (pending.length === 0) {
        const generated = await generateInsights(userId);
        pending = generated;
      }

      setInsights(pending);
      trackEvent('daily_insights_viewed', { userId, count: pending.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleDismiss = async (insightId: string) => {
    setActionStates(s => ({ ...s, [insightId]: 'loading' }));
    try {
      await dismissInsight(insightId);
      setInsights(prev => prev.filter(i => i.insight_id !== insightId));
      trackEvent('insight_dismissed', { userId, insightId });
    } catch {
      setActionStates(s => ({ ...s, [insightId]: 'idle' }));
    }
  };

  const handleAction = async (insightId: string, action: string) => {
    setActionStates(s => ({ ...s, [insightId]: 'loading' }));
    try {
      await markInsightActionTaken(insightId, action);
      setActionStates(s => ({ ...s, [insightId]: 'done' }));
      trackEvent('insight_action_taken', { userId, insightId, action });
      // Remove after short delay to show confirmation
      setTimeout(() => {
        setInsights(prev => prev.filter(i => i.insight_id !== insightId));
        setActionStates(s => { const n = { ...s }; delete n[insightId]; return n; });
      }, 1200);
    } catch {
      setActionStates(s => ({ ...s, [insightId]: 'idle' }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <ArrowPathIcon className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('insights.loading', 'Analyserar dina mönster…')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 p-6 text-center space-y-3">
        <ExclamationTriangleIcon className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        <button
          onClick={loadInsights}
          className="text-xs px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200 transition-colors"
        >
          {t('common.retry', 'Försök igen')}
        </button>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center space-y-3">
        <LightBulbIcon className="w-10 h-10 text-indigo-300 mx-auto" />
        <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
          {t('insights.noInsights', 'Inga insikter just nu')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('insights.noInsightsHint', 'Logga ditt mående regelbundet så genereras personliga insikter efter hand.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {insights.map((insight, index) => {
          const urgency = insight.urgency ?? 'low';
          const style = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.low;
          const actionState = actionStates[insight.insight_id] ?? 'idle';
          const domainLabel = DOMAIN_LABELS[insight.domain] ?? insight.domain;

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
                    className="flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Stäng"
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

                {/* Recommendation block */}
                {insight.recommendation && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-3 mb-4">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-0.5">
                      {t('insights.recommendation', 'Rekommendation')}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
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
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 disabled:cursor-not-allowed'
                    }`}
                  >
                    {actionState === 'done' ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircleIcon className="w-4 h-4" />
                        Klart!
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

