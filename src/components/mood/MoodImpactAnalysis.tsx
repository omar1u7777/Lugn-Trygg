/**
 * Mood Impact Analysis Component
 * Displays correlation analysis between tags and mood scores
 * Shows which activities/contexts improve or worsen mood
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { getCorrelationAnalysis, type CorrelationAnalysisResponse, type TagCorrelation } from '../../api/moodAnalytics';
import { Card } from '../ui/tailwind';
import { logger } from '../../utils/logger';

interface MoodImpactAnalysisProps {
  days?: number;
  minOccurrences?: number;
}

export const MoodImpactAnalysis: React.FC<MoodImpactAnalysisProps> = ({
  days = 30,
  minOccurrences = 3
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<CorrelationAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getCorrelationAnalysis(days, minOccurrences);
      setData(result);
    } catch (err) {
      logger.error('Failed to load correlation analysis:', err);
      setError('Kunde inte ladda korrelationsanalys');
    } finally {
      setLoading(false);
    }
  }, [days, minOccurrences]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>{error}</p>
          <button
            onClick={loadAnalysis}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('common.retry', 'Försök igen')}
          </button>
        </div>
      </Card>
    );
  }

  if (!data || data.status !== 'success') {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('mood.impact.noData', 'Inte tillräckligt med data för analys')}</p>
          <p className="text-sm mt-2">
            {t('mood.impact.needMore', 'Logga ditt humör med taggar för att se mönster')}
          </p>
        </div>
      </Card>
    );
  }

  const positiveCorrelations = data.correlations.filter(c => c.impact > 0 && c.is_significant);
  const negativeCorrelations = data.correlations.filter(c => c.impact < 0 && c.is_significant);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('mood.impact.title', 'Humörpåverkan')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('mood.impact.subtitle', 'Vad påverkar ditt humör mest?')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {data.baseline_mood.toFixed(1)}/10
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('mood.impact.baseline', 'Genomsnitt')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {data.total_entries}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('mood.impact.entries', 'Loggningar')}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {data.tags_analyzed}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('mood.impact.tagsAnalyzed', 'Taggar')}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {data.analysis_period.days}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('mood.impact.days', 'Dagar')}
            </p>
          </div>
        </div>
      </Card>

      {/* Insights */}
      {data.insights && data.insights.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('mood.impact.insights', 'Insikter')}
          </h3>
          <div className="space-y-3">
            {data.insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
              >
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  {insight.title}
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {insight.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {t('mood.impact.confidence', 'Tillförlitlighet')}: {(insight.confidence * 100).toFixed(0)}%
                  </span>
                  {insight.actionable && (
                    <span className="text-xs px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full">
                      {t('mood.impact.actionable', 'Handlingsbar')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Positive Correlations */}
      {positiveCorrelations.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('mood.impact.positive', 'Förbättrar humöret')}
            </h3>
          </div>
          <div className="space-y-3">
            {positiveCorrelations.map((correlation) => (
              <CorrelationBar key={correlation.tag} correlation={correlation} type="positive" />
            ))}
          </div>
        </Card>
      )}

      {/* Negative Correlations */}
      {negativeCorrelations.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingDownIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('mood.impact.negative', 'Försämrar humöret')}
            </h3>
          </div>
          <div className="space-y-3">
            {negativeCorrelations.map((correlation) => (
              <CorrelationBar key={correlation.tag} correlation={correlation} type="negative" />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

interface CorrelationBarProps {
  correlation: TagCorrelation;
  type: 'positive' | 'negative';
}

const CorrelationBar: React.FC<CorrelationBarProps> = ({ correlation, type }) => {
  const { t } = useTranslation();
  const percentage = Math.abs(correlation.impact_percentage);
  const barColor = type === 'positive' 
    ? 'bg-green-500 dark:bg-green-400' 
    : 'bg-red-500 dark:bg-red-400';
  const bgColor = type === 'positive'
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-red-50 dark:bg-red-900/20';

  return (
    <div className={`p-4 ${bgColor} rounded-lg border ${type === 'positive' ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
            #{correlation.tag}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {correlation.occurrences} {t('mood.impact.occurrences', 'gånger')}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${type === 'positive' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {type === 'positive' ? '+' : ''}{correlation.impact_percentage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {correlation.average_mood_with_tag.toFixed(1)}/10
          </p>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t('mood.impact.confidence', 'Tillförlitlighet')}: {(correlation.confidence * 100).toFixed(0)}%
        </span>
        {correlation.is_significant && (
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full">
            {t('mood.impact.significant', 'Statistiskt signifikant')}
          </span>
        )}
      </div>
    </div>
  );
};
