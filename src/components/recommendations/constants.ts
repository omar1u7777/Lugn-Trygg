// Breathing Exercise Defaults
export const BREATHING_DEFAULTS = {
  inhaleSeconds: 4,
  holdSeconds: 4,
  exhaleSeconds: 4,
  cycles: 5,
} as const;

// PMR (Progressive Muscle Relaxation) Default Timing
export const PMR_DEFAULT_TIMING = {
  tense: 5,
  relax: 10,
} as const;

// PMR Difficulty Levels
export const PMR_DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

// Meditation Default Duration (in minutes)
export const MEDITATION_DEFAULT_DURATION = 10;

// Journaling Default Tags
export const JOURNALING_DEFAULT_TAGS = [
  'stress',
  'ångest',
  'glädje',
  'oro',
  'tacksamhet',
  'reflektion',
  'mål',
  'relationer',
] as const;

// Gratitude Challenge Duration (in days)
export const GRATITUDE_CHALLENGE_DAYS = 7;

// Pomodoro Default Durations (in minutes)
export const POMODORO_DEFAULTS = {
  workDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  sessionsBeforeLongBreak: 4,
} as const;

// Notification Default Time
export const NOTIFICATION_DEFAULT_TIME = '09:00';
