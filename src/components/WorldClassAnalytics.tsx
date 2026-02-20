import React, { useState, useEffect } from 'react'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  PresentationChartLineIcon,
  LightBulbIcon,
  SparklesIcon,
  HeartIcon,
  XMarkIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { useSubscription } from '../contexts/SubscriptionContext';
import { analytics } from '../services/analytics';
import { getMoods, getWeeklyAnalysis } from '../api/api';
import useAuth from '../hooks/useAuth';
import { Button, Alert, Card } from './ui/tailwind';
import { colors } from '../theme/tokens';
import { logger } from '../utils/logger';


interface MoodData {
  score?: number;
  timestamp?: any; // Can be Firestore timestamp, number, or string
}

interface WorldClassAnalyticsProps {
  onClose: () => void;
}

interface AnalyticsData {
  totalMoods: number;
  averageMood: number;
  moodTrend: 'up' | 'down' | 'stable';
  weeklyProgress: number;
  weeklyGoal: number;
  streakDays: number;
  insights: Array<{
    id: string;
    type: 'pattern' | 'improvement' | 'concern';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  moodDistribution: { [key: string]: number };
  weeklyData: Array<{ day: string; mood: number; count: number }>;
}

const WorldClassAnalytics: React.FC<WorldClassAnalyticsProps> = ({ onClose }) => {
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPremium, plan } = useSubscription();
  const { t } = useTranslation();
  
  // History limit for free users
  const historyDays = isPremium ? -1 : plan.limits.historyDays; // 7 days for free

  const [data, setData] = useState<AnalyticsData>({
    totalMoods: 0,
    averageMood: 0,
    moodTrend: 'stable',
    weeklyProgress: 0,
    weeklyGoal: 7,
    streakDays: 0,
    insights: [],
    moodDistribution: {},
    weeklyData: [],
  });

  const [loading, setLoading] = useState(true);

useEffect(() => {
  logger.debug('📊 ANALYTICS - Component mounted', { userId: user?.user_id });
  analytics.page('World Class Analytics', {
    component: 'WorldClassAnalytics',
  });

  loadAnalyticsData();
}, [user?.user_id]);

  const loadAnalyticsData = async () => {
  logger.debug('📊 ANALYTICS - Loading data...');
  if (!user?.user_id) {
    logger.warn('⚠️ ANALYTICS - No user ID');
    setLoading(false);
    return;
  }

    try {
      setLoading(true);

      const [moodsData, _weeklyAnalysisData] = await Promise.all([
        getMoods(user.user_id).catch((error) => { console.error('Failed to fetch moods:', error); return []; }),
        getWeeklyAnalysis(user.user_id).catch((error) => { console.error('Failed to fetch weekly analysis:', error); return {}; }),
      ]);
      
      // REAL SUBSCRIPTION LIMIT: Filter moods for free users (7 days only)
      if (historyDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - historyDays);
        const originalCount = moodsData.length;
        moodsData = moodsData.filter((mood: MoodData) => {
          const moodDate = new Date(mood.timestamp);
          return moodDate >= cutoffDate;
        });
        logger.debug(`📊 ANALYTICS - Filtered moods: ${originalCount} → ${moodsData.length} (${historyDays} days limit)`);
      }

      // Process mood data
      const totalMoods = moodsData.length;
      const averageMood = totalMoods > 0
        ? moodsData.reduce((sum: number, mood: MoodData) => sum + (mood.score || 0), 0) / totalMoods
        : 0;

      // Calculate mood trend (simplified)
      const recentMoods = moodsData.slice(-7);
      const olderMoods = moodsData.slice(-14, -7);
      const recentAvg = recentMoods.length > 0
        ? recentMoods.reduce((sum: number, mood: MoodData) => sum + (mood.score || 0), 0) / recentMoods.length
        : 0;
      const olderAvg = olderMoods.length > 0
        ? olderMoods.reduce((sum: number, mood: MoodData) => sum + (mood.score || 0), 0) / olderMoods.length
        : 0;

      let moodTrend: 'up' | 'down' | 'stable' = 'stable';
      if (recentAvg > olderAvg + 0.5) moodTrend = 'up';
      if (recentAvg < olderAvg - 0.5) moodTrend = 'down';

      // Generate insights
      const insights = generateInsights(moodsData, averageMood, moodTrend);

      // Mood distribution
      const moodDistribution = calculateMoodDistribution(moodsData);

      // Weekly data (last 7 days)
      const weeklyData = generateWeeklyData(moodsData);

      // Calculate weekly progress: unique days with mood entries in last 7 days
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      const uniqueDaysThisWeek = new Set(
        moodsData
          .filter((m: MoodData) => new Date(m.timestamp) >= sevenDaysAgo)
          .map((m: MoodData) => new Date(m.timestamp).toDateString())
      ).size;

      // Calculate streak: consecutive days with mood entries (counting back from today)
      let calculatedStreak = 0;
      const daySet = new Set(moodsData.map((m: MoodData) => new Date(m.timestamp).toDateString()));
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() - i);
        if (daySet.has(checkDate.toDateString())) {
          calculatedStreak++;
        } else if (i > 0) {
          break; // Allow today to be missing (haven't logged yet)
        }
      }

      setData({
        totalMoods,
        averageMood: Math.round(averageMood * 10) / 10,
        moodTrend,
        weeklyProgress: uniqueDaysThisWeek,
        weeklyGoal: 7,
        streakDays: calculatedStreak,
        insights,
        moodDistribution,
        weeklyData,
      });
      logger.debug('✅ ANALYTICS - Data loaded', { totalMoods, averageMood, moodTrend, insights: insights.length });

      announceToScreenReader('Analytics data loaded successfully', 'polite');

    } catch (error) {
      logger.error('Failed to load analytics data:', error);
      announceToScreenReader('Failed to load analytics data', 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (moods: MoodData[], avgMood: number, trend: string) => {
    const insights = [];

    if (moods.length < 3) {
      insights.push({
        id: 'start-tracking',
        type: 'pattern' as const,
        title: t('worldAnalytics.insights.startTracking'),
        description: t('worldAnalytics.insights.startTrackingDesc'),
        severity: 'medium' as const,
      });
    }

    if (avgMood >= 7) {
      insights.push({
        id: 'positive-trend',
        type: 'improvement' as const,
        title: t('worldAnalytics.insights.positiveTrend'),
        description: t('worldAnalytics.insights.positiveTrendDesc'),
        severity: 'low' as const,
      });
    }

    if (trend === 'down') {
      insights.push({
        id: 'concerning-trend',
        type: 'concern' as const,
        title: t('worldAnalytics.insights.downwardTrend'),
        description: t('worldAnalytics.insights.downwardTrendDesc'),
        severity: 'high' as const,
      });
    }

    if (avgMood <= 4) {
      insights.push({
        id: 'low-mood-support',
        type: 'concern' as const,
        title: t('worldAnalytics.insights.needSupport'),
        description: t('worldAnalytics.insights.needSupportDesc'),
        severity: 'high' as const,
      });
    }

    return insights;
  };

  const calculateMoodDistribution = (moods: MoodData[]) => {
    const distribution: { [key: string]: number } = {
      [t('worldAnalytics.moodDistribution.veryBad')]: 0,
      [t('worldAnalytics.moodDistribution.bad')]: 0,
      [t('worldAnalytics.moodDistribution.neutral')]: 0,
      [t('worldAnalytics.moodDistribution.good')]: 0,
      [t('worldAnalytics.moodDistribution.veryGood')]: 0,
    };

    moods.forEach((mood: MoodData) => {
      const score = mood.score || 0;
      if (score <= 2) distribution[t('worldAnalytics.moodDistribution.veryBad')] = (distribution[t('worldAnalytics.moodDistribution.veryBad')] || 0) + 1;
      else if (score <= 4) distribution[t('worldAnalytics.moodDistribution.bad')] = (distribution[t('worldAnalytics.moodDistribution.bad')] || 0) + 1;
      else if (score <= 6) distribution[t('worldAnalytics.moodDistribution.neutral')] = (distribution[t('worldAnalytics.moodDistribution.neutral')] || 0) + 1;
      else if (score <= 8) distribution[t('worldAnalytics.moodDistribution.good')] = (distribution[t('worldAnalytics.moodDistribution.good')] || 0) + 1;
      else distribution[t('worldAnalytics.moodDistribution.veryGood')] = (distribution[t('worldAnalytics.moodDistribution.veryGood')] || 0) + 1;
    });

    return distribution;
  };

  const generateWeeklyData = (moods: MoodData[]) => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayMoods = moods.filter((mood: MoodData) => {
        const moodDate = new Date(mood.timestamp);
        return moodDate.toDateString() === date.toDateString();
      });

      last7Days.push({
        day: date.toLocaleDateString('sv-SE', { weekday: 'short' }),
        mood: dayMoods.length > 0
          ? dayMoods.reduce((sum: number, mood: MoodData) => sum + (mood.score || 0), 0) / dayMoods.length
          : 0,
        count: dayMoods.length,
      });
    }
    return last7Days;
  };

  const getSeverityAlertVariant = (severity: string): "info" | "warning" | "error" | "success" => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <ArrowTrendingDownIcon className="w-6 h-6" />;
      case 'medium': return <ChartBarIcon className="w-6 h-6" />;
      case 'low': return <ArrowTrendingUpIcon className="w-6 h-6" />;
      default: return <LightBulbIcon className="w-6 h-6" />;
    }
  };

  if (loading) {
    return (
      <div className="world-class-app p-8 text-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 world-class-body">
          {t('worldAnalytics.analyzing')}
        </h3>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div className="bg-primary-600 h-full animate-pulse" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="world-class-app min-h-screen p-4 md:p-6"
      style={{
        background: colors.background.gradient,
      }}
    >
      <Card className="world-class-dashboard-card max-w-7xl mx-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white world-class-heading-2">
              {t('worldAnalytics.title')}
            </h2>
            <div className="flex gap-2">
              <Button onClick={loadAnalyticsData} variant="outline" size="sm">
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                {t('worldAnalytics.refresh')}
              </Button>
              <Button variant="outline" size="sm">
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                {t('worldAnalytics.export')}
              </Button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close analytics"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Free Tier Limit Banner */}
          {!isPremium && (
            <div className="mb-8 p-4 bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LockClosedIcon className="w-6 h-6" />
                  <div>
                    <p className="font-bold">{t('worldAnalytics.freeTierBanner', { days: historyDays })}</p>
                    <p className="text-sm opacity-90">{t('worldAnalytics.upgradeMessage')}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/upgrade')}
                  className="px-4 py-2 bg-white text-amber-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {t('worldAnalytics.upgrade')}
                </button>
              </div>
            </div>
          )}

          {/* Transparency Disclaimer */}
          <Alert variant="info" className="mb-8">
            <div className="flex items-start gap-3">
              <LightBulbIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  {t('worldAnalytics.transparencyTitle')}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {t('worldAnalytics.transparencyDesc')}
                  {!isPremium && <strong> {t('worldAnalytics.freeTierNote', { days: historyDays })}</strong>}
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <p>• <strong>{t('worldAnalytics.methodAverage')}:</strong> {t('worldAnalytics.methodAverageDesc')}</p>
                  <p>• <strong>{t('worldAnalytics.methodTrends')}:</strong> {t('worldAnalytics.methodTrendsDesc')}</p>
                  <p>• <strong>{t('worldAnalytics.methodInsights')}:</strong> {t('worldAnalytics.methodInsightsDesc')}</p>
                  <p>• <strong>{t('worldAnalytics.methodNoFilter')}:</strong> {t('worldAnalytics.methodNoFilterDesc')}</p>
                </div>
              </div>
            </div>
          </Alert>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.averageMood}/10
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                {t('worldAnalytics.avgMood')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ({data.totalMoods > 0 ? t('worldAnalytics.basedOnAll') : t('worldAnalytics.noLogsYet')})
              </p>
            </Card>

            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.totalMoods}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                {t('worldAnalytics.totalLogs')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {t('worldAnalytics.exactCount')}
              </p>
            </Card>

            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.streakDays}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                {t('worldAnalytics.daysInRow')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {t('worldAnalytics.daysWithLog')}
              </p>
            </Card>

            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.insights.length}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                {t('worldAnalytics.autoInsights')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {t('worldAnalytics.basedOnRules')}
              </p>
            </Card>
          </div>

          {/* Insights */}
          {data.insights.length > 0 && (
            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
                {t('worldAnalytics.insightsTitle')}
              </h3>

              {/* Transparency about insight generation */}
              <Alert variant="info" className="mb-4">
                <div className="text-sm">
                  <p className="font-semibold mb-2">{t('worldAnalytics.insightsHow')}</p>
                  <div className="space-y-1 text-xs">
                    <p>{t('worldAnalytics.insightRule1')}</p>
                    <p>{t('worldAnalytics.insightRule2')}</p>
                    <p>{t('worldAnalytics.insightRule3')}</p>
                    <p>{t('worldAnalytics.insightRule4')}</p>
                    <p className="font-medium mt-2">{t('worldAnalytics.simpleRules')}</p>
                  </div>
                </div>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.insights.map((insight) => (
                  <Alert
                    key={insight.id}
                    variant={getSeverityAlertVariant(insight.severity)}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(insight.severity)}
                      <div>
                        <h4 className="font-semibold mb-1">
                          {insight.title}
                        </h4>
                        <p className="text-sm">
                          {insight.description}
                        </p>
                        <p className="text-xs opacity-75 mt-1">
                          {t('worldAnalytics.autoGenerated')}
                        </p>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Mood Distribution */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              {t('worldAnalytics.distributionTitle')}
            </h3>

            <Alert variant="info" className="mb-4">
              <p className="text-sm">
                {t('worldAnalytics.distributionDesc')}
              </p>
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(data.moodDistribution).map(([range, count]) => (
                <Card key={range} className="p-4 text-center">
                  <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {count}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {range}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {t('worldAnalytics.exactLogs')}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* Weekly Progress */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              {t('worldAnalytics.weeklyTitle')}
            </h3>

            <Card className="p-6">
              <Alert variant="info" className="mb-4">
                <p className="text-sm">
                  {t('worldAnalytics.weeklyDesc')}
                </p>
              </Alert>

              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {t('worldAnalytics.weeklyProgress', { current: data.weeklyProgress, goal: data.weeklyGoal })}
                  </p>
                  <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {Math.min(
                      100,
                      Math.round((data.weeklyProgress / Math.max(data.weeklyGoal, 1)) * 100)
                    )}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (data.weeklyProgress / Math.max(data.weeklyGoal, 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {t('worldAnalytics.percentCalc')}
                </p>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {data.weeklyData.map((day) => (
                  <div key={day.day} className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {day.day}
                    </p>
                    <div
                      className={`h-10 rounded flex items-end justify-center ${
                        day.mood > 0
                          ? 'bg-primary-600'
                          : 'bg-gray-200 dark:bg-gray-700 opacity-30'
                      }`}
                      title={day.count > 0 ? t('worldAnalytics.logsThisDay', { count: day.count }) : t('worldAnalytics.noLogsThisDay')}
                    >
                      {day.count > 0 && (
                        <span className="text-xs text-white font-bold mb-1">
                          {day.count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {day.count > 0 ? t('worldAnalytics.countSt', { count: day.count }) : t('worldAnalytics.zeroSt')}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Trend Analysis */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              {t('worldAnalytics.trendTitle')}
            </h3>

            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4">
                {data.moodTrend === 'up' && <ArrowTrendingUpIcon className="w-8 h-8 text-green-500" />}
                {data.moodTrend === 'down' && <ArrowTrendingDownIcon className="w-8 h-8 text-red-500" />}
                {data.moodTrend === 'stable' && <PresentationChartLineIcon className="w-8 h-8 text-yellow-500" />}

                <div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {data.moodTrend === 'up' && t('worldAnalytics.trendUp')}
                    {data.moodTrend === 'down' && t('worldAnalytics.trendDown')}
                    {data.moodTrend === 'stable' && t('worldAnalytics.trendStable')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('worldAnalytics.trendCalc')}
                  </p>
                </div>
              </div>

              {/* Transparent Calculation Explanation */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                  {t('worldAnalytics.trendHowTitle')}
                </h5>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p>{t('worldAnalytics.trendStep1')}</p>
                  <p>{t('worldAnalytics.trendStep2')}</p>
                  <p>{t('worldAnalytics.trendStep3')}</p>
                  <p>{t('worldAnalytics.trendStep4')}</p>
                  <p>{t('worldAnalytics.trendStep5')}</p>
                  <p>{t('worldAnalytics.trendStep6')}</p>
                  <p className="font-medium mt-2">{t('worldAnalytics.noFilterNote')}</p>
                </div>
              </div>

              {data.moodTrend === 'down' && (
                <Alert variant="warning" className="mt-4">
                  <div>
                    <p className="text-sm mb-2">
                      {t('worldAnalytics.trendDownWarning')}
                    </p>
                    <p className="text-sm">
                      {t('worldAnalytics.trendDownAdvice')}
                    </p>
                  </div>
                </Alert>
              )}

              {data.moodTrend === 'up' && (
                <Alert variant="success" className="mt-4">
                  <p className="text-sm">
                    {t('worldAnalytics.trendUpNote')}
                  </p>
                </Alert>
              )}
            </Card>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              {t('worldAnalytics.recommendationsTitle')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6 bg-primary-500 text-white">
                <SparklesIcon className="w-8 h-8 mb-4" />
                <h4 className="text-xl font-semibold mb-2">
                  {t('worldAnalytics.recTrackTitle')}
                </h4>
                <p className="text-sm">
                  {t('worldAnalytics.recTrackDesc')}
                </p>
              </Card>

              <Card className="p-6 bg-secondary-500 text-white">
                <HeartIcon className="w-8 h-8 mb-4" />
                <h4 className="text-xl font-semibold mb-2">
                  {t('worldAnalytics.recWellnessTitle')}
                </h4>
                <p className="text-sm">
                  {t('worldAnalytics.recWellnessDesc')}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WorldClassAnalytics;
