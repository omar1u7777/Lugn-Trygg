/**
 * Predictive Analytics Component
 *
 * Displays AI-powered mood predictions, personal insights, and trend analysis
 * Fetches data from backend predictive analytics API endpoints
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/api/client';
import { logger } from '@/api/logger';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, ExclamationTriangleIcon, LightBulbIcon } from '@heroicons/react/24/outline';

// TypeScript interfaces for API responses
interface PredictionData {
  date: string;
  predicted_score: number;
  confidence: number;
}

interface InsightData {
  type: 'trend' | 'pattern' | 'recommendation';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
}

interface TrendData {
  period: string;
  average_score: number;
  trend_direction: 'up' | 'down' | 'stable';
  data_points: number;
}

interface PredictiveData {
  predictions?: PredictionData[];
  insights?: InsightData[];
  trends?: TrendData;
  crisis_risk?: {
    risk_level: 'low' | 'medium' | 'high';
    indicators: string[];
  };
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Custom hook for predictive analytics data fetching
const usePredictiveData = () => {
  const [data, setData] = useState<PredictiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch multiple endpoints in parallel for better performance
      const [predictionsRes, insightsRes, trendsRes, crisisRes] = await Promise.allSettled([
        api.get<ApiResponse<PredictiveData['predictions']>>('/api/predictive/predict?days=7'),
        api.get<ApiResponse<PredictiveData['insights']>>('/api/predictive/insights'),
        api.get<ApiResponse<PredictiveData['trends']>>('/api/predictive/trends?period=30d'),
        api.get<ApiResponse<PredictiveData['crisis_risk']>>('/api/predictive/crisis-check'),
      ]);

      const newData: PredictiveData = {};

      // Handle predictions
      if (predictionsRes.status === 'fulfilled' && predictionsRes.value.data.success) {
        newData.predictions = predictionsRes.value.data.data;
      }

      // Handle insights
      if (insightsRes.status === 'fulfilled' && insightsRes.value.data.success) {
        newData.insights = insightsRes.value.data.data;
      }

      // Handle trends
      if (trendsRes.status === 'fulfilled' && trendsRes.value.data.success) {
        newData.trends = trendsRes.value.data.data;
      }

      // Handle crisis risk
      if (crisisRes.status === 'fulfilled' && crisisRes.value.data.success) {
        newData.crisis_risk = crisisRes.value.data.data;
      }

      setData(newData);

      // Log successful data fetch
      logger.info('Predictive analytics data fetched successfully', {
        hasPredictions: !!newData.predictions?.length,
        hasInsights: !!newData.insights?.length,
        hasTrends: !!newData.trends,
        crisisRisk: newData.crisis_risk?.risk_level,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch predictive data';
      setError(errorMessage);
      logger.error('Failed to fetch predictive analytics data', { error: errorMessage });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// Memoized components for performance
const PredictionCard = React.memo(({ prediction }: { prediction: PredictionData }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {new Date(prediction.date).toLocaleDateString('sv-SE')}
        </p>
        <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
          {prediction.predicted_score.toFixed(1)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 dark:text-gray-400">Konfidens</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {(prediction.confidence * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  </div>
));

const InsightCard = React.memo(({ insight }: { insight: InsightData }) => {
  const getIcon = () => {
    switch (insight.type) {
      case 'trend':
        return insight.title.toLowerCase().includes('upp') ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
      case 'pattern':
        return LightBulbIcon;
      case 'recommendation':
        return ExclamationTriangleIcon;
      default:
        return LightBulbIcon;
    }
  };

  const Icon = getIcon();

  const getSeverityColor = () => {
    switch (insight.severity) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className={`rounded-lg p-4 border ${getSeverityColor()}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
            {insight.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  );
});

const TrendSummary = React.memo(({ trends }: { trends: TrendData }) => (
  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Trendanalys ({trends.period})
      </h3>
      {trends.trend_direction === 'up' && <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />}
      {trends.trend_direction === 'down' && <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Genomsnittligt humör</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {trends.average_score.toFixed(1)}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Datapunkter</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {trends.data_points}
        </p>
      </div>
    </div>
  </div>
));

const CrisisAlert = React.memo(({ crisisRisk }: { crisisRisk: NonNullable<PredictiveData['crisis_risk']> }) => {
  if (crisisRisk.risk_level === 'low') return null;

  const getAlertStyle = () => {
    switch (crisisRisk.risk_level) {
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  };

  return (
    <div className={`rounded-lg p-4 border ${getAlertStyle()}`}>
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium mb-2">
            Krisrisk: {crisisRisk.risk_level === 'high' ? 'Hög' : crisisRisk.risk_level === 'medium' ? 'Medelhög' : 'Låg'}
          </h4>
          {crisisRisk.indicators.length > 0 && (
            <ul className="text-sm space-y-1">
              {crisisRisk.indicators.slice(0, 3).map((indicator, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-xs">•</span>
                  <span>{indicator}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs mt-2 opacity-75">
            Kontakta professionell hjälp om du känner dig nedstämd.
          </p>
        </div>
      </div>
    </div>
  );
});

// Main component with performance optimizations
const PredictiveAnalytics: React.FC = React.memo(() => {
  const { data, loading, error, refetch } = usePredictiveData();

  // Memoized computed values
  const hasData = useMemo(() => {
    return !!(data?.predictions?.length || data?.insights?.length || data?.trends || data?.crisis_risk);
  }, [data]);

  const insufficientData = useMemo(() => {
    return !loading && !error && !hasData;
  }, [loading, error, hasData]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Laddar prediktiv analys">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8" role="alert">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Kunde inte ladda prediktiv analys
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error}
        </p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          aria-label="Försök igen"
        >
          Försök igen
        </button>
      </div>
    );
  }

  // Insufficient data state
  if (insufficientData) {
    return (
      <div className="text-center py-8">
        <LightBulbIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Inte tillräckligt med data
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Logga fler humörinlägg för att få personliga prediktioner och insikter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-labelledby="predictive-analytics-title">
      <div>
        <h2 id="predictive-analytics-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Prediktiv Analys
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          AI-driven insikter om ditt humör och välmående
        </p>
      </div>

      {/* Crisis Alert */}
      {data?.crisis_risk && <CrisisAlert crisisRisk={data.crisis_risk} />}

      {/* Trend Summary */}
      {data?.trends && <TrendSummary trends={data.trends} />}

      {/* Predictions */}
      {data?.predictions && data.predictions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Humörprediktioner (7 dagar)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.predictions.slice(0, 7).map((prediction, index) => (
              <PredictionCard key={`${prediction.date}-${index}`} prediction={prediction} />
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {data?.insights && data.insights.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Personliga Insikter
          </h3>
          <div className="space-y-3">
            {data.insights.map((insight, index) => (
              <InsightCard key={`${insight.type}-${index}`} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

PredictiveAnalytics.displayName = 'PredictiveAnalytics';

export default PredictiveAnalytics;
