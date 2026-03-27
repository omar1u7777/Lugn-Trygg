import { describe, it, expect } from 'vitest';
import { applySessionCompletionStats, calculateWellnessStreak } from '../WellnessHub';

describe('WellnessHub logic', () => {
  it('calculates active streak from today backwards', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const records = [
      { created_at: now.toISOString() },
      { createdAt: yesterday.toISOString() },
      { timestamp: twoDaysAgo.toISOString() },
    ];

    expect(calculateWellnessStreak(records)).toBe(3);
  });

  it('returns zero streak when last activity is older than yesterday', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const records = [{ created_at: threeDaysAgo.toISOString() }];

    expect(calculateWellnessStreak(records)).toBe(0);
  });

  it('updates breathing stats without increasing relaxation sessions', () => {
    const prev = {
      meditationMinutes: 10,
      breathingExercises: 2,
      relaxationSessions: 4,
      streakDays: 1,
    };

    const next = applySessionCompletionStats(prev, 'breathing_exercise', 4);

    expect(next.meditationMinutes).toBe(14);
    expect(next.breathingExercises).toBe(3);
    expect(next.relaxationSessions).toBe(4);
    expect(next.streakDays).toBe(1);
  });

  it('uses minimum 1 minute and increments relaxation for guided meditation', () => {
    const prev = {
      meditationMinutes: 0,
      breathingExercises: 0,
      relaxationSessions: 0,
      streakDays: 0,
    };

    const next = applySessionCompletionStats(prev, 'guided_meditation', 0);

    expect(next.meditationMinutes).toBe(1);
    expect(next.breathingExercises).toBe(0);
    expect(next.relaxationSessions).toBe(1);
  });
});
