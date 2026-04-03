/**
 * Gamification Feature Module
 *
 * Centralized exports for gamification, achievements, and rewards.
 */

// Primary components
export { default as Gamification } from '../../components/WorldClassGamification';
export { default as BadgeDisplay } from '../../components/BadgeDisplay';
export { default as Leaderboard } from '../../components/Leaderboard';
export { default as GroupChallenges } from '../../components/GroupChallenges';

// Types
export type { Achievement, Badge, Challenge, UserLevel } from './types';

// Utils
export { calculateLevel, getXPForLevel, getBadgeRarity } from './utils';
