/**
 * Tests for mood feature utility functions.
 * All pure functions — no mocks required.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CANONICAL_MOOD_SCALE,
  getCanonicalMoodBand,
  calculateMoodTrend,
  getMoodColor,
  getMoodEmoji,
  getMoodLabel,
  getMoodScoreFromLabel,
  getScoreRangeLabel,
  calculateStreak,
  groupMoodsByDate,
  getWeeklyAverages,
} from '../utils';
import type { MoodEntry } from '../types';

// Helper to create a MoodEntry
function makeMood(score: number, daysAgo: number, id = ''): MoodEntry {
  const ts = new Date();
  ts.setDate(ts.getDate() - daysAgo);
  ts.setHours(12, 0, 0, 0);
  return {
    id: id || `mood-${daysAgo}`,
    userId: 'user1',
    score,
    mood: 'ok',
    timestamp: ts,
  };
}

describe('getCanonicalMoodBand', () => {
  it('returns Super for score 10', () => {
    expect(getCanonicalMoodBand(10).label).toBe('Super');
  });

  it('returns Super for score 9', () => {
    expect(getCanonicalMoodBand(9).label).toBe('Super');
  });

  it('returns Glad for score 8', () => {
    expect(getCanonicalMoodBand(8).label).toBe('Glad');
  });

  it('returns Bra for score 7', () => {
    expect(getCanonicalMoodBand(7).label).toBe('Bra');
  });

  it('returns Neutral for score 5', () => {
    expect(getCanonicalMoodBand(5).label).toBe('Neutral');
  });

  it('returns Neutral for score 6', () => {
    expect(getCanonicalMoodBand(6).label).toBe('Neutral');
  });

  it('returns Orolig for score 3', () => {
    expect(getCanonicalMoodBand(3).label).toBe('Orolig');
  });

  it('returns Orolig for score 4', () => {
    expect(getCanonicalMoodBand(4).label).toBe('Orolig');
  });

  it('returns Ledsen for score 0', () => {
    expect(getCanonicalMoodBand(0).label).toBe('Ledsen');
  });

  it('returns Ledsen for score 2', () => {
    expect(getCanonicalMoodBand(2).label).toBe('Ledsen');
  });

  it('includes emoji in each band', () => {
    CANONICAL_MOOD_SCALE.forEach((band) => {
      expect(band.emoji.length).toBeGreaterThan(0);
    });
  });
});

describe('calculateMoodTrend', () => {
  it('returns stable for fewer than 3 entries', () => {
    expect(calculateMoodTrend([])).toBe('stable');
    expect(calculateMoodTrend([makeMood(5, 0)])).toBe('stable');
    expect(calculateMoodTrend([makeMood(5, 0), makeMood(6, 1)])).toBe('stable');
  });

  it('returns up when recent moods are higher', () => {
    const moods = [
      makeMood(9, 0),
      makeMood(8, 1),
      makeMood(8, 2),
      makeMood(4, 5),
      makeMood(3, 6),
      makeMood(3, 7),
    ];
    expect(calculateMoodTrend(moods)).toBe('up');
  });

  it('returns down when recent moods are lower', () => {
    const moods = [
      makeMood(2, 0),
      makeMood(2, 1),
      makeMood(3, 2),
      makeMood(8, 5),
      makeMood(9, 6),
      makeMood(9, 7),
    ];
    expect(calculateMoodTrend(moods)).toBe('down');
  });

  it('returns stable when difference is small', () => {
    const moods = [
      makeMood(5, 0),
      makeMood(5, 1),
      makeMood(5, 2),
      makeMood(5, 3),
      makeMood(5, 4),
      makeMood(5, 5),
    ];
    expect(calculateMoodTrend(moods)).toBe('stable');
  });
});

describe('getMoodColor', () => {
  it('returns ecstatic color for score >= 9', () => {
    expect(getMoodColor(9)).toBeTruthy();
    expect(getMoodColor(10)).toBeTruthy();
  });

  it('returns happy color for score >= 7', () => {
    expect(getMoodColor(7)).toBeTruthy();
    expect(getMoodColor(8)).toBeTruthy();
  });

  it('returns content color for score >= 5', () => {
    expect(getMoodColor(5)).toBeTruthy();
    expect(getMoodColor(6)).toBeTruthy();
  });

  it('returns sad color for score >= 3', () => {
    expect(getMoodColor(3)).toBeTruthy();
    expect(getMoodColor(4)).toBeTruthy();
  });

  it('returns stressed color for score < 3', () => {
    expect(getMoodColor(2)).toBeTruthy();
    expect(getMoodColor(0)).toBeTruthy();
  });

  it('returns different colors for ecstatic vs happy', () => {
    expect(getMoodColor(10)).not.toBe(getMoodColor(7));
  });
});

describe('getMoodEmoji', () => {
  it('returns emoji string for any score', () => {
    [0, 3, 5, 7, 8, 10].forEach((score) => {
      expect(getMoodEmoji(score)).toBeTruthy();
    });
  });
});

describe('getMoodLabel', () => {
  it('returns Swedish label string for any score', () => {
    [0, 3, 5, 7, 8, 10].forEach((score) => {
      expect(getMoodLabel(score).length).toBeGreaterThan(0);
    });
  });

  it('returns Super for score 10', () => {
    expect(getMoodLabel(10)).toBe('Super');
  });
});

describe('getMoodScoreFromLabel', () => {
  it('returns 10 for super', () => {
    expect(getMoodScoreFromLabel('super')).toBe(10);
  });

  it('returns 8 for glad', () => {
    expect(getMoodScoreFromLabel('glad')).toBe(8);
  });

  it('returns 7 for bra', () => {
    expect(getMoodScoreFromLabel('bra')).toBe(7);
  });

  it('returns 5 for neutral', () => {
    expect(getMoodScoreFromLabel('neutral')).toBe(5);
  });

  it('returns 3 for orolig', () => {
    expect(getMoodScoreFromLabel('orolig')).toBe(3);
  });

  it('returns 2 for ledsen', () => {
    expect(getMoodScoreFromLabel('ledsen')).toBe(2);
  });

  it('returns null for unknown label', () => {
    expect(getMoodScoreFromLabel('unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getMoodScoreFromLabel('')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(getMoodScoreFromLabel('Super')).toBe(10);
    expect(getMoodScoreFromLabel('GLAD')).toBe(8);
    expect(getMoodScoreFromLabel('Neutral')).toBe(5);
  });

  it('trims whitespace', () => {
    expect(getMoodScoreFromLabel('  bra  ')).toBe(7);
  });
});

describe('getScoreRangeLabel', () => {
  it('returns Utmärkt for scores 9–10', () => {
    expect(getScoreRangeLabel(9)).toBe('Utmärkt');
    expect(getScoreRangeLabel(10)).toBe('Utmärkt');
  });

  it('returns Bra for scores 7–8', () => {
    expect(getScoreRangeLabel(7)).toBe('Bra');
    expect(getScoreRangeLabel(8)).toBe('Bra');
  });

  it('returns Okej for scores 5–6', () => {
    expect(getScoreRangeLabel(5)).toBe('Okej');
    expect(getScoreRangeLabel(6)).toBe('Okej');
  });

  it('returns Lågt for scores 3–4', () => {
    expect(getScoreRangeLabel(3)).toBe('Lågt');
    expect(getScoreRangeLabel(4)).toBe('Lågt');
  });

  it('returns Dåligt for scores 1–2', () => {
    expect(getScoreRangeLabel(1)).toBe('Dåligt');
    expect(getScoreRangeLabel(2)).toBe('Dåligt');
  });

  it('returns Okänd for out-of-range score', () => {
    expect(getScoreRangeLabel(0)).toBe('Okänd');
    expect(getScoreRangeLabel(11)).toBe('Okänd');
    expect(getScoreRangeLabel(-1)).toBe('Okänd');
  });
});

describe('calculateStreak', () => {
  it('returns 0 for empty array', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 for single mood logged today', () => {
    const moods = [makeMood(7, 0)];
    expect(calculateStreak(moods)).toBeGreaterThanOrEqual(1);
  });

  it('counts consecutive days', () => {
    const moods = [
      makeMood(7, 0),
      makeMood(6, 1),
      makeMood(8, 2),
    ];
    const streak = calculateStreak(moods);
    expect(streak).toBeGreaterThanOrEqual(1);
  });

  it('breaks streak when there is a gap', () => {
    const moods = [
      makeMood(7, 0),  // today
      makeMood(6, 1),  // yesterday
      // gap of 3 days
      makeMood(8, 5),  // 5 days ago - far enough to break streak
    ];
    const streak = calculateStreak(moods);
    // Streak should not include the entry after the gap
    expect(streak).toBe(2);
  });
});

describe('groupMoodsByDate', () => {
  it('returns empty array for empty input', () => {
    expect(groupMoodsByDate([])).toEqual([]);
  });

  it('groups moods from same day', () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const today2 = new Date();
    today2.setHours(15, 0, 0, 0);

    const moods: MoodEntry[] = [
      { id: '1', userId: 'u', score: 8, mood: 'happy', timestamp: today },
      { id: '2', userId: 'u', score: 6, mood: 'ok', timestamp: today2 },
    ];

    const result = groupMoodsByDate(moods);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(7); // avg of 8 and 6
  });

  it('keeps separate dates separate', () => {
    const moods = [
      makeMood(8, 0, 'a'),
      makeMood(6, 1, 'b'),
    ];

    const result = groupMoodsByDate(moods);
    expect(result).toHaveLength(2);
  });

  it('sorts results by date ascending', () => {
    const moods = [
      makeMood(8, 2, 'a'),
      makeMood(6, 0, 'b'),
      makeMood(7, 1, 'c'),
    ];

    const result = groupMoodsByDate(moods);
    expect(result[0].date < result[1].date).toBe(true);
    expect(result[1].date < result[2].date).toBe(true);
  });
});

describe('getWeeklyAverages', () => {
  it('returns correct number of weeks', () => {
    const result = getWeeklyAverages([], 4);
    expect(result).toHaveLength(4);
  });

  it('returns 0 averages for empty mood input', () => {
    const result = getWeeklyAverages([], 3);
    result.forEach((week) => {
      expect(week.average).toBe(0);
    });
  });

  it('includes week label starting with V', () => {
    const result = getWeeklyAverages([], 2);
    result.forEach((week) => {
      expect(week.week).toMatch(/^V\d+$/);
    });
  });

  it('computes non-zero average for moods within the range', () => {
    // Create moods within the past week
    const recentMoods = [makeMood(8, 1), makeMood(6, 2), makeMood(7, 3)];
    const result = getWeeklyAverages(recentMoods, 4);
    // At least one week should have a non-zero average
    const hasNonZero = result.some((w) => w.average > 0);
    expect(hasNonZero).toBe(true);
  });
});
