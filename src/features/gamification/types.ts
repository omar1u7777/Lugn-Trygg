/**
 * Gamification Types
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: AchievementRarity;
  category: AchievementCategory;
  unlockedAt?: Date;
  xpReward: number;
}

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AchievementCategory = 'mood' | 'streak' | 'social' | 'growth' | 'milestone';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: Date;
  category: AchievementCategory;
  rarity: AchievementRarity;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  goal: number;
  reward: string;
  xpReward: number;
  type: 'daily' | 'weekly' | 'special';
  expiresAt?: Date;
  completed: boolean;
}

export interface UserLevel {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  title: string;
  badge?: string;
}

export interface GamificationStats {
  level: number;
  xp: number;
  xpToNext: number;
  streakDays: number;
  achievementsUnlocked: number;
  totalAchievements: number;
  badgesEarned: number;
  challengesCompleted: number;
}

// Level titles
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Nybörjare',
  5: 'Upptäckare',
  10: 'Vandrare',
  15: 'Utforskare',
  20: 'Mästare',
  25: 'Expert',
  30: 'Legend',
  40: 'Guru',
  50: 'Upplyst',
};

// Rarity colors
export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

// XP rewards for actions
export const XP_REWARDS = {
  logMood: 10,
  writeDiary: 15,
  completeChallenge: 50,
  achievementUnlock: 25,
  dailyLogin: 5,
  weekStreak: 100,
  monthStreak: 500,
  shareAchievement: 10,
  helpOther: 20,
} as const;
