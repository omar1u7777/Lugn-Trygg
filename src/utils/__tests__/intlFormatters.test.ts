/**
 * Tests for intlFormatters utility functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Must mock i18n BEFORE importing the module
vi.mock('../../i18n/index', () => ({
  default: {
    language: 'sv',
    options: {
      fallbackLng: ['sv'],
    },
  },
}));

import i18n from '../../i18n/index';
import {
  getCurrentLocale,
  isRtlLocale,
  formatDateTime,
  formatNumber,
  formatRelativeTimeFromNow,
} from '../intlFormatters';

const mockI18n = i18n as { language: string; options: { fallbackLng: unknown } };

describe('getCurrentLocale', () => {
  it('returns i18n.language when set', () => {
    mockI18n.language = 'sv';
    expect(getCurrentLocale()).toBe('sv');
  });

  it('returns language when set to en', () => {
    mockI18n.language = 'en';
    expect(getCurrentLocale()).toBe('en');
  });

  it('returns fallbackLng[0] when language is empty', () => {
    mockI18n.language = '';
    mockI18n.options.fallbackLng = ['sv'];
    expect(getCurrentLocale()).toBe('sv');
  });

  it('returns fallbackLng string when it is a string', () => {
    mockI18n.language = '';
    mockI18n.options.fallbackLng = 'en';
    expect(getCurrentLocale()).toBe('en');
  });

  it('returns sv as final fallback', () => {
    mockI18n.language = '';
    mockI18n.options.fallbackLng = undefined;
    expect(getCurrentLocale()).toBe('sv');
  });
});

describe('isRtlLocale', () => {
  it('returns true for Arabic', () => {
    expect(isRtlLocale('ar')).toBe(true);
  });

  it('returns true for Hebrew', () => {
    expect(isRtlLocale('he')).toBe(true);
  });

  it('returns true for Persian', () => {
    expect(isRtlLocale('fa')).toBe(true);
  });

  it('returns true for Urdu', () => {
    expect(isRtlLocale('ur')).toBe(true);
  });

  it('returns false for Swedish', () => {
    expect(isRtlLocale('sv')).toBe(false);
  });

  it('returns false for English', () => {
    expect(isRtlLocale('en')).toBe(false);
  });

  it('returns false for Finnish', () => {
    expect(isRtlLocale('fi')).toBe(false);
  });

  it('returns true for ar-SA (splits on hyphen)', () => {
    expect(isRtlLocale('ar-SA')).toBe(true);
  });

  it('returns true for he-IL', () => {
    expect(isRtlLocale('he-IL')).toBe(true);
  });

  it('returns false for en-US', () => {
    expect(isRtlLocale('en-US')).toBe(false);
  });

  it('uses current locale when no argument provided', () => {
    mockI18n.language = 'sv';
    // Should not throw
    expect(typeof isRtlLocale()).toBe('boolean');
  });
});

describe('formatDateTime', () => {
  it('formats a Date object', () => {
    const date = new Date('2024-06-15T10:30:00Z');
    const result = formatDateTime(date);
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('formats a date string', () => {
    const result = formatDateTime('2024-06-15');
    expect(typeof result).toBe('string');
  });

  it('formats a timestamp number', () => {
    const result = formatDateTime(1718449800000);
    expect(typeof result).toBe('string');
  });

  it('returns null or empty for invalid date', () => {
    const result = formatDateTime(new Date('not-a-date'));
    // Invalid date should return null or undefined or empty string
    expect(!result || result === '').toBe(true);
  });

  it('accepts custom format options', () => {
    const date = new Date('2024-01-15T00:00:00Z');
    const result = formatDateTime(date, { year: 'numeric', month: 'long' });
    expect(typeof result).toBe('string');
  });
});

describe('formatNumber', () => {
  it('formats a simple integer', () => {
    const result = formatNumber(1234);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats a decimal number', () => {
    const result = formatNumber(1234.56);
    expect(typeof result).toBe('string');
  });

  it('formats zero', () => {
    const result = formatNumber(0);
    expect(typeof result).toBe('string');
  });

  it('accepts custom options', () => {
    const result = formatNumber(0.75, { style: 'percent' });
    expect(typeof result).toBe('string');
    expect(result).toContain('%');
  });

  it('formats large numbers', () => {
    const result = formatNumber(1000000);
    expect(typeof result).toBe('string');
  });
});

describe('formatRelativeTimeFromNow', () => {
  it('formats seconds ago', () => {
    const fewSecondsAgo = new Date(Date.now() - 10_000);
    const result = formatRelativeTimeFromNow(fewSecondsAgo);
    expect(typeof result).toBe('string');
  });

  it('formats minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
    const result = formatRelativeTimeFromNow(fiveMinutesAgo);
    expect(typeof result).toBe('string');
  });

  it('formats hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
    const result = formatRelativeTimeFromNow(twoHoursAgo);
    expect(typeof result).toBe('string');
  });

  it('formats days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const result = formatRelativeTimeFromNow(threeDaysAgo);
    expect(typeof result).toBe('string');
  });

  it('accepts a date string as input', () => {
    const result = formatRelativeTimeFromNow('2020-01-01');
    expect(typeof result).toBe('string');
  });

  it('accepts a timestamp as input', () => {
    const result = formatRelativeTimeFromNow(Date.now() - 60_000);
    expect(typeof result).toBe('string');
  });

  it('returns a non-empty string', () => {
    const result = formatRelativeTimeFromNow(new Date());
    expect(result.length).toBeGreaterThan(0);
  });
});
