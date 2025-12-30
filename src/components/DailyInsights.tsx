/**
 * Daily Insights Component
 * AI-powered mood analysis and personalized recommendations
 * 100% Tailwind Native - No MUI Dependencies
 */

import React, { useEffect, useState } from 'react'
import { Card, Button } from './ui/tailwind';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import { trackEvent } from '../services/analytics';

interface DailyInsightsProps {
  userId: string;
  moodData: any[];
}

interface Insight {
  type: 'trend' | 'pattern' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export const DailyInsights: React.FC<DailyInsightsProps> = ({
  userId,
  moodData,
}) => {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [moodScore, setMoodScore] = useState<number>(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  useEffect(() => {
    if (moodData && moodData.length > 0) {
      analyzeData();
      trackEvent('daily_insights_viewed', { userId });
    }
  }, [moodData, userId]);

  const analyzeData = () => {
    // Calculate average mood score
    const scores = moodData.map((m) => m.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Handle different score ranges: normalize to 0-100
    // Backend can return scores in range 0-10 or -1 to 1
    let normalizedScore;
    if (avgScore > 1) {
      // Assume 0-10 range, convert to percentage
      normalizedScore = Math.min(100, Math.max(0, (avgScore / 10) * 100));
    } else {
      // Assume -1 to 1 range, convert to 0-100
      normalizedScore = Math.min(100, Math.max(0, (avgScore + 1) * 50));
    }

    setMoodScore(Math.round(normalizedScore));

    // Determine trend
    if (moodData.length >= 2) {
      const recentScore = scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
      const olderScore = scores.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 3);

      if (recentScore > olderScore + 0.2) setTrend('up');
      else if (recentScore < olderScore - 0.2) setTrend('down');
      else setTrend('stable');
    }

    // Generate insights
    const generatedInsights: Insight[] = [];

    // Trend insight
    if (trend === 'up') {
      generatedInsights.push({
        type: 'trend',
        title: t('insights.trendUp', 'Mood Improving'),
        description: t('insights.trendUpDesc', 'Your mood has been trending upward. Keep up the good work!'),
        icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
        color: '#4CAF50',
      });
    } else if (trend === 'down') {
      generatedInsights.push({
        type: 'trend',
        title: t('insights.trendDown', 'Need Support'),
        description: t('insights.trendDownDesc', 'Your mood has been lower lately. Consider reaching out for support.'),
        icon: <ArrowTrendingDownIcon className="w-5 h-5" />,
        color: '#FF9800',
      });
    } else {
      generatedInsights.push({
        type: 'trend',
        title: t('insights.trendStable', 'Mood Stable'),
        description: t('insights.trendStableDesc', 'Your mood has been consistent. Great job maintaining balance!'),
        icon: <MinusIcon className="w-5 h-5" />,
        color: '#2196F3',
      });
    }

    // Pattern insight
    const morningMoods = moodData.filter((m) => {
      const hour = new Date(m.timestamp).getHours();
      return hour >= 6 && hour < 12;
    });

    if (morningMoods.length > 0) {
      const avgMorningScore = morningMoods.reduce((a, m) => a + (m.score || 0), 0) / morningMoods.length;
      if (avgMorningScore > 0.3) {
        generatedInsights.push({
          type: 'pattern',
          title: t('insights.morningPattern', 'Morning Person'),
          description: t('insights.morningPatternDesc', 'You tend to feel best in the mornings. Plan important tasks early!'),
          icon: <LightBulbIcon className="w-5 h-5" />,
          color: '#FFD54F',
        });
      }
    }

    // Recommendation
    if (avgScore < -0.3) {
      generatedInsights.push({
        type: 'recommendation',
        title: t('insights.recBreathing', 'Try Breathing Exercises'),
        description: t('insights.recBreathingDesc', 'Deep breathing can help reduce stress and improve mood.'),
        icon: <LightBulbIcon className="w-5 h-5" />,
        color: '#81C784',
      });
    } else if (avgScore > 0.5) {
      generatedInsights.push({
        type: 'achievement',
        title: t('insights.achievement', 'Great Week!'),
        description: t('insights.achievementDesc', 'You\'ve had mostly positive moods this week. Celebrate your progress!'),
        icon: <LightBulbIcon className="w-5 h-5" />,
        color: '#4CAF50',
      });
    }

    setInsights(generatedInsights);
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />;
      case 'down':
        return <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />;
      default:
        return <MinusIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Mood Score Card */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white to-indigo-50 dark:from-slate-800 dark:to-slate-800/50 p-6 sm:p-8 shadow-xl border border-indigo-100 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <h6 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {t('insights.overallMood', 'Din Dagliga Puls')}
            </h6>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Baserat på dina senaste loggar
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className={`p-3 rounded-2xl bg-white dark:bg-slate-700 shadow-md ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-rose-500' : 'text-gray-400'
              }`}>
              {getTrendIcon()}
            </div>
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                {moodScore}
              </span>
              <span className="text-lg text-gray-400 ml-1">%</span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="h-4 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${moodScore}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={`h-full rounded-full ${moodScore > 70 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  moodScore > 40 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                    'bg-gradient-to-r from-rose-400 to-red-500'
                }`}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <span>Behöver Stöd</span>
            <span>Balanserad</span>
            <span>Fantastisk</span>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="group h-full"
          >
            <div
              className={`h-full p-6 rounded-[2rem] border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden`}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                borderColor: `${insight.color}30`
              }}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl -mr-10 -mt-10`}
                style={{ backgroundColor: insight.color }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm`}
                    style={{ backgroundColor: `${insight.color}15`, color: insight.color }}>
                    {insight.icon}
                  </div>
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700"
                    style={{ color: insight.color }}>
                    {insight.type}
                  </span>
                </div>

                <h6 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {insight.title}
                </h6>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {insights.length === 0 && (
        <div className="relative overflow-hidden rounded-[2rem] bg-gray-50 dark:bg-slate-800/50 border-2 border-dashed border-gray-200 dark:border-slate-700 p-12 text-center group hover:border-indigo-300 transition-colors">
          <div className="mb-4 text-4xl transform group-hover:scale-110 transition-transform duration-300">📝</div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Inga insikter ännu
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Logga ditt humör regelbundet för att låsa upp personliga insikter och trender.
          </p>
          <Button variant="primary" className="rounded-xl shadow-lg shadow-indigo-500/20">
            {t('insights.logMood', 'Logga Humör')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DailyInsights;

