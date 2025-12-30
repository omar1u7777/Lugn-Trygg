import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api/api';

interface QuickStatsProps {
  userId: string;
}

interface Stats {
  total_moods: number;
  avg_mood_this_week: number;
  current_streak: number;
  mood_trend: 'improving' | 'declining' | 'stable';
}

const QuickStatsWidget: React.FC<QuickStatsProps> = ({ userId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId]);

  const loadStats = async () => {
    // CRITICAL FIX: Check userId before making API call
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Fetch moods to calculate stats
      const response = await api.get(`/api/mood/get?user_id=${userId}`);
      // CRITICAL FIX: Better data extraction
      const moods = response.data?.moods || response.data || [];

      // CRITICAL FIX: Better null safety
      const totalMoods = Array.isArray(moods) ? moods.length : 0;

      // Calculate average mood this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const weekMoods = (Array.isArray(moods) ? moods : []).filter((mood: any) => {
        if (!mood || !mood.timestamp) return false;
        try {
          const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
          if (isNaN(moodDate.getTime())) return false;
          return moodDate >= oneWeekAgo;
        } catch (error) {
          return false;
        }
      });

      const avgMood = weekMoods.length > 0
        ? weekMoods.reduce((sum: number, mood: any) => {
            const score = typeof mood.score === 'number' && !isNaN(mood.score) ? mood.score : 0;
            return sum + score;
          }, 0) / weekMoods.length
        : 0;

      // Calculate current streak
      // CRITICAL FIX: Better null safety and error handling
      let streak = 0;
      if (Array.isArray(moods) && moods.length > 0) {
        const sortedMoods = [...moods].sort((a: any, b: any) => {
          try {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
            return dateB.getTime() - dateA.getTime();
          } catch (error) {
            return 0;
          }
        });

        const currentDate = new Date();
        for (const mood of sortedMoods) {
          try {
            if (!mood || !mood.timestamp) continue;
            const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
            if (isNaN(moodDate.getTime())) continue;
            
            const daysDiff = Math.floor((currentDate.getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= streak + 1) {
              if (daysDiff === streak) {
                streak++;
              }
            } else {
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }

      // Determine trend
      // CRITICAL FIX: Better null safety
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (weekMoods.length >= 3) {
        const firstHalf = weekMoods.slice(0, Math.floor(weekMoods.length / 2));
        const secondHalf = weekMoods.slice(Math.floor(weekMoods.length / 2));
        
        const avgFirst = firstHalf.length > 0
          ? firstHalf.reduce((sum: number, m: any) => {
              const score = typeof m.score === 'number' && !isNaN(m.score) ? m.score : 0;
              return sum + score;
            }, 0) / firstHalf.length
          : 0;
        const avgSecond = secondHalf.length > 0
          ? secondHalf.reduce((sum: number, m: any) => {
              const score = typeof m.score === 'number' && !isNaN(m.score) ? m.score : 0;
              return sum + score;
            }, 0) / secondHalf.length
          : 0;
        
        if (avgSecond > avgFirst + 0.5) trend = 'improving';
        else if (avgSecond < avgFirst - 0.5) trend = 'declining';
      }

      // CRITICAL FIX: Better number validation
      const convertedAvgMood = typeof avgMood === 'number' && !isNaN(avgMood)
        ? Number(((avgMood + 1) * 5).toFixed(1))
        : 0;
      
      setStats({
        total_moods: totalMoods,
        avg_mood_this_week: convertedAvgMood, // Convert -1 to 1 scale to 0-10
        current_streak: streak,
        mood_trend: trend,
      });
    } catch (error: unknown) {
      // CRITICAL FIX: Better error handling
      console.error('Failed to load quick stats:', error);
      setStats({
        total_moods: 0,
        avg_mood_this_week: 0,
        current_streak: 0,
        mood_trend: 'stable',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const trendConfig = {
    improving: {
      icon: '📈',
      color: 'from-green-500 to-emerald-600',
      label: 'Förbättras',
      textColor: 'text-green-700 dark:text-green-300',
    },
    declining: {
      icon: '📉',
      color: 'from-red-500 to-rose-600',
      label: 'Nedåtgående',
      textColor: 'text-red-700 dark:text-red-300',
    },
    stable: {
      icon: '📊',
      color: 'from-blue-500 to-indigo-600',
      label: 'Stabil',
      textColor: 'text-blue-700 dark:text-blue-300',
    },
  };

  const trend = trendConfig[stats.mood_trend];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Total Moods */}
      <motion.div
        className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700 shadow-soft"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl">📝</span>
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-200 dark:bg-purple-900/50 px-2 py-1 rounded-full">
            TOTALT
          </span>
        </div>
        <h3 className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-1">
          {stats.total_moods}
        </h3>
        <p className="text-sm text-purple-700 dark:text-purple-300">Humörinlägg</p>
      </motion.div>

      {/* Average Mood This Week */}
      <motion.div
        className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700 shadow-soft"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl">📊</span>
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-200 dark:bg-blue-900/50 px-2 py-1 rounded-full">
            DENNA VECKA
          </span>
        </div>
        <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-1">
          {stats.avg_mood_this_week.toFixed(1)}/10
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">Genomsnittligt humör</p>
      </motion.div>

      {/* Current Streak */}
      <motion.div
        className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700 shadow-soft"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl">🔥</span>
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 bg-orange-200 dark:bg-orange-900/50 px-2 py-1 rounded-full">
            STREAK
          </span>
        </div>
        <h3 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-1">
          {stats.current_streak} {stats.current_streak === 1 ? 'dag' : 'dagar'}
        </h3>
        <p className="text-sm text-orange-700 dark:text-orange-300">Aktuell serie</p>
      </motion.div>

      {/* Mood Trend */}
      <motion.div
        className={`bg-gradient-to-br ${trend.color} rounded-xl p-6 shadow-soft text-white`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl">{trend.icon}</span>
          <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">
            TREND
          </span>
        </div>
        <h3 className="text-2xl font-bold mb-1">{trend.label}</h3>
        <p className="text-sm opacity-90">Senaste veckan</p>
      </motion.div>
    </div>
  );
};

export default QuickStatsWidget;
