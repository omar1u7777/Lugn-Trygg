/**
 * Mood Feature Module
 * 
 * Centralized exports for all mood-related functionality.
 * This follows feature-based architecture for better code organization.
 */

// Components
// [D6] MoodLogger and WorldClassMoodLogger removed — all mood logging uses SuperMoodLogger
export { SuperMoodLogger } from '../../components/SuperMoodLogger';
export { default as MoodList } from '../../components/MoodList';
export { default as MoodAnalytics } from '../../components/MoodAnalytics';

// Hooks
export { useMoodData } from './hooks/useMoodData';

// Types
export type { MoodEntry, MoodOption, MoodAnalysis } from './types';

// Utils
export { calculateMoodTrend, getMoodColor, getMoodEmoji } from './utils';
