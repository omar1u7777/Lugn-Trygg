import { useCallback, useState } from 'react';
import api, { getMoodStatistics } from '../api/api';
import { API_ENDPOINTS } from '../api/constants';
import { unwrapApiResponse } from '../api/client';
import { getApiErrorMessage } from '../api/errorUtils';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Telemetry data contracts (moved out of MoodAnalytics.tsx)
// ---------------------------------------------------------------------------

export interface ForecastData {
  forecast: {
    daily_predictions: number[];
    average_forecast: number;
    trend: string;
    confidence_interval: {
      lower: number;
      upper: number;
    };
  };
  modelInfo: {
    algorithm: string;
    training_rmse?: number;
    data_points_used: number;
  };
  currentAnalysis: {
    recent_average: number;
    volatility: number;
  };
  riskFactors: string[];
  recommendations: string[];
  confidence: number;
  ai_unavailable?: boolean;
}

export interface MoodStatistics {
  totalMoods: number;
  averageSentiment: number;
  currentStreak: number;
  longestStreak: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  bestDay: string | null;
  worstDay: string | null;
  recentTrend: 'improving' | 'declining' | 'stable';
}

export interface DailyEntry { date: string; average: number | null; count: number }
export interface DowEntry { day: string; average: number | null; count: number }
export interface TagFreqEntry { tag: string; count: number }

export interface DailyAnalytics {
  days: number;
  totalEntries: number;
  dailyAverages: DailyEntry[];
  hourlyDistribution: (number | null)[];
  dayOfWeekAverages: DowEntry[];
  tagFrequency: TagFreqEntry[];
  intensityDistribution: { low: number; medium: number; high: number };
}

export interface MonthlyEntry { month: string; label: string; average: number | null; count: number }

export interface MonthlyAnalytics {
  months: number;
  totalEntries: number;
  monthlyData: MonthlyEntry[];
  overallTrend: 'improving' | 'declining' | 'stable';
}

export interface UseMoodTelemetryOptions {
  userId: string | undefined;
  daysAhead: number;
  dailyDays: number;
  monthlyMonths: number;
  /** Shown when the forecast endpoint fails without a payload message. */
  forecastErrorFallback: string;
}

/**
 * Owns all mood-telemetry data fetching (statistics, forecast, daily and
 * monthly aggregates) that previously lived inline in MoodAnalytics.tsx as
 * four copy-pasted load callbacks. View components consume state + loaders
 * and stay purely presentational.
 */
export function useMoodTelemetry(options: UseMoodTelemetryOptions) {
  const { userId, daysAhead, dailyDays, monthlyMonths, forecastErrorFallback } = options;

  const [statistics, setStatistics] = useState<MoodStatistics | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyAnalytics | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const loadStatistics = useCallback(async () => {
    logger.debug('📊 MOOD TELEMETRY - Loading statistics', { userId });
    if (!userId) {
      logger.warn('⚠️ MOOD TELEMETRY - No user ID');
      return;
    }

    try {
      const stats = await getMoodStatistics(userId);
      logger.debug('✅ MOOD TELEMETRY - Statistics loaded', stats);
      setStatistics(stats);
    } catch (err) {
      logger.error('❌ MOOD TELEMETRY - Failed to load statistics:', err);
    }
  }, [userId]);

  const loadDailyAnalytics = useCallback(async () => {
    if (!userId) return;
    setDailyLoading(true);
    try {
      const response = await api.get(`${API_ENDPOINTS.MOOD.MOOD_DAILY}?days=${dailyDays}`);
      setDailyAnalytics(unwrapApiResponse<DailyAnalytics>(response.data));
    } catch (err) {
      logger.error('Failed to load daily analytics:', err);
    } finally {
      setDailyLoading(false);
    }
  }, [userId, dailyDays]);

  const loadMonthlyAnalytics = useCallback(async () => {
    if (!userId) return;
    setMonthlyLoading(true);
    try {
      const response = await api.get(`${API_ENDPOINTS.MOOD.MOOD_MONTHLY}?months=${monthlyMonths}`);
      setMonthlyAnalytics(unwrapApiResponse<MonthlyAnalytics>(response.data));
    } catch (err) {
      logger.error('Failed to load monthly analytics:', err);
    } finally {
      setMonthlyLoading(false);
    }
  }, [userId, monthlyMonths]);

  const loadForecast = useCallback(async () => {
    logger.debug('🔮 MOOD TELEMETRY - Loading forecast', { daysAhead });
    try {
      setForecastLoading(true);
      setForecastError(null);
      const response = await api.get(`${API_ENDPOINTS.MOOD.PREDICTIVE_FORECAST}?days_ahead=${daysAhead}`);
      logger.debug('✅ MOOD TELEMETRY - Forecast loaded', response.data);
      setForecast(response.data);
    } catch (err: unknown) {
      logger.error('❌ MOOD TELEMETRY - Failed to load forecast:', err);
      setForecastError(getApiErrorMessage(err, forecastErrorFallback));
      setForecast(null);
    } finally {
      setForecastLoading(false);
    }
  }, [daysAhead, forecastErrorFallback]);

  return {
    statistics,
    forecast,
    forecastLoading,
    forecastError,
    dailyAnalytics,
    dailyLoading,
    monthlyAnalytics,
    monthlyLoading,
    loadStatistics,
    loadForecast,
    loadDailyAnalytics,
    loadMonthlyAnalytics,
  };
}

export default useMoodTelemetry;
