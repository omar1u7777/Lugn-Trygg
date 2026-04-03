import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getMoods, getUserRewards, getAchievements, type Achievement, type UserReward } from '../api/api';
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

type TimestampLike = Date | string | number | { toDate?: () => Date } | null | undefined;

interface MoodEntry {
  timestamp: TimestampLike;
}

type AuthUserLike = {
  user_id?: string;
  uid?: string;
  id?: string;
};

const toDate = (timestamp: TimestampLike): Date => {
  if (
    timestamp &&
    typeof timestamp === 'object' &&
    'toDate' in timestamp &&
    typeof timestamp.toDate === 'function'
  ) {
    return timestamp.toDate();
  }

  return new Date(timestamp ?? Date.now());
};

const BadgeDisplay: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const authUser = (user ?? {}) as AuthUserLike;
  const userId = authUser.user_id || authUser.uid || authUser.id || '';
  const [badges, setBadges] = useState<Badge[]>([]);
  const [rewardProfile, setRewardProfile] = useState<UserReward | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateCurrentStreak = useCallback((moods: MoodEntry[]): number => {
    if (moods.length === 0) return 0;

    const sortedMoods = [...moods].sort((a, b) => {
      const dateA = toDate(a.timestamp);
      const dateB = toDate(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedMoods.length; i++) {
      const moodDate = toDate(sortedMoods[i].timestamp);
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
  }, []);

  const calculateLongestStreak = useCallback((moods: MoodEntry[]): number => {
    if (moods.length === 0) return 0;

    const sortedMoods = [...moods].sort((a, b) => {
      const dateA = toDate(a.timestamp);
      const dateB = toDate(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });

    let longestStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < sortedMoods.length; i++) {
      const prevDate = toDate(sortedMoods[i - 1].timestamp);
      const currDate = toDate(sortedMoods[i].timestamp);

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
  }, []);

  useEffect(() => {
    const calculateBadges = async () => {
      if (!userId) {
        setBadges([]);
        setRewardProfile(null);
        setLoading(false);
        return;
      }

      try {
        const [moods, rewards, achievements] = await Promise.all([
          getMoods(userId),
          getUserRewards(),
          getAchievements(),
        ]);
        setRewardProfile(rewards);
        const currentStreak = calculateCurrentStreak(moods);
        const longestStreak = calculateLongestStreak(moods);
        const totalEntries = moods.length;
        const earnedAchievementIds = new Set(rewards.achievements || []);

        const progressByType: Record<string, number> = {
          mood_count: totalEntries,
          streak: currentStreak,
          journal_count: 0,
          referral_count: 0,
          meditation_count: 0,
        };

        const achievementBadges: Badge[] = (achievements as Achievement[]).map((achievement) => {
          const conditionType = achievement.condition?.type || 'mood_count';
          const conditionValue = achievement.condition?.value || 1;
          const currentValue = progressByType[conditionType] || 0;
          const achieved = earnedAchievementIds.has(achievement.id) || currentValue >= conditionValue;

          return {
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon: achieved ? '🏆' : '🔒',
            earned: achieved,
            streak: currentValue,
            category: conditionType,
            rarity: conditionValue >= 30 ? 'epic' : conditionValue >= 7 ? 'rare' : 'common',
            progress: Math.min(currentValue, conditionValue),
            maxProgress: conditionValue,
          };
        });

        const badgeList: Badge[] = [
          ...achievementBadges,
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
        ];

        setBadges(badgeList);
      } catch (error) {
        logger.error('Failed to calculate badges:', error);
        setBadges([]);
      } finally {
        setLoading(false);
      }
    };

    calculateBadges();
  }, [calculateCurrentStreak, calculateLongestStreak, userId, t]);

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
      case 'streak': return '🔥';
      case 'mood_count': return '📈';
      case 'journal_count': return '📝';
      case 'referral_count': return '🤝';
      case 'meditation_count': return '🧘';
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

        {rewardProfile && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                {t('rewards.level', 'Level')}
              </p>
              <p className="mt-1 text-2xl font-bold text-primary-900 dark:text-primary-100">{rewardProfile.level}</p>
            </div>
            <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary-700 dark:text-secondary-300">XP</p>
              <p className="mt-1 text-2xl font-bold text-secondary-900 dark:text-secondary-100">{rewardProfile.xp}</p>
            </div>
            <div className="rounded-xl border border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-300">
                {t('rewards.nextLevel', 'Next Level')}
              </p>
              <p className="mt-1 text-base font-semibold text-accent-900 dark:text-accent-100">
                {rewardProfile.progressXp}/{rewardProfile.neededXp} XP
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-accent-100 dark:bg-accent-900/40">
                <div
                  className="h-2 rounded-full bg-accent-500 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(rewardProfile.progressPercent, 100))}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

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
