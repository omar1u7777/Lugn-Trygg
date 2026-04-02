import React, { useState, useEffect, Suspense, useCallback } from 'react'
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import useAuth from '../hooks/useAuth';
import api, { getMoodStatistics } from '../api/api';
import { API_ENDPOINTS } from '../api/constants';
import { LoadingSpinner } from './LoadingStates';
import ErrorBoundary from './ErrorBoundary';
import { Card, Button } from './ui/tailwind';
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ArrowDownTrayIcon,
  FireIcon,
  CalendarDaysIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline';
import { LazyAnalyticsCharts as AnalyticsCharts } from './Charts/LazyChartWrapper';
import { logger } from '../utils/logger';
import { exportMoodData } from '../api/mood';

import MoodCalendar from './MoodCalendar';
import { useMoodData } from '../features/mood/hooks/useMoodData';
import { getWellnessInsights, WellnessInsight } from '../api/insights';
import { jsPDF } from 'jspdf';

// Lazy load heavy components - Analytics charts now using placeholder

interface ForecastData {
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

interface MoodStatistics {
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


const MoodAnalytics: React.FC = () => {
    // Health-mood insights state
    const [wellnessInsights, setWellnessInsights] = useState<WellnessInsight[]>([]);
    useEffect(() => {
      getWellnessInsights().then(setWellnessInsights).catch(() => setWellnessInsights([]));
    }, []);
  const { t } = useTranslation();
  const { user } = useAuth();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [statistics, setStatistics] = useState<MoodStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [daysAhead, setDaysAhead] = useState(7);

  // Tab state: 'overview' | 'daily' | 'weekly' | 'monthly'
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'weekly' | 'monthly'>('overview');

  // Daily analytics state
  interface DailyEntry { date: string; average: number | null; count: number }
  interface DowEntry { day: string; average: number | null; count: number }
  interface TagFreqEntry { tag: string; count: number }
  interface DailyAnalytics {
    days: number;
    totalEntries: number;
    dailyAverages: DailyEntry[];
    hourlyDistribution: (number | null)[];
    dayOfWeekAverages: DowEntry[];
    tagFrequency: TagFreqEntry[];
    intensityDistribution: { low: number; medium: number; high: number };
  }
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyAnalytics | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyDays, setDailyDays] = useState(30);

  // Monthly analytics state
  interface MonthlyEntry { month: string; label: string; average: number | null; count: number }
  interface MonthlyAnalytics {
    months: number;
    totalEntries: number;
    monthlyData: MonthlyEntry[];
    overallTrend: 'improving' | 'declining' | 'stable';
  }
  const [monthlyAnalytics, setMonthlyAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyMonths, setMonthlyMonths] = useState(6);

  // Calendar state
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const { moods, isLoading: moodsLoading, hasMore, loadMore } = useMoodData({ autoFetch: true, limit: 50 });

  const loadStatistics = useCallback(async () => {
    logger.debug('📊 MOOD ANALYTICS - Loading statistics', { userId: user?.user_id });
    if (!user?.user_id) {
      logger.warn('⚠️ MOOD ANALYTICS - No user ID');
      return;
    }
    
    try {
      const stats = await getMoodStatistics(user.user_id);
      logger.debug('✅ MOOD ANALYTICS - Statistics loaded', stats);
      setStatistics(stats);
    } catch (err) {
      logger.error('❌ MOOD ANALYTICS - Failed to load statistics:', err);
    }
  }, [user?.user_id]);

  const loadDailyAnalytics = useCallback(async () => {
    if (!user?.user_id) return;
    setDailyLoading(true);
    try {
      const response = await api.get(`${API_ENDPOINTS.MOOD.MOOD_DAILY}?days=${dailyDays}`);
      const data = response.data?.data || response.data;
      setDailyAnalytics(data);
    } catch (err) {
      logger.error('Failed to load daily analytics:', err);
    } finally {
      setDailyLoading(false);
    }
  }, [user?.user_id, dailyDays]);

  const loadMonthlyAnalytics = useCallback(async () => {
    if (!user?.user_id) return;
    setMonthlyLoading(true);
    try {
      const response = await api.get(`${API_ENDPOINTS.MOOD.MOOD_MONTHLY}?months=${monthlyMonths}`);
      const data = response.data?.data || response.data;
      setMonthlyAnalytics(data);
    } catch (err) {
      logger.error('Failed to load monthly analytics:', err);
    } finally {
      setMonthlyLoading(false);
    }
  }, [user?.user_id, monthlyMonths]);

  const loadForecast = useCallback(async () => {
    logger.debug('🔮 MOOD ANALYTICS - Loading forecast', { daysAhead });
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`${API_ENDPOINTS.MOOD.PREDICTIVE_FORECAST}?days_ahead=${daysAhead}`);
      logger.debug('✅ MOOD ANALYTICS - Forecast loaded', response.data);
      setForecast(response.data);
    } catch (err: unknown) {
      logger.error('❌ MOOD ANALYTICS - Failed to load forecast:', err);
      const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response.data && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
        ? String(err.response.data.error)
        : t('analytics.loadError');
      setError(errorMessage);
      setForecast(null);
    } finally {
      setLoading(false);
    }
  }, [daysAhead, t]);

  useEffect(() => {
    logger.debug('📊 MOOD ANALYTICS - Component mounted', { userId: user?.user_id, daysAhead });
    if (user) {
      void loadForecast();
      void loadStatistics();
    }
  }, [daysAhead, loadForecast, loadStatistics, user]);

  // Load tab-specific data on tab change
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'daily') void loadDailyAnalytics();
    if (activeTab === 'monthly') void loadMonthlyAnalytics();
  }, [activeTab, user, loadDailyAnalytics, loadMonthlyAnalytics]);

  // Reload daily when period changes
  useEffect(() => {
    if (activeTab === 'daily' && user) void loadDailyAnalytics();
  }, [dailyDays, activeTab, user, loadDailyAnalytics]);

  useEffect(() => {
    if (activeTab === 'monthly' && user) void loadMonthlyAnalytics();
  }, [monthlyMonths, activeTab, user, loadMonthlyAnalytics]);

  const exportToPDF = () => {
    if (!forecast) {
      return;
    }

    const currentForecast = forecast;
    setPdfError(null);

    try {
      const doc = new jsPDF();
        const {
          forecast: forecastData,
          modelInfo,
          riskFactors = [],
          recommendations = [],
          confidence,
        } = currentForecast;
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

      // Title
      doc.setFontSize(20);
      doc.setTextColor(102, 126, 234);
      doc.text('Lugn & Trygg - Humöranalys', pageWidth / 2, y, { align: 'center' });
      y += 15;

      // Date
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Genererad: ${new Date().toLocaleDateString('sv-SE')} ${new Date().toLocaleTimeString('sv-SE')}`,
        pageWidth / 2,
        y,
        { align: 'center' }
      );
      y += 15;

      // Current Analysis Section
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('📊 Nuvarande Analys', 20, y);
      y += 10;

      doc.setFontSize(10);
        doc.text(`Genomsnittlig prognos: ${forecastData.average_forecast.toFixed(1)}/10`, 25, y);
      y += 7;
      doc.text(
          `Trend: ${
            forecastData.trend === 'improving'
              ? '📈 Förbättras'
              : forecastData.trend === 'declining'
                ? '📉 Nedåtgående'
                : '📊 Stabil'
          }`,
        25,
        y
      );
      y += 7;
        doc.text(
          `Konfidensintervall: ${
            forecastData.confidence_interval.lower.toFixed(1)
          } - ${forecastData.confidence_interval.upper.toFixed(1)}`,
          25,
          y
        );
      y += 7;
        doc.text(`Säkerhet: ${(confidence * 100).toFixed(0)}%`, 25, y);
      y += 15;

      // Daily Predictions
      doc.setFontSize(14);
      doc.text('📅 Dagliga Prediktioner', 20, y);
      y += 10;

      doc.setFontSize(9);
        forecastData.daily_predictions.forEach((prediction, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        doc.text(
          `Dag ${index + 1} (${date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}): ${prediction.toFixed(1)}/10`,
          25,
          y
        );
        y += 6;
      });
      y += 10;

      // Risk Factors
        if (riskFactors.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(231, 76, 60);
        doc.text('⚠️ Riskfaktorer', 20, y);
        y += 10;

        doc.setFontSize(9);
        doc.setTextColor(0);
        riskFactors.forEach(risk => {
          const lines = doc.splitTextToSize(`• ${risk}`, pageWidth - 50);
          lines.forEach((line: string) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 25, y);
            y += 6;
          });
        });
        y += 10;
      }

      // Recommendations
      if (recommendations.length > 0) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(39, 174, 96);
        doc.text('💡 Rekommendationer', 20, y);
        y += 10;

        doc.setFontSize(9);
        doc.setTextColor(0);
        recommendations.forEach(rec => {
          const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - 50);
          lines.forEach((line: string) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 25, y);
            y += 6;
          });
        });
        y += 10;
      }

      // Model Info
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

        doc.setFontSize(14);
        doc.setTextColor(102, 126, 234);
        doc.text('🤖 AI-Modell Information', 20, y);
        y += 10;

        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(`Algoritm: ${modelInfo.algorithm}`, 25, y);
        y += 6;
        doc.text(`Tränings-RMSE: ${modelInfo.training_rmse?.toFixed(3) ?? 'N/A'}`, 25, y);
        y += 6;
        doc.text(`Datapunkter använd: ${modelInfo.data_points_used}`, 25, y);
        y += 15;

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          'Detta är en AI-genererad analys. För professionell hjälp, kontakta vårdgivare.',
          pageWidth / 2,
          285,
          { align: 'center' }
        );

        // Save PDF
        doc.save(`Lugn-Trygg-Analys-${new Date().toLocaleDateString('sv-SE')}.pdf`);
    } catch (err) {
      logger.error('Failed to export analytics as PDF', err);
      setPdfError(
        t('analytics.pdfExportUnavailable', {
          defaultValue: 'PDF-exporten är tillfälligt otillgänglig. Försök igen senare.',
        })
      );
    }
  };

  // 1-10 mood score scale thresholds
  const _getSentimentColor = (score: number) => {
    if (score >= 7) return '#4CAF50';  // Positive (7-10)
    if (score <= 4) return '#F44336';  // Negative (1-4)
    return '#FF9800';                   // Neutral (5-6)
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 7) return t('mood.positive');
    if (score <= 4) return t('mood.negative');
    return t('mood.neutral');
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <ArrowTrendingUpIcon className="w-5 h-5 text-success" />;
      case 'declining':
        return <ArrowTrendingDownIcon className="w-5 h-5 text-error" />;
      default:
        return <ChartBarIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getRiskIcon = (risk: string) => {
    if (risk.includes('high') || risk.includes('negative')) {
      return <ExclamationTriangleIcon className="w-5 h-5 text-warning" />;
    }
    return <CheckCircleIcon className="w-5 h-5 text-success" />;
  };


  if (loading || moodsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('analytics.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg p-4">
        <p className="text-error-800 dark:text-error-300">{error}</p>
      </div>
    );
  }

  if (!forecast || !forecast.currentAnalysis) {
    const hasSomeData = statistics && statistics.totalMoods > 0;
    
    if (hasSomeData) {
      return (
        <div className="bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800 rounded-lg p-6">
          <p className="text-warning-800 dark:text-warning-300 mb-4">
            {t('analytics.forecastUnavailable', 'Prognos är inte tillgänglig just nu. Visar din statistik.')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalMoods}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.totalMoods', 'Totalt')}</p>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.averageSentiment?.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.averageSentiment', 'Snitt')}</p>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.currentStreak}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.streak', 'Dagar')}</p>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.positivePercentage}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.positive', 'Positiva')}</p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
        <ChartBarIcon className="w-16 h-16 mx-auto text-blue-400 dark:text-blue-500 mb-4" />
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
          {t('analytics.noDataTitle', 'Ingen data ännu')}
        </h3>
        <p className="text-blue-700 dark:text-blue-300 max-w-md mx-auto">
          {t('analytics.noDataDescription', 'Börja logga ditt humör dagligen för att se mönster, trender och AI-drivna insikter här.')}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-6">
        {/* Health-Mood Insights */}
        {wellnessInsights.length > 0 && (
          <Card>
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <LightBulbIcon className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Hälsa & Humör-insikter
                </h3>
              </div>
              <ul className="space-y-2">
                {wellnessInsights.map((insight) => (
                  <li key={insight.id} className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">{insight.title}:</span> {insight.description}
                    {insight.areas && insight.areas.length > 0 && (
                      <ul className="ml-4 mt-1 list-disc text-xs text-gray-500 dark:text-gray-400">
                        {insight.areas.map((area) => (
                          <li key={area.name}>
                            {area.name}: {area.score} ({area.trend === 'up' ? '↑' : area.trend === 'down' ? '↓' : '→'})
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
        {/* Mood Calendar for Monthly Analytics */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarDaysIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              Månadskalender
            </h2>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
                aria-label="Föregående månad"
              >
                &lt;
              </button>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {new Date(calendarYear, calendarMonth).toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
              </span>
              <button
                className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
                aria-label="Nästa månad"
              >
                &gt;
              </button>
            </div>
          </div>
          <MoodCalendar
            year={calendarYear}
            month={calendarMonth}
            moodEntries={moods.map((m) => ({
              ...m,
              date: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
              mood: m.score,
            }))}
          />
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={moodsLoading}
                className="text-sm"
              >
                {moodsLoading ? 'Laddar...' : 'Ladda fler'}
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LightBulbIcon className="w-8 h-8 text-primary-600 dark:text-primary-500" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {t('analytics.title')}
          </h1>
        </div>

        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
          {t('analytics.description')}
        </p>

        {/* Analytics Tab Navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full sm:w-auto">
          {(['overview', 'daily', 'weekly', 'monthly'] as const).map((tab) => {
            const labels = { overview: 'Översikt', daily: 'Dagligt', weekly: 'Veckovis', monthly: 'Månadsvis' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ─── DAILY TAB ─── */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">Visa senaste:</span>
              {[7, 14, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDailyDays(d)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    dailyDays === d
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400'
                  }`}
                >
                  {d} dagar
                </button>
              ))}
            </div>

            {dailyLoading ? (
              <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
            ) : dailyAnalytics ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card><div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{dailyAnalytics.totalEntries}</p>
                    <p className="text-xs text-gray-500 mt-1">Totala loggar</p>
                  </div></Card>
                  <Card><div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {dailyAnalytics.dailyAverages.filter(d => d.average !== null).length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Aktiva dagar</p>
                  </div></Card>
                  <Card><div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(() => {
                        const filled = dailyAnalytics.dailyAverages.filter(d => d.average !== null);
                        return filled.length ? (filled.reduce((s, d) => s + (d.average ?? 0), 0) / filled.length).toFixed(1) : '–';
                      })()}/10
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Snitt humör</p>
                  </div></Card>
                  <Card><div className="p-4 text-center">
                    <p className={`text-3xl font-bold ${
                      dailyAnalytics.intensityDistribution.high > dailyAnalytics.intensityDistribution.low
                        ? 'text-success-600' : 'text-error-600'
                    }`}>
                      {dailyAnalytics.intensityDistribution.high > dailyAnalytics.intensityDistribution.medium &&
                       dailyAnalytics.intensityDistribution.high > dailyAnalytics.intensityDistribution.low
                        ? '😊' : dailyAnalytics.intensityDistribution.low > dailyAnalytics.intensityDistribution.high
                        ? '😟' : '😐'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Dominant humör</p>
                  </div></Card>
                </div>

                {/* Daily bar chart */}
                <Card>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daglig humörhistorik</h3>
                    <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                      {dailyAnalytics.dailyAverages.slice(-30).map((entry) => {
                        const pct = entry.average !== null ? (entry.average / 10) * 100 : 0;
                        const color = entry.average === null ? 'bg-gray-200 dark:bg-gray-700'
                          : entry.average >= 7 ? 'bg-success-500'
                          : entry.average >= 4 ? 'bg-warning-400'
                          : 'bg-error-500';
                        return (
                          <div key={entry.date} className="flex flex-col items-center gap-1 min-w-[18px] flex-1 group relative">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                              {entry.date}<br />{entry.average !== null ? `${entry.average.toFixed(1)}/10` : 'Ingen data'}
                            </div>
                            <div
                              className={`w-full rounded-t ${color} transition-all`}
                              style={{ height: `${Math.max(pct, entry.average !== null ? 4 : 2)}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{dailyAnalytics.dailyAverages.slice(-30)[0]?.date}</span>
                      <span>Idag</span>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Day-of-week averages */}
                  <Card>
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Genomsnitt per veckodag</h3>
                      <div className="space-y-2">
                        {dailyAnalytics.dayOfWeekAverages.map((dow) => {
                          const pct = dow.average !== null ? (dow.average / 10) * 100 : 0;
                          return (
                            <div key={dow.day} className="flex items-center gap-2">
                              <span className="w-16 text-xs text-gray-600 dark:text-gray-400 shrink-0">{dow.day.slice(0, 3)}</span>
                              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full ${
                                    dow.average === null ? '' : dow.average >= 7 ? 'bg-success-500' : dow.average >= 4 ? 'bg-warning-400' : 'bg-error-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                                {dow.average !== null ? dow.average.toFixed(1) : '–'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>

                  {/* Intensity distribution */}
                  <Card>
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Intensitetsfördelning</h3>
                      {dailyAnalytics.totalEntries === 0 ? (
                        <p className="text-sm text-gray-500">Ingen data</p>
                      ) : (
                        <div className="space-y-3">
                          {[
                            { label: 'Låg (1–3)', value: dailyAnalytics.intensityDistribution.low, color: 'bg-error-500' },
                            { label: 'Medel (4–6)', value: dailyAnalytics.intensityDistribution.medium, color: 'bg-warning-400' },
                            { label: 'Hög (7–10)', value: dailyAnalytics.intensityDistribution.high, color: 'bg-success-500' },
                          ].map(({ label, value, color }) => {
                            const pct = dailyAnalytics.totalEntries > 0 ? Math.round((value / dailyAnalytics.totalEntries) * 100) : 0;
                            return (
                              <div key={label}>
                                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  <span>{label}</span><span>{value} ({pct}%)</span>
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                                  <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Top tags */}
                      {dailyAnalytics.tagFrequency.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Vanligaste taggar</h4>
                          <div className="flex flex-wrap gap-1">
                            {dailyAnalytics.tagFrequency.slice(0, 10).map(({ tag, count }) => (
                              <span key={tag} className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full text-xs">
                                {tag} ({count})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Hour-of-day distribution */}
                <Card>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Humör per tid på dagen</h3>
                    <div className="flex items-end gap-0.5 h-24">
                      {dailyAnalytics.hourlyDistribution.map((avg, hour) => {
                        if (avg === null) return (
                          <div key={hour} className="flex-1 flex flex-col items-center">
                            <div className="w-full bg-gray-100 dark:bg-gray-800 h-1 rounded-t" />
                          </div>
                        );
                        const pct = (avg / 10) * 100;
                        const colorClass = avg >= 7 ? 'bg-success-500' : avg >= 4 ? 'bg-warning-400' : 'bg-error-500';
                        return (
                          <div key={hour} className="flex-1 flex flex-col items-center group relative">
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] rounded px-1 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-nowrap">
                              {hour}:00 — {avg.toFixed(1)}
                            </div>
                            <div className={`w-full ${colorClass} rounded-t`} style={{ height: `${pct}%` }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>00:00</span><span>12:00</span><span>23:00</span>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">Kunde inte ladda daglig analytics.</div>
            )}
          </div>
        )}

        {/* ─── WEEKLY TAB ─── */}
        {activeTab === 'weekly' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Weekly chart using current moods data */}
              <Card>
                <div className="p-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Senaste 7 dagarna</h3>
                  {(() => {
                    const now = new Date();
                    const days7 = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(now);
                      d.setDate(now.getDate() - (6 - i));
                      return d.toISOString().split('T')[0];
                    });
                    const byDay: Record<string, number[]> = {};
                    moods.forEach(m => {
                      const ts = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp ?? '');
                      const day = ts.toISOString().split('T')[0];
                      if (!byDay[day]) byDay[day] = [];
                      byDay[day].push(m.score ?? 5);
                    });
                    const entries = days7.map(d => ({
                      date: d,
                      avg: byDay[d] ? byDay[d].reduce((a, b) => a + b, 0) / byDay[d].length : null,
                      count: byDay[d]?.length ?? 0,
                    }));
                    const DOW_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
                    return (
                      <div className="flex items-end gap-2 h-32">
                        {entries.map(entry => {
                          const pct = entry.avg !== null ? (entry.avg / 10) * 100 : 0;
                          const color = entry.avg === null ? 'bg-gray-200 dark:bg-gray-700'
                            : entry.avg >= 7 ? 'bg-success-500'
                            : entry.avg >= 4 ? 'bg-warning-400' : 'bg-error-500';
                          const dow = DOW_SHORT[new Date(entry.date).getDay()];
                          return (
                            <div key={entry.date} className="flex flex-col items-center gap-1 flex-1 group relative">
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                {entry.date}<br />{entry.avg ? `${entry.avg.toFixed(1)}/10` : 'Ingen'}
                              </div>
                              <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(pct, entry.avg !== null ? 6 : 2)}%` }} />
                              <span className="text-[10px] text-gray-500">{dow}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </Card>

              {/* Weekly sentiment breakdown */}
              <Card>
                <div className="p-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Sentimentfördelning (7 dagar)</h3>
                  {(() => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const recent = moods.filter(m => {
                      const ts = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp ?? '');
                      return ts >= cutoff;
                    });
                    const pos = recent.filter(m => (m.score ?? 5) >= 7).length;
                    const neg = recent.filter(m => (m.score ?? 5) <= 3).length;
                    const neu = recent.length - pos - neg;
                    const total = recent.length || 1;
                    return recent.length === 0 ? (
                      <p className="text-sm text-gray-500">Ingen data den här veckan</p>
                    ) : (
                      <div className="space-y-3">
                        {[
                          { label: 'Positiv (7–10)', value: pos, color: 'bg-success-500', emoji: '😊' },
                          { label: 'Neutral (4–6)', value: neu, color: 'bg-warning-400', emoji: '😐' },
                          { label: 'Negativ (1–3)', value: neg, color: 'bg-error-500', emoji: '😟' },
                        ].map(({ label, value, color, emoji }) => (
                          <div key={label}>
                            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>{emoji} {label}</span>
                              <span>{value} ({Math.round((value / total) * 100)}%)</span>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                              <div className={`${color} h-2.5 rounded-full`} style={{ width: `${(value / total) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-gray-500 mt-2">{recent.length} loggar totalt</p>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </div>

            {/* Tags this week */}
            {(() => {
              const now = new Date();
              const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              const tagCounts: Record<string, number> = {};
              moods.filter(m => {
                const ts = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp ?? '');
                return ts >= cutoff;
              }).forEach(m => {
                (m.tags ?? []).forEach((tag: string) => {
                  tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
                });
              });
              const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
              return tags.length === 0 ? null : (
                <Card>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Vanligaste taggar denna vecka</h3>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(([tag, count]) => (
                        <span key={tag} className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                          {tag} <span className="text-primary-500">×{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ─── MONTHLY TAB ─── */}
        {activeTab === 'monthly' && (
          <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">Visa senaste:</span>
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonthlyMonths(m)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    monthlyMonths === m
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400'
                  }`}
                >
                  {m} månader
                </button>
              ))}
            </div>

            {monthlyLoading ? (
              <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
            ) : monthlyAnalytics ? (
              <>
                {/* Trend summary */}
                <Card>
                  <div className="p-4 flex items-center gap-4">
                    {monthlyAnalytics.overallTrend === 'improving' ? (
                      <ArrowTrendingUpIcon className="w-10 h-10 text-success-600 shrink-0" />
                    ) : monthlyAnalytics.overallTrend === 'declining' ? (
                      <ArrowTrendingDownIcon className="w-10 h-10 text-error-600 shrink-0" />
                    ) : (
                      <ChartBarIcon className="w-10 h-10 text-gray-500 shrink-0" />
                    )}
                    <div>
                      <p className={`text-xl font-bold ${
                        monthlyAnalytics.overallTrend === 'improving' ? 'text-success-600'
                        : monthlyAnalytics.overallTrend === 'declining' ? 'text-error-600'
                        : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {monthlyAnalytics.overallTrend === 'improving' ? 'Förbättrad trend'
                         : monthlyAnalytics.overallTrend === 'declining' ? 'Minskande trend'
                         : 'Stabil trend'}
                      </p>
                      <p className="text-sm text-gray-500">{monthlyAnalytics.totalEntries} loggar under {monthlyAnalytics.months} månader</p>
                    </div>
                  </div>
                </Card>

                {/* Monthly bar chart */}
                <Card>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Månadsvis genomsnitt</h3>
                    <div className="flex items-end gap-3 h-48">
                      {monthlyAnalytics.monthlyData.map((entry) => {
                        const pct = entry.average !== null ? (entry.average / 10) * 100 : 0;
                        const color = entry.average === null ? 'bg-gray-200 dark:bg-gray-700'
                          : entry.average >= 7 ? 'bg-success-500'
                          : entry.average >= 4 ? 'bg-warning-400'
                          : 'bg-error-500';
                        return (
                          <div key={entry.month} className="flex flex-col items-center gap-1 flex-1 group relative">
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                              {entry.label}<br />
                              {entry.average !== null ? `${entry.average.toFixed(1)}/10` : 'Ingen data'}
                              {entry.count > 0 && <><br />{entry.count} loggar</>}
                            </div>
                            <div
                              className={`w-full rounded-t ${color} transition-all`}
                              style={{ height: `${Math.max(pct, entry.average !== null ? 6 : 2)}%` }}
                            />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              {entry.label.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Month-over-month comparison */}
                    <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Jämförelse månad för månad</h4>
                      <div className="space-y-1">
                        {monthlyAnalytics.monthlyData.slice(1).map((entry, i) => {
                          const prev = monthlyAnalytics.monthlyData[i];
                          if (entry.average === null || prev.average === null) return null;
                          const diff = entry.average - prev.average;
                          return (
                            <div key={entry.month} className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">{prev.label.split(' ')[0]} → {entry.label.split(' ')[0]}</span>
                              <span className={`font-semibold ${diff > 0 ? 'text-success-600' : diff < 0 ? 'text-error-600' : 'text-gray-500'}`}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)} {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Monthly calendar */}
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CalendarDaysIcon className="w-5 h-5 text-primary-600" />Kalender
                    </h3>
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
                        onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); } else { setCalendarMonth(m => m - 1); } }}
                        aria-label="Föregående månad"
                      >&lt;</button>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {new Date(calendarYear, calendarMonth).toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
                        onClick={() => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); } else { setCalendarMonth(m => m + 1); } }}
                        aria-label="Nästa månad"
                      >&gt;</button>
                    </div>
                  </div>
                  <MoodCalendar
                    year={calendarYear}
                    month={calendarMonth}
                    moodEntries={moods.map((m) => ({
                      ...m,
                      date: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
                      mood: m.score,
                    }))}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">Kunde inte ladda månadsanalys.</div>
            )}
          </div>
        )}

        {/* ─── OVERVIEW TAB (all the existing content below shows only when activeTab==='overview') ─── */}
        {activeTab !== 'overview' ? null : (<>

        {/* Mood Statistics Overview */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Moods */}
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <ChartPieIcon className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Humörloggar</p>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {statistics.totalMoods}
                </p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="text-success-600">↑ {statistics.positivePercentage.toFixed(0)}%</span>
                  <span className="text-gray-500">• {statistics.neutralPercentage.toFixed(0)}%</span>
                  <span className="text-error-600">↓ {statistics.negativePercentage.toFixed(0)}%</span>
                </div>
              </div>
            </Card>

            {/* Current Streak */}
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FireIcon className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Nuvarande Streak</p>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {statistics.currentStreak} dagar
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Längsta: {statistics.longestStreak} dagar
                </p>
              </div>
            </Card>

            {/* Average Sentiment */}
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <ChartBarIcon className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Genomsnitt</p>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {statistics.averageSentiment.toFixed(1)}/10
                </p>
                <p className={`text-xs mt-1 ${
                  statistics.averageSentiment >= 7 ? 'text-success-600' :
                  statistics.averageSentiment <= 4 ? 'text-error-600' :
                  'text-gray-500'
                }`}>
                  {statistics.averageSentiment >= 7 ? 'Positivt' :
                   statistics.averageSentiment <= 4 ? 'Negativt' : 'Neutralt'}
                </p>
              </div>
            </Card>

            {/* Recent Trend */}
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CalendarDaysIcon className="w-5 h-5 text-purple-600 dark:text-purple-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Senaste Trend</p>
                </div>
                <div className="flex items-center gap-2">
                  {statistics.recentTrend === 'improving' ? (
                    <ArrowTrendingUpIcon className="w-8 h-8 text-success-600" />
                  ) : statistics.recentTrend === 'declining' ? (
                    <ArrowTrendingDownIcon className="w-8 h-8 text-error-600" />
                  ) : (
                    <ChartBarIcon className="w-8 h-8 text-gray-500" />
                  )}
                  <span className={`text-lg font-semibold ${
                    statistics.recentTrend === 'improving' ? 'text-success-600' :
                    statistics.recentTrend === 'declining' ? 'text-error-600' :
                    'text-gray-600'
                  }`}>
                    {statistics.recentTrend === 'improving' ? 'Förbättras' :
                     statistics.recentTrend === 'declining' ? 'Minskar' : 'Stabilt'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Forecast Controls */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('analytics.forecastPeriod')}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {[3, 7, 14].map((days) => (
              <Button
                key={days}
                variant={daysAhead === days ? 'primary' : 'outline'}
                onClick={() => setDaysAhead(days)}
                className="text-sm"
              >
                {days} {t('analytics.days')}
              </Button>
            ))}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {/* Export PDF Button */}
            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={!forecast}
              className="flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Exportera PDF
            </Button>
            
            {/* Export CSV Button */}
            <Button
              variant="outline"
              onClick={async () => {
                if (!user?.user_id) return;
                setExporting(true);
                try {
                  const csv = await exportMoodData(user.user_id, 'csv');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `humor-data-${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  logger.error('CSV export failed:', err);
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting || moodsLoading || !moods?.length}
              className="flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exporting ? t('analytics.exporting', 'Exporterar...') : t('analytics.exportCSV', 'Exportera CSV')}
            </Button>
          </div>
          
          {pdfError && (
            <div className="bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
              <p className="text-warning-800 dark:text-warning-300 text-sm">{pdfError}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Current Analysis */}
          <Card>
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('analytics.currentAnalysis')}
                </h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('analytics.recentAverage')}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(forecast.currentAnalysis.recent_average / 10) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={forecast.currentAnalysis.recent_average}
                      aria-valuemin={1}
                      aria-valuemax={10}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {forecast.currentAnalysis.recent_average.toFixed(1)}/10
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getSentimentLabel(forecast.currentAnalysis.recent_average)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.volatility')}
                </p>
                <p className={`text-lg font-semibold ${
                  forecast.currentAnalysis.volatility > 2.0 ? 'text-warning-600' : 'text-success-600'
                }`}>
                  {(forecast.currentAnalysis.volatility || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Forecast Summary */}
          <Card>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                {getTrendIcon(forecast.forecast.trend)}
                {t('analytics.forecastSummary')}
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('analytics.averageForecast')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {forecast.forecast.average_forecast.toFixed(1)}/10
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getSentimentLabel(forecast.forecast.average_forecast)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t('analytics.trend')}
                  </p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    forecast.forecast.trend === 'improving'
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                      : forecast.forecast.trend === 'declining'
                      ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {t(`analytics.trend.${forecast.forecast.trend}`)}
                  </span>
                </div>

                {!forecast.ai_unavailable && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('analytics.confidence')}
                    </p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">
                      {(forecast.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
        {/* Interactive Charts */}
        <div>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner isLoading={true} message="Laddar diagram..." />}>
              <AnalyticsCharts
                dailyPredictions={forecast.forecast.daily_predictions}
                confidenceInterval={forecast.forecast.confidence_interval}
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Daily Predictions */}
        <Card>
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('analytics.dailyPredictions')}
            </h3>

            <div className="flex flex-wrap gap-2">
              {forecast.forecast.daily_predictions.map((prediction, index) => (
                <div
                  key={index}
                  className="p-3 min-w-[80px] bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('analytics.day')} {index + 1}
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {prediction.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Risk Factors */}
          {forecast.riskFactors.length > 0 && (
            <Card>
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ExclamationTriangleIcon className="w-5 h-5 text-warning-600 dark:text-warning-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('analytics.riskFactors')}
                  </h3>
                </div>

                <div className="flex flex-col gap-2">
                  {forecast.riskFactors.map((risk) => (
                    <div key={risk} className="flex items-center gap-2">
                      {getRiskIcon(risk)}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {t(`analytics.risks.${risk}`, risk)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Recommendations */}
          <Card className={forecast.riskFactors.length === 0 ? 'md:col-span-2' : ''}>
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircleIcon className="w-5 h-5 text-success-600 dark:text-success-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('analytics.recommendations')}
                </h3>
              </div>

              <ul className="space-y-2 list-disc list-inside">
                {forecast.recommendations.map((rec) => (
                  <li key={rec} className="text-sm text-gray-700 dark:text-gray-300">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* Model Info */}
        <Card>
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('analytics.modelInfo')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.algorithm')}
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {forecast.modelInfo.algorithm.replace('_', ' ').toUpperCase()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.trainingAccuracy')}
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {forecast.modelInfo.training_rmse?.toFixed(3) ?? 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.dataPoints')}
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {forecast.modelInfo.data_points_used}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </>)} {/* end overview tab */}
    </div>
  </motion.div>
  );
};

export default MoodAnalytics;
