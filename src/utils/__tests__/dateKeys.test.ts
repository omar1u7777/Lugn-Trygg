import { describe, it, expect } from 'vitest';
import { toLocalDateKey, toLocalDateKeyFrom } from '../dateKeys';

/**
 * These guard a bug that shipped three times: bucketing entries by the UTC day
 * instead of the user's day, which credits a late-night entry to yesterday and
 * breaks streaks for anyone who logs after midnight.
 *
 * The timezone is not pinned for this suite, and CI runs in UTC, where the two
 * are identical by definition. So the UTC-divergence case can only be asserted
 * when the runner is east of UTC — it is skipped rather than quietly passing,
 * because a test that cannot fail is worse than an absent one. The invariant
 * tests below hold in every timezone and are what actually protect the code.
 */
const isEastOfUtc = new Date().getTimezoneOffset() < 0;

describe('toLocalDateKey', () => {
  it('always agrees with the local getters of the same Date', () => {
    // The real contract, checkable anywhere: whatever local day the engine
    // says this instant falls on is the day we key it under. toISOString()
    // cannot satisfy this outside UTC.
    for (const iso of ['2026-08-04T22:30:00Z', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z']) {
      const d = new Date(iso);
      const expected = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
      expect(toLocalDateKey(d)).toBe(expected);
    }
  });

  it.runIf(isEastOfUtc)('differs from the UTC day for a late-night instant', () => {
    // 22:30 UTC on the 4th is already the 5th at UTC+2 — the case that broke
    // streaks for users logging just after midnight.
    const lateNight = new Date('2026-08-04T22:30:00Z');
    expect(toLocalDateKey(lateNight)).toBe('2026-08-05');
    expect(toLocalDateKey(lateNight)).not.toBe(lateNight.toISOString().split('T')[0]);
  });

  it('zero-pads month and day so keys sort and compare as strings', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    expect(toLocalDateKey(new Date(2026, 10, 25, 12))).toBe('2026-11-25');
  });

  it('is stable across the times of day within one local day', () => {
    const morning = toLocalDateKey(new Date(2026, 7, 9, 0, 0, 1));
    const midday = toLocalDateKey(new Date(2026, 7, 9, 12, 0, 0));
    const night = toLocalDateKey(new Date(2026, 7, 9, 23, 59, 59));
    expect(new Set([morning, midday, night]).size).toBe(1);
  });
});

describe('toLocalDateKeyFrom', () => {
  it('accepts the shapes the API layer actually returns', () => {
    const expected = toLocalDateKey(new Date(2026, 7, 9, 12));
    const asDate = new Date(2026, 7, 9, 12);

    expect(toLocalDateKeyFrom(asDate)).toBe(expected);
    expect(toLocalDateKeyFrom(asDate.toISOString())).toBe(expected);
    expect(toLocalDateKeyFrom(asDate.getTime())).toBe(expected);
    // Raw Firestore timestamp, as read without the SDK converter.
    expect(toLocalDateKeyFrom({ seconds: Math.floor(asDate.getTime() / 1000) })).toBe(expected);
  });

  it('returns null instead of a NaN key for unusable input', () => {
    // These previously produced 'NaN-NaN-NaN', which silently became its own
    // bucket and quietly dropped entries out of every streak and chart.
    expect(toLocalDateKeyFrom(undefined)).toBeNull();
    expect(toLocalDateKeyFrom(null)).toBeNull();
    expect(toLocalDateKeyFrom('')).toBeNull();
    expect(toLocalDateKeyFrom('inte ett datum')).toBeNull();
    expect(toLocalDateKeyFrom({})).toBeNull();
    expect(toLocalDateKeyFrom({ seconds: 'nope' })).toBeNull();
    expect(toLocalDateKeyFrom({ seconds: NaN })).toBeNull();
  });

  it('never returns a key containing NaN', () => {
    const inputs: unknown[] = ['x', {}, { seconds: Infinity }, [], true, new Date('nope')];
    for (const input of inputs) {
      expect(toLocalDateKeyFrom(input) ?? '').not.toContain('NaN');
    }
  });
});
