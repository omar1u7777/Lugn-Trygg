/**
 * WellnessHub utility function tests + component smoke tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | object) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { user_id: 'user-1', email: 'test@test.com' },
    isLoggedIn: true,
  }),
}));

vi.mock('../../api/api', () => ({
  getMoods: vi.fn().mockResolvedValue([]),
  saveMeditationSession: vi.fn().mockResolvedValue({}),
  getMeditationSessions: vi.fn().mockResolvedValue([]),
  getWellnessGoals: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../constants/wellnessGoals', () => ({
  getWellnessGoalIcon: vi.fn(() => '🎯'),
}));

vi.mock('../ui/OptimizedImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('../../config/env', () => ({
  getWellnessHeroImageId: () => 'test-hero-id',
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../RelaxingSounds', () => ({
  default: () => <div data-testid="relaxing-sounds">RelaxingSounds</div>,
}));

vi.mock('../Wellness/WellnessGoalsOnboarding', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="wellness-onboarding">
      <button onClick={onComplete}>Complete Onboarding</button>
    </div>
  ),
}));

import { calculateWellnessStreak, applySessionCompletionStats } from '../WellnessHub';

describe('calculateWellnessStreak', () => {
  it('returns 0 for empty records', () => {
    expect(calculateWellnessStreak([])).toBe(0);
  });

  it('returns 0 for records with no parseable dates', () => {
    expect(calculateWellnessStreak([{}, { noDate: 'yes' }])).toBe(0);
  });

  it('returns 1 for a single record today', () => {
    const today = new Date().toISOString();
    expect(calculateWellnessStreak([{ created_at: today }])).toBe(1);
  });

  it('returns streak for consecutive days using created_at', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const records = [
      { created_at: today.toISOString() },
      { created_at: yesterday.toISOString() },
    ];
    expect(calculateWellnessStreak(records)).toBe(2);
  });

  it('handles record with createdAt field', () => {
    const today = new Date().toISOString();
    expect(calculateWellnessStreak([{ createdAt: today }])).toBe(1);
  });

  it('handles record with date field', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(calculateWellnessStreak([{ date: today }])).toBe(1);
  });

  it('handles record with timestamp field', () => {
    const today = new Date().toISOString();
    expect(calculateWellnessStreak([{ timestamp: today }])).toBe(1);
  });

  it('handles invalid date strings gracefully', () => {
    expect(calculateWellnessStreak([{ created_at: 'not-a-date' }])).toBe(0);
  });

  it('returns 0 when most recent record is more than 1 day ago', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 3);
    const records = [{ created_at: oldDate.toISOString() }];
    expect(calculateWellnessStreak(records)).toBe(0);
  });

  it('returns streak for yesterday records only', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(calculateWellnessStreak([{ created_at: yesterday.toISOString() }])).toBe(1);
  });

  it('deduplicates same-day records', () => {
    const today = new Date().toISOString();
    // Multiple records on same day should count as 1 day
    const records = [
      { created_at: today },
      { created_at: today },
      { created_at: today },
    ];
    expect(calculateWellnessStreak(records)).toBe(1);
  });
});

describe('applySessionCompletionStats', () => {
  const baseStats = {
    meditationMinutes: 10,
    breathingExercises: 2,
    relaxationSessions: 3,
    streakDays: 5,
  };

  it('adds meditation minutes for guided_meditation session', () => {
    const result = applySessionCompletionStats(baseStats, 'guided_meditation', 15);
    expect(result.meditationMinutes).toBe(25);
    expect(result.breathingExercises).toBe(2); // unchanged
    expect(result.relaxationSessions).toBe(4); // incremented
    expect(result.streakDays).toBe(5); // unchanged
  });

  it('increments breathingExercises for breathing_exercise type', () => {
    const result = applySessionCompletionStats(baseStats, 'breathing_exercise', 5);
    expect(result.breathingExercises).toBe(3);
    expect(result.relaxationSessions).toBe(3); // NOT incremented for breathing
    expect(result.meditationMinutes).toBe(15);
  });

  it('increments relaxationSessions for soundscape type', () => {
    const result = applySessionCompletionStats(baseStats, 'soundscape', 20);
    expect(result.relaxationSessions).toBe(4);
    expect(result.breathingExercises).toBe(2); // unchanged
  });

  it('rounds fractional duration to nearest minute', () => {
    const result = applySessionCompletionStats(baseStats, 'guided_meditation', 7.8);
    expect(result.meditationMinutes).toBe(18); // 10 + round(7.8) = 10 + 8 = 18
  });

  it('enforces minimum 1 minute duration', () => {
    const result = applySessionCompletionStats(baseStats, 'guided_meditation', 0);
    expect(result.meditationMinutes).toBe(11); // min 1 minute
  });

  it('handles negative duration as 1 minute', () => {
    const result = applySessionCompletionStats(baseStats, 'guided_meditation', -5);
    expect(result.meditationMinutes).toBe(11); // min 1 minute
  });

  it('preserves streakDays', () => {
    const result = applySessionCompletionStats(baseStats, 'guided_meditation', 10);
    expect(result.streakDays).toBe(5);
  });
});
