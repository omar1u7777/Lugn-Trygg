import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getMoods } from '../api/api';
import useAuth from '../hooks/useAuth';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';


interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  streak: number;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress?: number;
  maxProgress?: number;
}

const BadgeDisplay: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateBadges = async () => {
      if (!user?.user_id) return;

      try {
        const moods = await getMoods(user.user_id);
        const currentStreak = calculateCurrentStreak(moods);
        const longestStreak = calculateLongestStreak(moods);
        const totalEntries = moods.length;

        const badgeList: Badge[] = [
          {
            id: 'first-entry',
            title: t('badges.firstEntry.title', 'First Step'),
            description: t('badges.firstEntry.desc', 'Logged your first mood'),
            icon: '🎯',
            earned: totalEntries > 0,
            streak: 0,
            category: 'getting-started',
            rarity: 'common',
          },
          {
            id: 'week-streak',
            title: t('badges.weekStreak.title', 'Week Warrior'),
            description: t('badges.weekStreak.desc', '7 days in a row'),
            icon: '🔥',
            earned: currentStreak >= 7,
            streak: currentStreak,
            category: 'consistency',
            rarity: 'rare',
            progress: Math.min(currentStreak, 7),
            maxProgress: 7,
          },
          {
            id: 'month-streak',
            title: t('badges.monthStreak.title', 'Monthly Master'),
            description: t('badges.monthStreak.desc', '30 days in a row'),
            icon: '👑',
            earned: currentStreak >= 30,
            streak: currentStreak,
            category: 'consistency',
            rarity: 'epic',
            progress: Math.min(currentStreak, 30),
            maxProgress: 30,
          },
          {
            id: 'consistency',
            title: t('badges.consistency.title', 'Consistency King'),
            description: t('badges.consistency.desc', 'Longest streak: {days} days'),
            icon: '⭐',
            earned: longestStreak >= 14,
            streak: longestStreak,
            category: 'consistency',
            rarity: 'rare',
          },
          {
            id: 'explorer',
            title: t('badges.explorer.title', 'Mood Explorer'),
            description: t('badges.explorer.desc', 'Logged {count} moods'),
            icon: '🗺️',
            earned: totalEntries >= 50,
            streak: totalEntries,
            category: 'exploration',
            rarity: 'rare',
            progress: Math.min(totalEntries, 50),
            maxProgress: 50,
          },
          {
            id: 'mindful',
            title: 'Mindful Observer',
            description: 'Completed 10 mindfulness exercises',
            icon: '🧘',
            earned: false, // Requires backend exercise tracking
            streak: 0,
            category: 'mindfulness',
            rarity: 'common',
            progress: 0,
            maxProgress: 10,
          },
          {
            id: 'storyteller',
            title: 'Storyteller',
            description: 'Listened to 5 AI-generated stories',
            icon: '📚',
            earned: false, // Requires backend story tracking
            streak: 0,
            category: 'engagement',
            rarity: 'common',
            progress: 0,
            maxProgress: 5,
          },
          {
            id: 'health-sync',
            title: 'Health Syncer',
            description: 'Connected wearable device',
            icon: '⌚',
            earned: false, // Would be calculated from device connections
            streak: 0,
            category: 'integration',
            rarity: 'rare',
          },
          {
            id: 'crisis-helper',
            title: 'Crisis Supporter',
            description: 'Used crisis support features',
            icon: '🆘',
            earned: false, // Would be calculated from crisis interventions
            streak: 0,
            category: 'support',
            rarity: 'legendary',
          },
          {
            id: 'prediction-master',
            title: 'Prediction Master',
            description: 'Viewed mood predictions 10 times',
            icon: '🔮',
            earned: false, // Requires backend prediction view tracking
            streak: 0,
            category: 'advanced',
            rarity: 'epic',
            progress: 0,
            maxProgress: 10,
          },
        ];

        setBadges(badgeList);
      } catch (error) {
        logger.error('Failed to calculate badges:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateBadges();
  }, [user?.user_id, t]);

  interface MoodEntry {
    timestamp: any; // Firestore Timestamp or Date
    [key: string]: any;
  }

  const calculateCurrentStreak = (moods: MoodEntry[]): number => {
    if (moods.length === 0) return 0;

    const sortedMoods = moods.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedMoods.length; i++) {
      const moodDate = sortedMoods[i].timestamp?.toDate ? sortedMoods[i].timestamp.toDate() : new Date(sortedMoods[i].timestamp);
      moodDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);

      if (moodDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const calculateLongestStreak = (moods: MoodEntry[]): number => {
    if (moods.length === 0) return 0;

    const sortedMoods = moods.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });

    let longestStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < sortedMoods.length; i++) {
      const prevDate = sortedMoods[i - 1].timestamp?.toDate ? sortedMoods[i - 1].timestamp.toDate() : new Date(sortedMoods[i - 1].timestamp);
      const currDate = sortedMoods[i].timestamp?.toDate ? sortedMoods[i].timestamp.toDate() : new Date(sortedMoods[i].timestamp);

      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }

    return Math.max(longestStreak, currentStreak);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consistency': return '🔥';
      case 'mindfulness': return '🧘';
      case 'engagement': return '📚';
      case 'integration': return '⌚';
      case 'support': return '🆘';
      case 'advanced': return '🔮';
      default: return '🏆';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
          <span className="text-primary-500 text-lg">🏆</span>
          {t('dashboard.badges', 'Achievements')}
        </h3>

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {t('badges.description', 'Track your progress and unlock achievements as you use the app!')}
        </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {badges.map((badge, index) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              className={`relative bg-white dark:bg-slate-800 rounded-xl p-6 shadow-soft border-2 transition-all duration-300 hover:shadow-large hover:-translate-y-1 ${
                badge.earned
                  ? `border-yellow-400 dark:border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20`
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {badge.earned && (
                <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl ${
                  badge.earned
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {badge.earned ? badge.icon : <LockClosedIcon className="w-5 h-5" />}
                </div>

                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {badge.title}
                </h4>

                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                  {badge.description.replace('{days}', badge.streak.toString()).replace('{count}', badge.streak.toString())}
                </p>

                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    badge.rarity === 'common' ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                    badge.rarity === 'rare' ? 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    badge.rarity === 'epic' ? 'bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                    'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {badge.rarity}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {getCategoryIcon(badge.category)}
                  </span>
                </div>

                {badge.progress !== undefined && badge.maxProgress && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t('badges.progress', 'Progress')}</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {badge.progress}/{badge.maxProgress}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          badge.earned ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${(badge.progress / badge.maxProgress) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {badge.earned && badge.streak > 0 && (
                  <div className="mt-4 bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-green-600 dark:text-green-400">🔥</span>
                      <span className="text-green-800 dark:text-green-300 font-bold text-sm">
                        {badge.streak} {t('badges.days', 'days')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Achievement Summary */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span className="text-primary-500">📊</span>
            {t('badges.summary', 'Achievement Summary')}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                {badges.filter(b => b.earned).length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{t('badges.earned', 'Earned')}</div>
            </div>
            <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="text-3xl font-bold text-secondary-600 dark:text-secondary-400 mb-1">
                {badges.filter(b => !b.earned).length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{t('badges.remaining', 'Remaining')}</div>
            </div>
            <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                {badges.filter(b => b.earned && b.rarity === 'rare').length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{t('badges.rare', 'Rare')}</div>
            </div>
            <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                {badges.filter(b => b.earned && b.rarity === 'epic').length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{t('badges.epic', 'Epic')}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BadgeDisplay;
