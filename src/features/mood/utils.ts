/**
 * Mood Feature Utilities
 * 
 * Helper functions for mood-related calculations and transformations.
 */

import { MoodEntry, MoodTrend, MOOD_COLORS, MOOD_SCORE_RANGES } from './types';

/**
 * Calculate mood trend over time
 */
export function calculateMoodTrend(moods: MoodEntry[]): 'up' | 'down' | 'stable' {
  if (moods.length < 3) return 'stable';
  
  // Sort by timestamp descending
  const sorted = [...moods].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  const recent = sorted.slice(0, Math.min(5, Math.floor(sorted.length / 2)));
  const older = sorted.slice(Math.min(5, Math.floor(sorted.length / 2)));
  
  if (older.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, m) => sum + m.score, 0) / recent.length;
  const olderAvg = older.reduce((sum, m) => sum + m.score, 0) / older.length;
  
  const diff = recentAvg - olderAvg;
  
  if (diff > 0.5) return 'up';
  if (diff < -0.5) return 'down';
  return 'stable';
}

/**
 * Get color for a mood score
 */
export function getMoodColor(score: number): string {
  if (score >= 9) return MOOD_COLORS.ecstatic;
  if (score >= 7) return MOOD_COLORS.happy;
  if (score >= 5) return MOOD_COLORS.content;
  if (score >= 3) return MOOD_COLORS.sad;
  return MOOD_COLORS.stressed;
}

/**
 * Get emoji for a mood score
 */
export function getMoodEmoji(score: number): string {
  if (score >= 9) return '🤩';
  if (score >= 8) return '😊';
  if (score >= 7) return '🙂';
  if (score >= 6) return '😐';
  if (score >= 5) return '😕';
  if (score >= 4) return '😢';
  if (score >= 3) return '😰';
  if (score >= 2) return '😔';
  return '😞';
}

/**
 * Get mood label in Swedish
 */
export function getMoodLabel(score: number): string {
  if (score >= 9) return 'Extatisk';
  if (score >= 8) return 'Glad';
  if (score >= 7) return 'Nöjd';
  if (score >= 6) return 'Okej';
  if (score >= 5) return 'Neutral';
  if (score >= 4) return 'Ledsen';
  if (score >= 3) return 'Orolig';
  if (score >= 2) return 'Stressad';
  return 'Mycket låg';
}

/**
 * Get score range label
 */
export function getScoreRangeLabel(score: number): string {
  for (const [, range] of Object.entries(MOOD_SCORE_RANGES)) {
    if (score >= range.min && score <= range.max) {
      return range.label;
    }
  }
  return 'Okänd';
}

/**
 * Calculate streak from mood entries
 */
export function calculateStreak(moods: MoodEntry[]): number {
  if (moods.length === 0) return 0;
  
  // Sort by timestamp descending
  const sorted = [...moods].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const mood of sorted) {
    const moodDate = new Date(mood.timestamp);
    moodDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate.getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streak || (streak === 0 && daysDiff <= 1)) {
      streak++;
      currentDate = new Date(moodDate);
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Group moods by date for charting
 */
export function groupMoodsByDate(moods: MoodEntry[]): MoodTrend[] {
  const grouped = new Map<string, { scores: number[]; mood: string }>();
  
  for (const mood of moods) {
    const dateKey = mood.timestamp.toISOString().split('T')[0];
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, { scores: [], mood: mood.mood });
    }
    
    grouped.get(dateKey)!.scores.push(mood.score);
  }
  
  return Array.from(grouped.entries())
    .map(([date, data]) => ({
      date,
      score: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      mood: data.mood,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate weekly average scores
 */
export function getWeeklyAverages(moods: MoodEntry[], weeks: number = 4): { week: string; average: number }[] {
  const now = new Date();
  const result: { week: string; average: number }[] = [];
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    
    const weekMoods = moods.filter(m => 
      m.timestamp >= weekStart && m.timestamp < weekEnd
    );
    
    const average = weekMoods.length > 0
      ? weekMoods.reduce((sum, m) => sum + m.score, 0) / weekMoods.length
      : 0;
    
    result.unshift({
      week: `V${getWeekNumber(weekStart)}`,
      average: Math.round(average * 10) / 10,
    });
  }
  
  return result;
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format mood for display
 */
export function formatMoodForDisplay(mood: MoodEntry): {
  emoji: string;
  label: string;
  color: string;
  time: string;
} {
  return {
    emoji: getMoodEmoji(mood.score),
    label: getMoodLabel(mood.score),
    color: getMoodColor(mood.score),
    time: formatRelativeTime(mood.timestamp),
  };
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just nu';
  if (diffMins < 60) return `${diffMins} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  
  return date.toLocaleDateString('sv-SE');
}
