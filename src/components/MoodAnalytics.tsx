import React, { useState, useEffect, Suspense } from 'react'
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


// Lazy load heavy components - Analytics charts now using placeholder

declare global {
  interface Window {
    jspdf?: {
      jsPDF: new (...args: unknown[]) => unknown;
    };
  }
}

type JSPDFConstructor = new (...args: unknown[]) => {
  internal: { pageSize: { getWidth: () => number } };
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void;
  addPage: () => void;
  splitTextToSize: (text: string, maxSize: number) => string[];
  save: (filename: string) => void;
};

let jsPDFConstructor: JSPDFConstructor | null = null;

const loadJSPDF = (): Promise<JSPDFConstructor> => {
  if (jsPDFConstructor) {
    return Promise.resolve(jsPDFConstructor);
  }

  if (typeof window === 'undefined') {
    return Promise.reject(new Error('jsPDF can only be loaded in the browser'));
  }

  if (window.jspdf?.jsPDF) {
    jsPDFConstructor = window.jspdf.jsPDF as JSPDFConstructor;
    return Promise.resolve(jsPDFConstructor);
  }

  return new Promise<JSPDFConstructor>((resolve, reject) => {
    const handleLoad = () => {
      if (window.jspdf?.jsPDF) {
        jsPDFConstructor = window.jspdf.jsPDF as JSPDFConstructor;
        resolve(jsPDFConstructor);
      } else {
        reject(new Error('jsPDF loaded but constructor was not found'));
      }
    };

    const handleError = () => {
      reject(new Error('Failed to load jsPDF from CDN'));
    };

    const existingScript = document.getElementById('jspdf-cdn') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'jspdf-cdn';
    script.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);

    if ((import.meta as any).env?.DEV) {
      logger.warn('jsPDF CDN script injected dynamically.');
    }
  });
};
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
  model_info: {
    algorithm: string;
    training_rmse: number;
    data_points_used: number;
  };
  current_analysis: {
    recent_average: number;
    volatility: number;
  };
  risk_factors: string[];
  recommendations: string[];
  confidence: number;
  ai_unavailable?: boolean; // HONEST: Mark when AI service is unavailable
}

interface MoodStatistics {
  total_moods: number;
  average_sentiment: number;
  current_streak: number;
  longest_streak: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  best_day: string | null;
  worst_day: string | null;
  recent_trend: 'improving' | 'declining' | 'stable';
}

const MoodAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [statistics, setStatistics] = useState<MoodStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [daysAhead, setDaysAhead] = useState(7);

  useEffect(() => {
    logger.debug('📊 MOOD ANALYTICS - Component mounted', { userId: user?.user_id, daysAhead });
    if (user) {
      loadForecast();
      loadStatistics();
    }
  }, [daysAhead, user]);

  const loadStatistics = async () => {
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
      // Don't show error, just use null statistics
    }
  };

  const loadForecast = async () => {
    logger.debug('🔮 MOOD ANALYTICS - Loading forecast', { daysAhead });
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`${API_ENDPOINTS.MOOD.PREDICTIVE_FORECAST}?days_ahead=${daysAhead}`);
      logger.debug('✅ MOOD ANALYTICS - Forecast loaded', response.data);
      setForecast(response.data);
    } catch (err: unknown) {
      logger.error('❌ MOOD ANALYTICS - Failed to load forecast:', err);
      const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
        ? String(err.response.data.error)
        : t('analytics.loadError');
      setError(errorMessage);
      // Set null forecast on error — don't fabricate fake prediction data
      setForecast(null);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!forecast) {
      return;
    }

    const currentForecast = forecast;
    setPdfError(null);

    loadJSPDF()
      .then((jsPDFModule) => {
        const doc = new jsPDFModule();
        const {
          forecast: forecastData,
          model_info,
          risk_factors = [],
          recommendations = [],
          confidence,
        } = currentForecast;
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

      // Title
      doc.setFontSize(20);
      doc.setTextColor(102, 126, 234); // Purple
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
        if (risk_factors.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(231, 76, 60); // Red
        doc.text('⚠️ Riskfaktorer', 20, y);
        y += 10;

        doc.setFontSize(9);
        doc.setTextColor(0);
        risk_factors.forEach(risk => {
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
        doc.setTextColor(39, 174, 96); // Green
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
        doc.text(`Algoritm: ${model_info.algorithm}`, 25, y);
        y += 6;
        doc.text(`Tränings-RMSE: ${model_info.training_rmse?.toFixed(3) || 'N/A'}`, 25, y);
        y += 6;
        doc.text(`Datapunkter använd: ${model_info.data_points_used}`, 25, y);
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
      })
      .catch((err) => {
        logger.error('Failed to export analytics as PDF', err);
        setPdfError(
          t('analytics.pdfExportUnavailable', {
            defaultValue: 'PDF-exporten är tillfälligt otillgänglig. Försök igen senare.',
          })
        );
      });
  };

  const _getSentimentColor = (score: number) => {
    if (score > 0.2) return '#4CAF50';
    if (score < -0.2) return '#F44336';
    return '#FF9800';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.2) return t('mood.positive');
    if (score < -0.2) return t('mood.negative');
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

  if (loading) {
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

  if (!forecast || !forecast.current_analysis) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-blue-800 dark:text-blue-300">{t('analytics.noData')}</p>
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
        <div className="flex items-center gap-3">
          <LightBulbIcon className="w-8 h-8 text-primary-600 dark:text-primary-500" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {t('analytics.title')}
          </h1>
        </div>

        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
          {t('analytics.description')}
        </p>

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
                  {statistics.total_moods}
                </p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="text-success-600">↑ {statistics.positive_percentage.toFixed(0)}%</span>
                  <span className="text-gray-500">• {statistics.neutral_percentage.toFixed(0)}%</span>
                  <span className="text-error-600">↓ {statistics.negative_percentage.toFixed(0)}%</span>
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
                  {statistics.current_streak} dagar
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Längsta: {statistics.longest_streak} dagar
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
                  {statistics.average_sentiment.toFixed(2)}
                </p>
                <p className={`text-xs mt-1 ${
                  statistics.average_sentiment > 0.2 ? 'text-success-600' :
                  statistics.average_sentiment < -0.2 ? 'text-error-600' :
                  'text-gray-500'
                }`}>
                  {statistics.average_sentiment > 0.2 ? 'Positivt' :
                   statistics.average_sentiment < -0.2 ? 'Negativt' : 'Neutralt'}
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
                  {statistics.recent_trend === 'improving' ? (
                    <ArrowTrendingUpIcon className="w-8 h-8 text-success-600" />
                  ) : statistics.recent_trend === 'declining' ? (
                    <ArrowTrendingDownIcon className="w-8 h-8 text-error-600" />
                  ) : (
                    <ChartBarIcon className="w-8 h-8 text-gray-500" />
                  )}
                  <span className={`text-lg font-semibold ${
                    statistics.recent_trend === 'improving' ? 'text-success-600' :
                    statistics.recent_trend === 'declining' ? 'text-error-600' :
                    'text-gray-600'
                  }`}>
                    {statistics.recent_trend === 'improving' ? 'Förbättras' :
                     statistics.recent_trend === 'declining' ? 'Minskar' : 'Stabilt'}
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
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${((forecast.current_analysis.recent_average + 1) / 2) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={((forecast.current_analysis.recent_average + 1) / 2) * 100}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {forecast.current_analysis.recent_average.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getSentimentLabel(forecast.current_analysis.recent_average)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.volatility')}
                </p>
                <p className={`text-lg font-semibold ${
                  forecast.current_analysis.volatility > 0.5 ? 'text-warning-600' : 'text-success-600'
                }`}>
                  {(forecast.current_analysis.volatility || 0).toFixed(2)}
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
                    {forecast.forecast.average_forecast.toFixed(2)}
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

                {/* HONEST: Only show AI confidence when AI service is actually working */}
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
          {forecast.risk_factors.length > 0 && (
            <Card>
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ExclamationTriangleIcon className="w-5 h-5 text-warning-600 dark:text-warning-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('analytics.riskFactors')}
                  </h3>
                </div>

                <div className="flex flex-col gap-2">
                  {forecast.risk_factors.map((risk) => (
                    <div key={risk} className="flex items-center gap-2">
                      {getRiskIcon(risk)}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {t(`analytics.risks.${risk}`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Recommendations */}
          <Card className={forecast.risk_factors.length === 0 ? 'md:col-span-2' : ''}>
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
                  {forecast.model_info.algorithm.replace('_', ' ').toUpperCase()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.trainingAccuracy')}
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {forecast.model_info.training_rmse.toFixed(3)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('analytics.dataPoints')}
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {forecast.model_info.data_points_used}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

export default MoodAnalytics;

