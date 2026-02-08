/**
 * Gamification System - Badges, Levels, and Achievements
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TrophyIcon, StarIcon, FireIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { trackEvent } from '../services/analytics';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  category: 'mood' | 'streak' | 'social' | 'milestone';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  goal: number;
  reward: string;
  expiresAt?: string;
}

interface GamificationSystemProps {
  userId: string;
  userLevel: number;
  userXP: number;
  nextLevelXP: number;
  badges: Badge[];
  challenges: Challenge[];
}

const BADGE_DEFINITIONS: Omit<Badge, 'earned' | 'earnedDate'>[] = [
  {
    id: 'first_mood',
    name: 'First Step',
    description: 'Log your first mood',
    icon: '🌱',
    category: 'mood',
    rarity: 'common',
  },
  {
    id: 'week_streak',
    name: 'Week Warrior',
    description: 'Log mood for 7 days in a row',
    icon: '🔥',
    category: 'streak',
    rarity: 'rare',
  },
  {
    id: 'month_streak',
    name: 'Monthly Master',
    description: 'Log mood for 30 days in a row',
    icon: '⭐',
    category: 'streak',
    rarity: 'epic',
  },
  {
    id: 'hundred_moods',
    name: 'Century',
    description: 'Log 100 moods',
    icon: '💯',
    category: 'milestone',
    rarity: 'epic',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log mood before 8 AM five times',
    icon: '🌅',
    category: 'mood',
    rarity: 'rare',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Log mood after 10 PM five times',
    icon: '🦉',
    category: 'mood',
    rarity: 'rare',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Share 3 achievements',
    icon: '🦋',
    category: 'social',
    rarity: 'rare',
  },
  {
    id: 'zen_master',
    name: 'Zen Master',
    description: 'Complete 20 meditation sessions',
    icon: '🧘',
    category: 'milestone',
    rarity: 'epic',
  },
  {
    id: 'legendary_streaker',
    name: 'Legend',
    description: 'Log mood for 100 days in a row',
    icon: '👑',
    category: 'streak',
    rarity: 'legendary',
  },
];

const RARITY_COLORS = {
  common: '#9E9E9E',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FFD700',
};

export const GamificationSystem: React.FC<GamificationSystemProps> = ({
  userId,
  userLevel,
  userXP,
  nextLevelXP,
  badges,
  challenges,
}) => {
  const { t } = useTranslation();
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showBadgeDialog, setShowBadgeDialog] = useState(false);

  const levelProgress = (userXP / nextLevelXP) * 100;

  const handleBadgeClick = (badge: Badge) => {
    setSelectedBadge(badge);
    setShowBadgeDialog(true);
    
    if (badge.earned) {
      trackEvent('badge_viewed', {
        userId,
        badgeId: badge.id,
        badgeName: badge.name,
      });
    }
  };

  const getLevelTitle = (level: number): string => {
    if (level < 5) return 'Beginner';
    if (level < 10) return 'Explorer';
    if (level < 20) return 'Achiever';
    if (level < 30) return 'Expert';
    if (level < 50) return 'Master';
    return 'Legend';
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Level and XP Progress */}
      <div className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {userLevel}
            </div>
            <div>
              <h3 className="text-2xl font-bold">
                Level {userLevel}
              </h3>
              <p className="text-white/80 text-sm">
                {getLevelTitle(userLevel)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">
              {userXP} / {nextLevelXP} XP
            </p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <StarIcon className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">{Math.round(levelProgress)}%</span>
            </div>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${levelProgress}%` }}
            role="progressbar"
            aria-valuenow={levelProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Weekly Challenges */}
      {challenges && challenges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FireIcon className="w-6 h-6 text-error-500" aria-hidden="true" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('gamification.challenges', 'Weekly Challenges')}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {challenge.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {challenge.description}
                </p>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>{challenge.progress} / {challenge.goal}</span>
                    <span>{Math.round((challenge.progress / challenge.goal) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(challenge.progress / challenge.goal) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={(challenge.progress / challenge.goal) * 100}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
                <span className="inline-block px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full border border-primary-200 dark:border-primary-800">
                  Reward: {challenge.reward}
                </span>
                {challenge.expiresAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Expires: {new Date(challenge.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrophyIcon className="w-6 h-6 text-warning-500" aria-hidden="true" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('gamification.badges', 'Badges & Achievements')}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {BADGE_DEFINITIONS.map((badgeDef) => {
            const earnedBadge = badges.find((b) => b.id === badgeDef.id);
            const badge: Badge = earnedBadge || { ...badgeDef, earned: false };

            return (
              <motion.div
                key={badge.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <button
                  onClick={() => handleBadgeClick(badge)}
                  className="w-full bg-white dark:bg-gray-800 rounded-lg border-2 p-4 text-center transition-all duration-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  style={{
                    borderColor: RARITY_COLORS[badge.rarity],
                    opacity: badge.earned ? 1 : 0.4,
                  }}
                  aria-label={`${badge.name} - ${badge.earned ? 'Earned' : 'Locked'} - ${badge.description}`}
                  title={badge.earned ? badge.description : `🔒 ${badge.description}`}
                >
                  <div className="text-4xl mb-2">
                    {badge.earned ? badge.icon : '🔒'}
                  </div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white mb-1 truncate">
                    {badge.name}
                  </p>
                  <span
                    className="inline-block px-2 py-0.5 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: RARITY_COLORS[badge.rarity] }}
                  >
                    {badge.rarity}
                  </span>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Badge Detail Dialog */}
      {showBadgeDialog && selectedBadge && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBadgeDialog(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{selectedBadge.icon}</div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedBadge.name}
                  </h3>
                  <span
                    className="inline-block px-3 py-1 text-xs font-medium rounded-full text-white mt-1"
                    style={{ backgroundColor: RARITY_COLORS[selectedBadge.rarity] }}
                  >
                    {selectedBadge.rarity}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowBadgeDialog(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Close dialog"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
              {selectedBadge.description}
            </p>
            {selectedBadge.earned && selectedBadge.earnedDate && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Earned on: {new Date(selectedBadge.earnedDate).toLocaleDateString()}
              </p>
            )}
            {!selectedBadge.earned && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  🔒 Keep working to unlock this badge!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationSystem;


