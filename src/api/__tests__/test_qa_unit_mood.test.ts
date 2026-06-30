import { describe, it, expect } from 'vitest';
import {
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
  formatMoodForDisplay,
} from '../../features/mood/utils';
import type { MoodEntry } from '../../features/mood/types';

function makeMood(score: number, daysAgo: number, id = '', mood = 'ok'): MoodEntry {
  const ts = new Date();
  ts.setDate(ts.getDate() - daysAgo);
  ts.setHours(12, 0, 0, 0);
  return { id: id || `mood-${daysAgo}`, userId: 'user1', score, mood, timestamp: ts };
}

describe('getCanonicalMoodBand', () => {
  it('returns Super for score 10', () => expect(getCanonicalMoodBand(10).label).toBe('Super'));
  it('returns Super for score 9', () => expect(getCanonicalMoodBand(9).label).toBe('Super'));
  it('returns Glad for score 8', () => expect(getCanonicalMoodBand(8).label).toBe('Glad'));
  it('returns Bra for score 7', () => expect(getCanonicalMoodBand(7).label).toBe('Bra'));
  it('returns Neutral for score 5', () => expect(getCanonicalMoodBand(5).label).toBe('Neutral'));
  it('returns Neutral for score 6', () => expect(getCanonicalMoodBand(6).label).toBe('Neutral'));
  it('returns Orolig for score 3', () => expect(getCanonicalMoodBand(3).label).toBe('Orolig'));
  it('returns Orolig for score 4', () => expect(getCanonicalMoodBand(4).label).toBe('Orolig'));
  it('returns Ledsen for score 0', () => expect(getCanonicalMoodBand(0).label).toBe('Ledsen'));
  it('returns Ledsen for score 2', () => expect(getCanonicalMoodBand(2).label).toBe('Ledsen'));
  it('returns Ledsen for score 1', () => expect(getCanonicalMoodBand(1).label).toBe('Ledsen'));
  it('returns last band for negative score', () => {
    expect(getCanonicalMoodBand(-5).label).toBe('Ledsen');
  });
});

describe('calculateMoodTrend', () => {
  it('returns stable for fewer than 3 entries', () => {
    expect(calculateMoodTrend([])).toBe('stable');
    expect(calculateMoodTrend([makeMood(5, 0)])).toBe('stable');
    expect(calculateMoodTrend([makeMood(5, 0), makeMood(6, 1)])).toBe('stable');
  });
  it('returns up when recent moods are higher', () => {
    const moods = [makeMood(9, 0), makeMood(8, 1), makeMood(8, 2), makeMood(4, 5), makeMood(3, 6), makeMood(3, 7)];
    expect(calculateMoodTrend(moods)).toBe('up');
  });
  it('returns down when recent moods are lower', () => {
    const moods = [makeMood(2, 0), makeMood(2, 1), makeMood(3, 2), makeMood(8, 5), makeMood(9, 6), makeMood(9, 7)];
    expect(calculateMoodTrend(moods)).toBe('down');
  });
  it('returns stable when difference is small', () => {
    const moods = [makeMood(5, 0), makeMood(5, 1), makeMood(5, 2), makeMood(5, 3), makeMood(5, 4), makeMood(5, 5)];
    expect(calculateMoodTrend(moods)).toBe('stable');
  });
});

describe('getMoodColor', () => {
  it('returns ecstatic color for score >= 9', () => {
    expect(getMoodColor(9)).toBe('#FFD700');
    expect(getMoodColor(10)).toBe('#FFD700');
  });
  it('returns happy color for score 7-8', () => {
    expect(getMoodColor(7)).toBe('#4CAF50');
    expect(getMoodColor(8)).toBe('#4CAF50');
  });
  it('returns content color for score 5-6', () => {
    expect(getMoodColor(5)).toBe('#8BC34A');
    expect(getMoodColor(6)).toBe('#8BC34A');
  });
  it('returns sad color for score 3-4', () => {
    expect(getMoodColor(3)).toBe('#2196F3');
    expect(getMoodColor(4)).toBe('#2196F3');
  });
  it('returns stressed color for score < 3', () => {
    expect(getMoodColor(2)).toBe('#F44336');
    expect(getMoodColor(0)).toBe('#F44336');
  });
});

describe('getMoodEmoji', () => {
  it('returns correct emoji for each band', () => {
    expect(getMoodEmoji(10)).toBe('🤩');
    expect(getMoodEmoji(8)).toBe('😊');
    expect(getMoodEmoji(7)).toBe('🙂');
    expect(getMoodEmoji(5)).toBe('😐');
    expect(getMoodEmoji(3)).toBe('😟');
    expect(getMoodEmoji(0)).toBe('😢');
  });
});

describe('getMoodLabel', () => {
  it('returns Swedish labels', () => {
    expect(getMoodLabel(10)).toBe('Super');
    expect(getMoodLabel(8)).toBe('Glad');
    expect(getMoodLabel(7)).toBe('Bra');
    expect(getMoodLabel(5)).toBe('Neutral');
    expect(getMoodLabel(3)).toBe('Orolig');
    expect(getMoodLabel(0)).toBe('Ledsen');
  });
});

describe('getMoodScoreFromLabel', () => {
  it('maps labels to scores', () => {
    expect(getMoodScoreFromLabel('super')).toBe(10);
    expect(getMoodScoreFromLabel('glad')).toBe(8);
    expect(getMoodScoreFromLabel('bra')).toBe(7);
    expect(getMoodScoreFromLabel('neutral')).toBe(5);
    expect(getMoodScoreFromLabel('orolig')).toBe(3);
    expect(getMoodScoreFromLabel('ledsen')).toBe(2);
  });
  it('returns null for unknown label', () => expect(getMoodScoreFromLabel('unknown')).toBeNull());
  it('returns null for empty string', () => expect(getMoodScoreFromLabel('')).toBeNull());
  it('is case-insensitive', () => {
    expect(getMoodScoreFromLabel('Super')).toBe(10);
    expect(getMoodScoreFromLabel('GLAD')).toBe(8);
  });
  it('trims whitespace', () => expect(getMoodScoreFromLabel('  bra  ')).toBe(7));
});

describe('getScoreRangeLabel', () => {
  it('returns Utmärkt for 9-10', () => {
    expect(getScoreRangeLabel(9)).toBe('Utmärkt');
    expect(getScoreRangeLabel(10)).toBe('Utmärkt');
  });
  it('returns Bra for 7-8', () => {
    expect(getScoreRangeLabel(7)).toBe('Bra');
    expect(getScoreRangeLabel(8)).toBe('Bra');
  });
  it('returns Okej for 5-6', () => {
    expect(getScoreRangeLabel(5)).toBe('Okej');
    expect(getScoreRangeLabel(6)).toBe('Okej');
  });
  it('returns Lågt for 3-4', () => {
    expect(getScoreRangeLabel(3)).toBe('Lågt');
    expect(getScoreRangeLabel(4)).toBe('Lågt');
  });
  it('returns Dåligt for 1-2', () => {
    expect(getScoreRangeLabel(1)).toBe('Dåligt');
    expect(getScoreRangeLabel(2)).toBe('Dåligt');
  });
  it('returns Okänd for out-of-range', () => {
    expect(getScoreRangeLabel(0)).toBe('Okänd');
    expect(getScoreRangeLabel(11)).toBe('Okänd');
    expect(getScoreRangeLabel(-1)).toBe('Okänd');
  });
});

describe('calculateStreak', () => {
  it('returns 0 for empty array', () => expect(calculateStreak([])).toBe(0));
  it('returns >= 1 for single mood today', () => {
    expect(calculateStreak([makeMood(7, 0)])).toBeGreaterThanOrEqual(1);
  });
  it('counts consecutive days', () => {
    const moods = [makeMood(7, 0), makeMood(6, 1), makeMood(8, 2)];
    expect(calculateStreak(moods)).toBeGreaterThanOrEqual(1);
  });
  it('breaks streak on gap', () => {
    const moods = [makeMood(7, 0), makeMood(6, 1), makeMood(8, 5)];
    expect(calculateStreak(moods)).toBe(2);
  });
});

describe('groupMoodsByDate', () => {
  it('returns empty array for empty input', () => expect(groupMoodsByDate([])).toEqual([]));
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
    expect(result[0].score).toBe(7);
  });
  it('keeps separate dates separate', () => {
    const result = groupMoodsByDate([makeMood(8, 0, 'a'), makeMood(6, 1, 'b')]);
    expect(result).toHaveLength(2);
  });
  it('sorts by date ascending', () => {
    const result = groupMoodsByDate([makeMood(8, 2, 'a'), makeMood(6, 0, 'b'), makeMood(7, 1, 'c')]);
    expect(result[0].date < result[1].date).toBe(true);
    expect(result[1].date < result[2].date).toBe(true);
  });
});

describe('getWeeklyAverages', () => {
  it('returns correct number of weeks', () => {
    expect(getWeeklyAverages([], 4)).toHaveLength(4);
  });
  it('returns 0 averages for empty input', () => {
    getWeeklyAverages([], 3).forEach((w) => expect(w.average).toBe(0));
  });
  it('includes week label starting with V', () => {
    getWeeklyAverages([], 2).forEach((w) => expect(w.week).toMatch(/^V\d+$/));
  });
  it('computes non-zero average for recent moods', () => {
    const result = getWeeklyAverages([makeMood(8, 1), makeMood(6, 2), makeMood(7, 3)], 4);
    expect(result.some((w) => w.average > 0)).toBe(true);
  });
});

describe('formatMoodForDisplay', () => {
  it('returns emoji, label, color, and time', () => {
    const mood = makeMood(8, 0);
    const result = formatMoodForDisplay(mood);
    expect(result.emoji).toBe('😊');
    expect(result.label).toBe('Glad');
    expect(result.color).toBeTruthy();
    expect(result.time).toBeTruthy();
  });
});
