// Export all extracted exercise components
export { BreathingExercise } from './BreathingExercise';
export { KBTExercise } from './KBTExercise';
export { PMRExercise } from './PMRExercise';
export { MeditationSession } from './MeditationSession';
export { JournalingPrompt } from './JournalingPrompt';

// Export types
export type {
  PomodoroSession,
  NotificationSettings,
  MeditationSessionData,
  JournalEntry,
  GratitudeEntry,
  ArticleReadingSession,
  RecommendationsProps,
  OnCompleteCallback,
  OnSaveSessionCallback,
  OnUpdateProgressCallback,
  Recommendation,
} from './types';

// Export constants
export {
  BREATHING_DEFAULTS,
  PMR_DEFAULT_TIMING,
  PMR_DIFFICULTY_LEVELS,
  MEDITATION_DEFAULT_DURATION,
  JOURNALING_DEFAULT_TAGS,
  GRATITUDE_CHALLENGE_DAYS,
  POMODORO_DEFAULTS,
  NOTIFICATION_DEFAULT_TIME,
} from './constants';
