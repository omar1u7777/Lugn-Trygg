import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getMoods } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  streak: number;
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
          },
          {
            id: 'week-streak',
            title: t('badges.weekStreak.title', 'Week Warrior'),
            description: t('badges.weekStreak.desc', '7 days in a row'),
            icon: '🔥',
            earned: currentStreak >= 7,
            streak: currentStreak,
          },
          {
            id: 'month-streak',
            title: t('badges.monthStreak.title', 'Monthly Master'),
            description: t('badges.monthStreak.desc', '30 days in a row'),
            icon: '👑',
            earned: currentStreak >= 30,
            streak: currentStreak,
          },
          {
            id: 'consistency',
            title: t('badges.consistency.title', 'Consistency King'),
            description: t('badges.consistency.desc', 'Longest streak: {days} days'),
            icon: '⭐',
            earned: longestStreak >= 14,
            streak: longestStreak,
          },
          {
            id: 'explorer',
            title: t('badges.explorer.title', 'Mood Explorer'),
            description: t('badges.explorer.desc', 'Logged {count} moods'),
            icon: '🗺️',
            earned: totalEntries >= 50,
            streak: totalEntries,
          },
        ];

        setBadges(badgeList);
      } catch (error) {
        console.error('Failed to calculate badges:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateBadges();
  }, [user?.user_id, t]);

  const calculateCurrentStreak = (moods: any[]): number => {
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

  const calculateLongestStreak = (moods: any[]): number => {
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
      <div className="badge-display">
        <h3>{t('dashboard.badges', 'Achievements')}</h3>
        <div className="badge-loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <motion.div
      className="badge-display"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3>{t('dashboard.badges', 'Achievements')}</h3>
      <div className="badges-grid">
        {badges.map((badge, index) => (
          <motion.div
            key={badge.id}
            className={`badge ${badge.earned ? 'earned' : 'locked'}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
          >
            <div className="badge-icon">{badge.icon}</div>
            <div className="badge-content">
              <h4>{badge.title}</h4>
              <p>
                {badge.description.replace('{days}', badge.streak.toString()).replace('{count}', badge.streak.toString())}
              </p>
              {badge.earned && badge.streak > 0 && (
                <div className="badge-streak">
                  {badge.streak} {t('badges.days', 'days')}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default BadgeDisplay;