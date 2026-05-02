import { Recommendation } from '../../types/recommendation';

// Pomodoro Session Type
export interface PomodoroSession {
  date: string;
  sessionNumber: number;
  type: 'work' | 'break';
  workDuration?: number;
  breakDuration?: number;
}

// Notification Settings Type
export interface NotificationSettings {
  dailyRemindersEnabled: boolean;
  reminderTime: string;
  fcmToken: boolean;
}

// Meditation Session Data Type
export interface MeditationSessionData {
  type: string;
  duration: number;
  technique: string;
  completedCycles: number;
  notes: string;
}

// Journal Entry Type
export interface JournalEntry {
  id: string;
  content: string;
  mood?: number;
  tags?: string[];
  createdAt: string;
}

// Gratitude Entry Type
export interface GratitudeEntry {
  id: string;
  content: string;
  timestamp: Date;
}

// Article Reading Session Type
export interface ArticleReadingSession {
  articleId: string;
  articleTitle: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  sectionsRead: number;
  totalSections: number;
  completed: boolean;
}

// Recommendation Props Type
export interface RecommendationsProps {
  userId: string;
  wellnessGoals?: string[];
  compact?: boolean;
}

// Callback Types
export type OnCompleteCallback = () => void;
export type OnSaveSessionCallback = (sessionData: MeditationSessionData) => void | Promise<void>;
export type OnUpdateProgressCallback = (type: string, duration: number) => void;

// Re-export Recommendation type for convenience
export type { Recommendation };
