import { describe, it, expect } from 'vitest';
import { analyzeMoodTrend, recentScoresForTrend } from '../recommendationPersonalization';

describe('recentScoresForTrend', () => {
  // As the API returns them: newest first.
  const newestFirst = [9, 8, 8, 7, 6, 5, 4, 3, 2, 2, 1, 1].map((score) => ({ score }));

  it('takes the latest entries and orders them oldest first', () => {
    expect(recentScoresForTrend(newestFirst, 5)).toEqual([6, 7, 8, 8, 9]);
  });

  it('lets analyzeMoodTrend see an improving week as improving', () => {
    // The old slice(-10) fed the oldest ten in reverse, which read this
    // steadily improving history as declining.
    const trend = analyzeMoodTrend(recentScoresForTrend(newestFirst));
    expect(trend?.trend).toBe('improving');
  });

  it('falls back to sentiment_score and skips unrated entries', () => {
    expect(recentScoresForTrend([{ sentiment_score: 4 }, {}, { score: 0 }, { score: 6 }])).toEqual([6, 4]);
  });
});
