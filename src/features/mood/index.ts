/**
 * Mood Feature Module
 * 
 * Centralized exports for all mood-related functionality.
 * This follows feature-based architecture for better code organization.
 */

// Components
export { default as MoodLogger } from '../../components/MoodLogger';
export { default as WorldClassMoodLogger } from '../../components/WorldClassMoodLogger';
export { default as MoodList } from '../../components/MoodList';
export { default as MoodAnalytics } from '../../components/MoodAnalytics';

// Hooks
export { useMoodData } from './hooks/useMoodData';

// Types
export type { MoodEntry, MoodOption, MoodAnalysis } from './types';

// Utils
export { calculateMoodTrend, getMoodColor, getMoodEmoji } from './utils';
