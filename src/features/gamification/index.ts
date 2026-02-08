/**
 * Gamification Feature Module
 * 
 * Centralized exports for gamification, achievements, and rewards.
 * Note: Consolidates Gamification.tsx, GamificationSystem.tsx, and WorldClassGamification.tsx
 */

// Primary component (WorldClassGamification is the most complete)
export { default as Gamification } from '../../components/WorldClassGamification';
export { default as GamificationSystem } from '../../components/GamificationSystem';
export { default as BadgeDisplay } from '../../components/BadgeDisplay';
export { default as Leaderboard } from '../../components/Leaderboard';
export { default as AchievementSharing } from '../../components/AchievementSharing';
export { default as GroupChallenges } from '../../components/GroupChallenges';

// Hooks
export { useGamification } from './hooks/useGamification';

// Types
export type { Achievement, Badge, Challenge, UserLevel } from './types';

// Utils
export { calculateLevel, getXPForLevel, getBadgeRarity } from './utils';
