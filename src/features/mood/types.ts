/**
 * Mood Feature Types
 * 
 * Centralized type definitions for the mood feature.
 */

export interface MoodEntry {
  id: string;
  userId: string;
  score: number;
  mood: string;
  text?: string;
  timestamp: Date;
  analysis?: MoodAnalysis;
  voiceNote?: string;
  tags?: string[];
}

export interface MoodOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
  score: number;
  color: string;
  icon?: React.ReactElement;
}

export interface MoodAnalysis {
  emotion?: string;
  sentiment?: string;
  confidence?: number;
  suggestions?: string[];
}

export interface MoodStats {
  averageScore: number;
  totalEntries: number;
  streak: number;
  trend: 'up' | 'down' | 'stable';
  mostCommonMood: string;
}

export interface MoodTrend {
  date: string;
  score: number;
  mood: string;
}

// Mood color mapping
export const MOOD_COLORS: Record<string, string> = {
  ecstatic: '#FFD700',
  happy: '#4CAF50',
  content: '#8BC34A',
  neutral: '#9E9E9E',
  sad: '#2196F3',
  anxious: '#FF9800',
  stressed: '#F44336',
  angry: '#E91E63',
};

// Mood score ranges
export const MOOD_SCORE_RANGES = {
  excellent: { min: 9, max: 10, label: 'Utmärkt' },
  good: { min: 7, max: 8, label: 'Bra' },
  okay: { min: 5, max: 6, label: 'Okej' },
  low: { min: 3, max: 4, label: 'Lågt' },
  poor: { min: 1, max: 2, label: 'Dåligt' },
} as const;
