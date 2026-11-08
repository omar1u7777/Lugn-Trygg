/**
 * The Swedish texts are Swedish.
 *
 * Onboarding said "Din personliga mental health-app", and twice "din mental
 * hälsa" where Swedish has "din mentala hälsa". A scan of sv.json, because
 * the failure is someone typing a phrase into the locale file.
 */
import { describe, it, expect } from 'vitest';
import sv from '../locales/sv.json';

type Json = Record<string, unknown>;

const entries = (value: unknown, path = ''): Array<[string, string]> => {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Json).flatMap(([key, child]) =>
    entries(child, path ? `${path}.${key}` : key)
  );
};

const SWEDISH = entries(sv);

// English that has turned up in Swedish copy. Product names (Samsung Health,
// Google Fit) are written with capitals and are not matched.
const ENGLISH = /\bmental health\b|\bdata retention\b|\bthe\b|\byour\b|\band\b|\bsettings\b|\bmonths?\b|\byears?\b/;

describe('Swedish copy', () => {
  it('has no English phrases', () => {
    const mixed = SWEDISH.filter(([, text]) => ENGLISH.test(text));

    expect(mixed).toEqual([]);
  });

  it('declines "mental" after din, min, er, vår, sin, den and deras', () => {
    const wrong = SWEDISH.filter(([, text]) =>
      /\b(din|min|er|vår|sin|den|deras)\s+mental\s+hälsa/i.test(text)
    );

    expect(wrong).toEqual([]);
  });
});
