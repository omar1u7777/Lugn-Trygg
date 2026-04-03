/**
 * Gamification Utilities
 */

import { AchievementRarity, RARITY_COLORS } from './types';

/**
 * Level formula (canonical — must match backend rewards_routes.py _calculate_level):
 *   level = floor(sqrt(totalXP / 100)) + 1
 *   xp needed for level N starts at level boundary: (N-1)^2 * 100 to N^2 * 100
 * Examples: 0 XP → L1, 100 XP → L2, 400 XP → L3, 900 XP → L4
 */

/**
 * Calculate level from total XP
 */
export function calculateLevel(totalXP: number): {
  level: number;
  xpInLevel: number;
  xpForNextLevel: number;
  totalXPForLevel: number;
} {
  const safeXP = Math.max(0, totalXP);
  const level = Math.floor(Math.sqrt(safeXP / 100)) + 1;
  const xpForCurrentLevel = ((level - 1) ** 2) * 100;
  const xpForNextLevel = (level ** 2) * 100;
  const xpInLevel = safeXP - xpForCurrentLevel;
  return {
    level,
    xpInLevel,
    xpForNextLevel,
    totalXPForLevel: xpForCurrentLevel,
  };
}

/**
 * Get total XP required to reach a specific level
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return ((level - 1) ** 2) * 100;
}

/**
 * Get total XP required for the NEXT level (upper bound for current level)
 */
export function getXPToNextLevel(currentLevel: number): number {
  return (currentLevel ** 2) * 100;
}

/**
 * Get badge rarity based on difficulty
 */
export function getBadgeRarity(difficulty: number): AchievementRarity {
  if (difficulty >= 90) return 'legendary';
  if (difficulty >= 70) return 'epic';
  if (difficulty >= 40) return 'rare';
  return 'common';
}

/**
 * Get color for rarity
 */
export function getRarityColor(rarity: AchievementRarity): string {
  return RARITY_COLORS[rarity];
}

/**
 * Format XP number with suffix (e.g., 1.2k, 10k)
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}k`;
  }
  return xp.toString();
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

/**
 * Get level badge emoji
 */
export function getLevelBadge(level: number): string {
  if (level >= 50) return '🏅';
  if (level >= 40) return '🥇';
  if (level >= 30) return '🥈';
  if (level >= 20) return '🥉';
  if (level >= 10) return '⭐';
  if (level >= 5) return '✨';
  return '🌟';
}

/**
 * Calculate streak bonus multiplier
 */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.5;
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

/**
 * Check if achievement is close to unlocking
 */
export function isAlmostUnlocked(progress: number, maxProgress: number): boolean {
  const percentage = (progress / maxProgress) * 100;
  return percentage >= 80 && percentage < 100;
}

/**
 * Get celebration animation type based on rarity
 */
export function getCelebrationAnimation(rarity: AchievementRarity): 'confetti' | 'sparkle' | 'glow' | 'bounce' {
  switch (rarity) {
    case 'legendary': return 'confetti';
    case 'epic': return 'sparkle';
    case 'rare': return 'glow';
    default: return 'bounce';
  }
}
