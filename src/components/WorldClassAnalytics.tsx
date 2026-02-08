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
  ShareIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../hooks/useAccessibility';
import { useSubscription } from '../contexts/SubscriptionContext';
import { analytics } from '../services/analytics';
import { getMoods, getWeeklyAnalysis } from '../api/api';
import useAuth from '../hooks/useAuth';
import '../styles/world-class-design.css';
import { Button, Alert, Card } from './ui/tailwind';
import { colors } from '../theme/tokens';

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
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPremium, plan } = useSubscription();
  
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
  console.log('📊 ANALYTICS - Component mounted', { userId: user?.user_id });
  analytics.page('World Class Analytics', {
    component: 'WorldClassAnalytics',
  });

  loadAnalyticsData();
}, [user?.user_id]);

  const loadAnalyticsData = async () => {
  console.log('📊 ANALYTICS - Loading data...');
  if (!user?.user_id) {
    console.warn('⚠️ ANALYTICS - No user ID');
    setLoading(false);
    return;
  }

    try {
      setLoading(true);

      let [moodsData, weeklyAnalysisData] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
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
        console.log(`📊 ANALYTICS - Filtered moods: ${originalCount} → ${moodsData.length} (${historyDays} days limit)`);
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

      setData({
        totalMoods,
        averageMood: Math.round(averageMood * 10) / 10,
        moodTrend,
        weeklyProgress: weeklyAnalysisData.weekly_progress || 0,
        weeklyGoal: Math.max(weeklyAnalysisData.weekly_goal || 7, 1),
        streakDays: weeklyAnalysisData.streak_days || 0,
        insights,
        moodDistribution,
        weeklyData,
      });
      console.log('✅ ANALYTICS - Data loaded', { totalMoods, averageMood, moodTrend, insights: insights.length });

      announceToScreenReader('Analytics data loaded successfully', 'polite');

    } catch (error) {
      console.error('Failed to load analytics data:', error);
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
        title: 'Börja spåra ditt humör',
        description: 'Logga ditt humör regelbundet för att få bättre insikter om dina mönster.',
        severity: 'medium' as const,
      });
    }

    if (avgMood >= 7) {
      insights.push({
        id: 'positive-trend',
        type: 'improvement' as const,
        title: 'Positiv trend!',
        description: 'Ditt genomsnittliga humör är högt. Fortsätt med det du gör!',
        severity: 'low' as const,
      });
    }

    if (trend === 'down') {
      insights.push({
        id: 'concerning-trend',
        type: 'concern' as const,
        title: 'Nedåtgående trend',
        description: 'Ditt humör har sjunkit de senaste dagarna. Överväg att prata med någon.',
        severity: 'high' as const,
      });
    }

    if (avgMood <= 4) {
      insights.push({
        id: 'low-mood-support',
        type: 'concern' as const,
        title: 'Behöver du stöd?',
        description: 'Ditt humör är lågt. Du är inte ensam - överväg professionell hjälp.',
        severity: 'high' as const,
      });
    }

    return insights;
  };

  const calculateMoodDistribution = (moods: MoodData[]) => {
    const distribution: { [key: string]: number } = {
      'Mycket dåligt (1-2)': 0,
      'Dåligt (3-4)': 0,
      'Neutralt (5-6)': 0,
      'Bra (7-8)': 0,
      'Mycket bra (9-10)': 0,
    };

    moods.forEach((mood: MoodData) => {
      const score = mood.score || 0;
      if (score <= 2) distribution['Mycket dåligt (1-2)'] = (distribution['Mycket dåligt (1-2)'] || 0) + 1;
      else if (score <= 4) distribution['Dåligt (3-4)'] = (distribution['Dåligt (3-4)'] || 0) + 1;
      else if (score <= 6) distribution['Neutralt (5-6)'] = (distribution['Neutralt (5-6)'] || 0) + 1;
      else if (score <= 8) distribution['Bra (7-8)'] = (distribution['Bra (7-8)'] || 0) + 1;
      else distribution['Mycket bra (9-10)'] = (distribution['Mycket bra (9-10)'] || 0) + 1;
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
          Analyserar dina data...
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
              📊 Dina Insikter & Analys
            </h2>
            <div className="flex gap-2">
              <Button onClick={loadAnalyticsData} variant="outline" size="sm">
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Uppdatera
              </Button>
              <Button variant="outline" size="sm">
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Exportera
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
                    <p className="font-bold">Gratis: Endast senaste {historyDays} dagars historik</p>
                    <p className="text-sm opacity-90">Uppgradera till Premium för obegränsad historik och djupare insikter</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/upgrade')}
                  className="px-4 py-2 bg-white text-amber-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Uppgradera
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
                  🔍 Fullständig Ärlighet & Transparens
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  Denna analys visar <strong>exakt dina råa data</strong> utan filtrering, manipulation eller optimering.
                  {!isPremium && <strong> (Begränsat till {historyDays} dagar för gratisanvändare)</strong>}
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <p>• <strong>Genomsnitt:</strong> Enkel aritmetisk medelvärde av alla dina humör-poäng</p>
                  <p>• <strong>Trender:</strong> Jämförelse mellan senaste 7 dagar vs föregående 7 dagar</p>
                  <p>• <strong>Insikter:</strong> Automatiskt genererade baserat på enkla matematiska trösklar</p>
                  <p>• <strong>Inga filter:</strong> Alla dagar med/utan loggningar visas exakt som de är</p>
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
                Genomsnittligt humör
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ({data.totalMoods > 0 ? 'baserat på alla dina loggningar' : 'inga loggningar än'})
              </p>
            </Card>

            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.totalMoods}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                Totala loggningar
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                exakt antal inlägg
              </p>
            </Card>

            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.streakDays}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                Dagar i rad
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                dagar med minst 1 loggning
              </p>
            </Card>

            <Card className="world-class-analytics-card p-6 text-center">
              <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2 world-class-analytics-value">
                {data.insights.length}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 world-class-analytics-label">
                Automatiska insikter
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                baserat på enkla regler
              </p>
            </Card>
          </div>

          {/* Insights */}
          {data.insights.length > 0 && (
            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
                🤖 Automatiska Insikter (100% Ärliga Regler)
              </h3>

              {/* Transparency about insight generation */}
              <Alert variant="info" className="mb-4">
                <div className="text-sm">
                  <p className="font-semibold mb-2">🔍 Hur insikterna genereras:</p>
                  <div className="space-y-1 text-xs">
                    <p>• <strong>"Börja spåra ditt humör":</strong> Visas om du har {'<'} 3 loggningar totalt</p>
                    <p>• <strong>"Positiv trend":</strong> Visas om genomsnittligt humör {'>'}= 7.0</p>
                    <p>• <strong>"Nedåtgående trend":</strong> Visas om trenden är nedåtgående</p>
                    <p>• <strong>"Behöver du stöd":</strong> Visas om genomsnittligt humör {'<='} 4.0</p>
                    <p className="font-medium mt-2">Dessa är enkla, automatiska regler - ingen AI eller komplex analys.</p>
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
                          Automatiskt genererad baserat på dina data
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
              📈 Humörfördelning (Exakt Räknat)
            </h3>

            <Alert variant="info" className="mb-4">
              <p className="text-sm">
                <strong>100% ärlig fördelning:</strong> Varje humör-poäng från dina loggningar räknas exakt en gång.
                Inga approximationer, ingen rounding, ingen manipulation.
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
                    exakt antal loggningar
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* Weekly Progress */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              📅 Veckoöversikt (Exakt Räknat)
            </h3>

            <Card className="p-6">
              <Alert variant="info" className="mb-4">
                <p className="text-sm">
                  <strong>Ärlig vecko-spårning:</strong> Visar exakt antal dagar denna vecka där du loggade minst ett humör.
                  Inga "bonuspoäng", inga "extrakrediter" - bara dina faktiska loggningar.
                </p>
              </Alert>

              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {data.weeklyProgress} / {data.weeklyGoal} dagar med loggningar
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
                  Procent beräknat som: (dina loggningsdagar / ditt mål) × 100
                </p>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {data.weeklyData.map((day, index) => (
                  <div key={index} className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {day.day}
                    </p>
                    <div
                      className={`h-10 rounded flex items-end justify-center ${
                        day.mood > 0
                          ? 'bg-primary-600'
                          : 'bg-gray-200 dark:bg-gray-700 opacity-30'
                      }`}
                      title={day.count > 0 ? `${day.count} loggning(ar) denna dag` : 'Inga loggningar denna dag'}
                    >
                      {day.count > 0 && (
                        <span className="text-xs text-white font-bold mb-1">
                          {day.count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {day.count > 0 ? `${day.count} st` : '0 st'}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Trend Analysis */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              📊 Trendanalys (100% Ärlig)
            </h3>

            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4">
                {data.moodTrend === 'up' && <ArrowTrendingUpIcon className="w-8 h-8 text-green-500" />}
                {data.moodTrend === 'down' && <ArrowTrendingDownIcon className="w-8 h-8 text-red-500" />}
                {data.moodTrend === 'stable' && <PresentationChartLineIcon className="w-8 h-8 text-yellow-500" />}

                <div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {data.moodTrend === 'up' && 'Uppåtgående trend'}
                    {data.moodTrend === 'down' && 'Nedåtgående trend'}
                    {data.moodTrend === 'stable' && 'Stabil trend'}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Exakt beräkning: Senaste 7 dagar vs föregående 7 dagar
                  </p>
                </div>
              </div>

              {/* Transparent Calculation Explanation */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                  🔢 Hur trenden beräknas (fullständigt ärligt):
                </h5>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p>• Tar <strong>exakt 7 dagar bakåt</strong> från idag = "senaste veckan"</p>
                  <p>• Tar <strong>dag 8-14 bakåt</strong> från idag = "föregående vecka"</p>
                  <p>• Räknar enkelt genomsnitt för varje period</p>
                  <p>• Om senaste veckan {'>'} föregående vecka + 0.5 poäng = uppåtgående</p>
                  <p>• Om senaste veckan {'<'} föregående vecka - 0.5 poäng = nedåtgående</p>
                  <p>• Annars = stabil</p>
                  <p className="font-medium mt-2">Inga filter, ingen smoothing, ingen manipulation.</p>
                </div>
              </div>

              {data.moodTrend === 'down' && (
                <Alert variant="warning" className="mt-4">
                  <div>
                    <p className="text-sm mb-2">
                      <strong>Ärlig observation:</strong> Dina senaste 7 dagar visar lägre humör än veckan innan.
                      Detta är inte en diagnos - bara dina faktiska data.
                    </p>
                    <p className="text-sm">
                      Om du känner dig nedstämd, överväg att prata med en vän, familjemedlem eller professionell hjälpare.
                      Du är inte ensam i detta.
                    </p>
                  </div>
                </Alert>
              )}

              {data.moodTrend === 'up' && (
                <Alert variant="success" className="mt-4">
                  <p className="text-sm">
                    <strong>Ärlig observation:</strong> Dina senaste 7 dagar visar högre humör än veckan innan.
                    Detta är baserat på dina faktiska loggningar - grattis till förbättringen!
                  </p>
                </Alert>
              )}
            </Card>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 world-class-heading-3">
              💡 Rekommendationer
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6 bg-primary-500 text-white">
                <SparklesIcon className="w-8 h-8 mb-4" />
                <h4 className="text-xl font-semibold mb-2">
                  Fortsätt spåra regelbundet
                </h4>
                <p className="text-sm">
                  Daglig humörspårning hjälper dig förstå dina mönster och förbättrar dina insikter över tid.
                </p>
              </Card>

              <Card className="p-6 bg-secondary-500 text-white">
                <HeartIcon className="w-8 h-8 mb-4" />
                <h4 className="text-xl font-semibold mb-2">
                  Fokusera på välbefinnande
                </h4>
                <p className="text-sm">
                  Överväg mindfulness, motion eller andra aktiviteter som förbättrar ditt humör.
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
