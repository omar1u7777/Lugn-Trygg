/**
 * Gamification Utilities
 */

import { AchievementRarity, RARITY_COLORS } from './types';

// XP required for each level (exponential growth)
const XP_BASE = 100;
const XP_MULTIPLIER = 1.5;

/**
 * Calculate level from total XP
 */
export function calculateLevel(totalXP: number): { 
  level: number; 
  xpInLevel: number; 
  xpForNextLevel: number;
  totalXPForLevel: number;
} {
  let level = 1;
  let xpRemaining = totalXP;
  let xpForCurrentLevel = XP_BASE;
  
  while (xpRemaining >= xpForCurrentLevel) {
    xpRemaining -= xpForCurrentLevel;
    level++;
    xpForCurrentLevel = Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1));
  }
  
  return {
    level,
    xpInLevel: xpRemaining,
    xpForNextLevel: xpForCurrentLevel,
    totalXPForLevel: Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1)),
  };
}

/**
 * Get total XP required for a specific level
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, i - 1));
  }
  return totalXP;
}

/**
 * Get XP required for next level
 */
export function getXPToNextLevel(currentLevel: number): number {
  return Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, currentLevel - 1));
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
