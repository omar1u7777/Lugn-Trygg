/**
 * Leaderboard Component
 * Real community rankings using Firebase data
 */

import React, { useEffect, useState } from 'react'
import { Card } from './ui/tailwind';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  getXPLeaderboard,
  getStreakLeaderboard,
  getMoodLeaderboard,
  getUserRanking,
  type XPLeaderboardUser,
  type StreakLeaderboardUser,
  type MoodLeaderboardUser,
  type LeaderboardUser,
} from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowTrendingUpIcon, FireIcon, TrophyIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

type LeaderboardEntry = XPLeaderboardUser | StreakLeaderboardUser | MoodLeaderboardUser;

export const Leaderboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isSwedish = i18n.language?.startsWith('sv');

  const [activeTab, setActiveTab] = useState(0); // 0=XP, 1=Streak, 2=Moods
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRanking, setUserRanking] = useState<{
    xp: { rank: number; value: number; percentile: number };
    streak: { rank: number; value: number; percentile: number };
    moods: { rank: number; value: number; percentile: number };
    total_users: number;
  } | null>(null);

  const userId = (user as any)?.user_id || (user as any)?.uid || (user as any)?.id || '';

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab]);

  useEffect(() => {
    if (userId) {
      fetchUserRanking();
    }
  }, [userId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let data: LeaderboardEntry[] = [];

      switch (activeTab) {
        case 0: // XP
          data = await getXPLeaderboard(20);
          break;
        case 1: // Streak
          data = await getStreakLeaderboard(20);
          break;
        case 2: // Moods
          data = await getMoodLeaderboard(20);
          break;
      }

      setLeaderboard(data);
    } catch (error) {
      logger.error('Failed to fetch leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRanking = async () => {
    try {
      const ranking = await getUserRanking(userId);
      if (ranking) {
        setUserRanking(ranking);
      }
    } catch (error) {
      logger.error('Failed to fetch user ranking:', error);
    }
  };

  const getRankColor = (rank: number): string => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#6B7280';
  };

  const getRankIcon = (rank: number): string => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getScoreLabel = (): string => {
    switch (activeTab) {
      case 0: return 'XP';
      case 1: return isSwedish ? 'dagar' : 'days';
      case 2: return isSwedish ? 'loggningar' : 'logs';
      default: return 'pts';
    }
  };

  const getScoreValue = (entry: LeaderboardEntry): number => {
    switch (activeTab) {
      case 0: return (entry as XPLeaderboardUser).xp || 0;
      case 1: return (entry as StreakLeaderboardUser).current_streak || 0;
      case 2: return (entry as MoodLeaderboardUser).mood_count || 0;
      default: return 0;
    }
  };

  const getCurrentUserRank = () => {
    if (!userRanking) return null;
    switch (activeTab) {
      case 0: return userRanking.xp;
      case 1: return userRanking.streak;
      case 2: return userRanking.moods;
      default: return null;
    }
  };

  const currentRank = getCurrentUserRank();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <TrophyIcon className="w-6 h-6 sm:w-7 sm:h-7 text-warning-600" aria-hidden="true" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {t('leaderboard.title', 'Community Leaderboard')}
              </h2>
            </div>
            <button
              onClick={fetchLeaderboard}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-primary-100 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 hover:bg-primary-200 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isSwedish ? 'Uppdatera' : 'Refresh'}
            </button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700" role="tablist">
        {[
          { label: isSwedish ? '⭐ XP' : '⭐ XP', index: 0 },
          { label: isSwedish ? '🔥 Streak' : '🔥 Streak', index: 1 },
          { label: isSwedish ? '📊 Loggningar' : '📊 Mood Logs', index: 2 },
        ].map((tab) => (
          <button
            key={tab.index}
            onClick={() => setActiveTab(tab.index)}
            role="tab"
            aria-selected={activeTab === tab.index}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${activeTab === tab.index
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* User's Current Position */}
      {currentRank && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/10">
            <div className="p-4 sm:p-6">
              <p className="text-xs sm:text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3">
                {t('leaderboard.yourRank', 'Your Position')}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold"
                    style={{ backgroundColor: getRankColor(currentRank.rank) }}
                  >
                    {getRankIcon(currentRank.rank)}
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                      {isSwedish ? 'Du' : 'You'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" aria-hidden="true" />
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {isSwedish ? `Topp ${Math.round(100 - currentRank.percentile)}%` : `Top ${Math.round(100 - currentRank.percentile)}%`}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {currentRank.value} {getScoreLabel()}
                </p>
              </div>
              {currentRank.rank > 10 && userRanking && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {isSwedish
                      ? `Fortsätt! Du är ${currentRank.rank - 10} platser från topp 10`
                      : `Keep going! You're ${currentRank.rank - 10} spots away from the top 10`
                    }
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(((userRanking.total_users - currentRank.rank) / userRanking.total_users) * 100, 100)}%` }}
                      role="progressbar"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Leaderboard List */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 sm:gap-4 p-4 animate-pulse">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16" />
              </div>
            ))
          ) : leaderboard.length === 0 ? (
            // Empty state
            <div className="p-8 text-center">
              <TrophyIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                {isSwedish ? 'Ingen data ännu' : 'No leaderboard data yet'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {isSwedish
                  ? 'Börja logga humör för att synas på topplistan!'
                  : 'Start logging moods to appear on the leaderboard!'
                }
              </p>
            </div>
          ) : (
            leaderboard.map((entry, index) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  {/* Rank Badge */}
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-base sm:text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: getRankColor(entry.rank) }}
                  >
                    {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-lg">
                    {entry.avatar || '🌟'}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm sm:text-base truncate ${entry.rank <= 3 ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-white`}>
                        {entry.display_name}
                      </p>
                      {activeTab === 0 && entry.level && entry.level > 1 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200">
                          Lv.{entry.level}
                        </span>
                      )}
                      {activeTab === 1 && entry.current_streak && entry.current_streak > 7 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200">
                          <FireIcon className="w-3 h-3" aria-hidden="true" />
                          {entry.current_streak}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {entry.rank <= 3 ? getRankIcon(entry.rank) : `#${entry.rank}`}
                      {activeTab === 0 && entry.badge_count ? ` • ${entry.badge_count} badges` : ''}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <p className="text-lg sm:text-xl font-bold text-primary-600 dark:text-primary-400">
                      {getScoreValue(entry)}
                    </p>
                    <p className="text-xs text-gray-500">{getScoreLabel()}</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Card>

      {/* Tip */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span role="img" aria-label="lightbulb">💡</span> <strong>{isSwedish ? 'Tips:' : 'Tip:'}</strong>{' '}
          {isSwedish
            ? 'Tjäna poäng genom att logga humör dagligen, slutföra utmaningar och hålla streaks!'
            : 'Earn points by logging moods daily, completing challenges, and maintaining streaks!'
          }
        </p>
      </div>
    </div>
  );
};

export default Leaderboard;

