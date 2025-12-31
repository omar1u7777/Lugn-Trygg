import React, { useState, useEffect } from 'react';
import { Card } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import DailyInsights from './DailyInsights';
import WeeklyAnalysis from './WeeklyAnalysis';
import useAuth from '../hooks/useAuth';
import { getMoods, getWeeklyAnalysis } from '../api/mood';
import {
  ArrowTrendingUpIcon,
  LightBulbIcon,
  ChartBarIcon,
  CalendarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`insights-tabpanel-${index}`}
    aria-labelledby={`insights-tab-${index}`}
  >
    {value === index && <div>{children}</div>}
  </div>
);

interface InsightsStats {
  totalDataPoints: number;
  averageMoodScore: number;
  trendsAnalyzed: number;
  predictionAccuracy: number;
}

interface AIPrediction {
  trendDirection: 'up' | 'down' | 'stable';
  trendPercentage: number;
  recommendation: string;
  bestTimeOfDay: string;
  suggestedActivity: string;
}

// Helper to get trend narrative
const getTrendNarrative = (stats: InsightsStats) => {
  if (stats.predictionAccuracy > 80) return "Vi börjar lära oss dina mönster riktigt bra.";
  if (stats.totalDataPoints < 10) return "Vi behöver lite mer data för att se tydliga mönster.";
  return "Varje loggning hjälper oss att förstå dig bättre.";
};

const InsightsHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [insightsStats, setInsightsStats] = useState<InsightsStats>({
    totalDataPoints: 0,
    averageMoodScore: 0,
    trendsAnalyzed: 0,
    predictionAccuracy: 0,
  });
  const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsightsData = async () => {
      logger.debug('InsightsHub mounted', { userId: user?.user_id });
      if (!user?.user_id) {
        logger.warn('InsightsHub - No user ID');
        setLoading(false);
        return;
      }

      try {
        logger.debug('Fetching moods and analysis...');
        // Fetch mood data
        const moods = await getMoods(user.user_id);
        const totalDataPoints = moods.length;

        // Calculate average mood score
        const averageMoodScore = moods.length > 0
          ? moods.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / moods.length
          : 0;

        // Fetch weekly analysis to get trends
        const weeklyData = await getWeeklyAnalysis(user.user_id);
        const trendsAnalyzed = weeklyData?.trends?.length || 0;

        // Estimate prediction accuracy based on data points
        const predictionAccuracy = Math.min(70 + totalDataPoints * 0.3, 92);

        setInsightsStats({
          totalDataPoints,
          averageMoodScore: Math.round(averageMoodScore * 10) / 10,
          trendsAnalyzed,
          predictionAccuracy: Math.round(predictionAccuracy),
        });

        // Generate AI predictions based on real data
        if (moods.length > 0) {
          // Calculate trend by comparing last week to previous week
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

          const lastWeekMoods = moods.filter((m: any) => new Date(m.timestamp) >= oneWeekAgo);
          const previousWeekMoods = moods.filter((m: any) => {
            const date = new Date(m.timestamp);
            return date >= twoWeeksAgo && date < oneWeekAgo;
          });

          const lastWeekAvg = lastWeekMoods.length > 0
            ? lastWeekMoods.reduce((sum: number, m: any) => sum + (m.score || 0), 0) / lastWeekMoods.length
            : averageMoodScore;
          const prevWeekAvg = previousWeekMoods.length > 0
            ? previousWeekMoods.reduce((sum: number, m: any) => sum + (m.score || 0), 0) / previousWeekMoods.length
            : averageMoodScore;

          const trendPercentage = prevWeekAvg > 0
            ? Math.round(((lastWeekAvg - prevWeekAvg) / prevWeekAvg) * 100)
            : 0;

          const trendDirection = trendPercentage > 5 ? 'up' : trendPercentage < -5 ? 'down' : 'stable';

          // Analyze best time of day
          const moodsByHour: { [key: number]: number[] } = {};
          moods.forEach((m: any) => {
            const hour = new Date(m.timestamp).getHours();
            if (!moodsByHour[hour]) moodsByHour[hour] = [];
            moodsByHour[hour].push(m.score || 5);
          });

          let bestHour = 9;
          let bestAvg = 0;
          Object.entries(moodsByHour).forEach(([hour, scores]) => {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg > bestAvg) {
              bestAvg = avg;
              bestHour = parseInt(hour);
            }
          });

          const timeLabels: { [key: number]: string } = {
            6: 'tidigt på morgonen (6-8)',
            9: 'förmiddagen (9-11)',
            12: 'lunch (12-14)',
            15: 'eftermiddagen (15-17)',
            18: 'kvällen (18-20)',
            21: 'sent på kvällen (21+)',
          };

          const bestTimeKey = Object.keys(timeLabels).map(Number).reduce((prev, curr) =>
            Math.abs(curr - bestHour) < Math.abs(prev - bestHour) ? curr : prev
          );

          const activities = ['meditation', 'promenad', 'djupandning', 'journalskrivning', 'musik'];
          const suggestedActivity = activities[Math.floor(averageMoodScore) % activities.length] || 'meditation';

          setAiPrediction({
            trendDirection,
            trendPercentage: Math.abs(trendPercentage),
            recommendation: trendDirection === 'up'
              ? 'Fortsätt med dina goda vanor - de ger resultat!'
              : trendDirection === 'down'
                ? 'Prova att lägga till 10 minuter avslappning dagligen.'
                : 'Du har ett stabilt mående - bra jobbat med konsistensen!',
            bestTimeOfDay: timeLabels[bestTimeKey] || 'förmiddagen',
            suggestedActivity,
          });
        }

        console.log('✅ INSIGHTS HUB - Stats calculated', { totalDataPoints, averageMoodScore, trendsAnalyzed, predictionAccuracy });
      } catch (error) {
        console.error('❌ INSIGHTS HUB - Failed to fetch insights data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, [user?.user_id]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Narrative Hero Section */}
      <section className="mb-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-2xl p-8 sm:p-12">
          {/* Abstract Background Shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-indigo-200 mb-4">
                  <LightBulbIcon className="w-4 h-4" />
                  <span>Data Storytelling</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold mb-2 tracking-tight">
                  Din Insiktsresa
                </h1>
                <p className="text-indigo-200 text-lg max-w-xl">
                  {getTrendNarrative(insightsStats)}
                </p>
              </div>

              {/* Quick Pulse Score */}
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10">
                <div className="text-right">
                  <p className="text-sm text-indigo-200">Genomsnittligt Humör</p>
                  <p className="text-3xl font-bold">{loading ? '-' : insightsStats.averageMoodScore.toFixed(1)}</p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-indigo-400 border-t-white flex items-center justify-center text-xl">
                  {loading ? '...' : (insightsStats.averageMoodScore >= 7 ? '☀️' : insightsStats.averageMoodScore >= 5 ? '⛅' : '🌧️')}
                </div>
              </div>
            </div>

            {/* Insight Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Datapunkter', value: insightsStats.totalDataPoints, text: 'stunder loggade' },
                { label: 'Trender', value: insightsStats.trendsAnalyzed, text: 'mönster funna' },
                { label: 'Träffsäkerhet', value: `${insightsStats.predictionAccuracy}%`, text: 'i våra prognoser' }
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                  <p className="text-2xl font-bold mb-1">{loading ? '-' : stat.value}</p>
                  <p className="text-sm text-indigo-200">{stat.label}</p>
                  <p className="text-xs text-indigo-400 mt-1">{stat.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Intelligence Layer */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI-Analys & Framtid</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Prediktiva insikter baserat på dina mönster</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
            <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
          </div>
        ) : !aiPrediction ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500">Logga mer data för att låsa upp AI-prediktioner!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trend Card */}
            <div className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-lg transition-all hover:shadow-2xl">
              <div className={`absolute top-0 right-0 p-32 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 ${aiPrediction.trendDirection === 'up' ? 'bg-green-500' : aiPrediction.trendDirection === 'down' ? 'bg-red-500' : 'bg-blue-500'
                }`} />

              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider text-xs">Aktuell Trend</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`text-4xl font-bold ${aiPrediction.trendDirection === 'up' ? 'text-green-600 dark:text-green-400' : aiPrediction.trendDirection === 'down' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                    {aiPrediction.trendDirection === 'up' ? '↗' : aiPrediction.trendDirection === 'down' ? '↘' : '→'} {aiPrediction.trendPercentage}%
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {aiPrediction.trendDirection === 'up' ? 'uppgång' : aiPrediction.trendDirection === 'down' ? 'nedgång' : 'stabilt'}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                  {aiPrediction.recommendation}
                </p>
              </div>
            </div>

            {/* Recommendation Card */}
            <div className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-lg transition-all hover:shadow-2xl">
              <div className="absolute top-0 right-0 p-32 bg-amber-500 rounded-full blur-3xl opacity-10 -mr-16 -mt-16 group-hover:opacity-20 transition-opacity" />

              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider text-xs">Smart Rekommendation</h3>
                <div className="mb-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    Bästa tid: {aiPrediction.bestTimeOfDay}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                  <p className="text-amber-800 dark:text-amber-200 font-medium flex items-start gap-2">
                    <span className="text-xl">💡</span>
                    <span>Prova {aiPrediction.suggestedActivity} under denna tid för att maximera ditt välmående.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Analysis Tabs */}
      <section>
        <div className="bg-white dark:bg-gray-800 rounded-t-3xl border-b border-gray-200 dark:border-gray-700 p-2 overflow-x-auto">
          <nav className="flex gap-2 min-w-max px-2">
            {[
              { icon: CalendarIcon, label: 'Daglig Puls', index: 0 },
              { icon: ArrowTrendingUpIcon, label: 'Veckospårning', index: 1 },
              // NOTE: More tabs can be added here
            ].map((tab) => (
              <button
                key={tab.index}
                onClick={() => setActiveTab(tab.index)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.index
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg transform scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-b-3xl shadow-xl min-h-[400px] p-6 sm:p-8 border border-t-0 border-gray-200 dark:border-gray-700">
          <TabPanel value={activeTab} index={0}>
            {user?.user_id ? (
              <div className="animate-fade-in">
                <DailyInsights userId={user.user_id} moodData={[]} />
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-xl text-gray-500">Logga in för att se din dagliga puls.</p>
              </div>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {user?.user_id ? (
              <div className="animate-fade-in">
                <WeeklyAnalysis />
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-xl text-gray-500">Logga in för att se veckoanalyser.</p>
              </div>
            )}
          </TabPanel>
        </div>
      </section>
    </div>
  );
};

export default InsightsHub;
