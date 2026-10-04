/**
 * BUG-15 — all three goals showed the same daily task, "Logga ditt humör idag".
 *
 * The data was never missing. dashboard.goalSteps has held fifteen per-goal
 * step lists in all three locale files the whole time. i18next simply refuses
 * to return an object unless asked, and hands back the KEY STRING instead —
 * so `steps[goal]` indexed a string, got undefined, and every goal fell through
 * to dashboard.defaultGoalStep.
 *
 * Two call sites relied on that: getNextStepForGoal and getRecommendationsPool.
 * Both cast the result to an object type it never had, and both had a guard
 * that quietly absorbed the failure — `if (!pool || typeof pool !== 'object')
 * return RECOMMENDATIONS_POOL`. That guard is why nobody noticed the entire
 * recommendation catalogue was being served untranslated.
 *
 * These pin the contract rather than the components: it is the i18next call
 * shape that was wrong, and it will be wrong again the moment someone copies
 * one of these lookups without the option.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import i18n from '../index';

beforeEach(async () => {
  await i18n.changeLanguage('sv');
});

afterAll(async () => {
  await i18n.changeLanguage('sv');
});

describe('dashboard.goalSteps is reachable as an object', () => {
  it('refuses to return the object without returnObjects', () => {
    // i18next is not silent about this — it answers with a diagnostic string
    // saying it found an object. That string was then cast to
    // Record<string, string[]> and indexed, which is where the silence began.
    expect(String(i18n.t('dashboard.goalSteps'))).toMatch(/returned an object/i);
  });

  it('returns the step lists with returnObjects', () => {
    const steps = i18n.t('dashboard.goalSteps', { returnObjects: true });
    expect(typeof steps).toBe('object');
    expect(Array.isArray((steps as Record<string, unknown>)['default'])).toBe(true);
  });

  it.each([
    ['Hantera stress'],
    ['Bättre sömn'],
    ['Ångesthantering'],
  ])('has its own steps for %s', (goal) => {
    const steps = i18n.t('dashboard.goalSteps', { returnObjects: true }) as Record<string, string[]>;
    expect(Array.isArray(steps[goal])).toBe(true);
    expect(steps[goal]!.length).toBeGreaterThan(0);
  });

  it('gives different goals different steps', () => {
    // The symptom the report describes: three goals, one identical task.
    const steps = i18n.t('dashboard.goalSteps', { returnObjects: true }) as Record<string, string[]>;
    const stress = steps['Hantera stress']!;
    const sleep = steps['Bättre sömn']!;
    expect(stress).not.toEqual(sleep);
  });

  it.each([['en'], ['no']])('is translated in %s too', async (lang) => {
    await i18n.changeLanguage(lang);
    const steps = i18n.t('dashboard.goalSteps', { returnObjects: true });
    expect(typeof steps).toBe('object');
  });
});

describe('recommendationsPool is reachable as an object', () => {
  it('refuses to return the object without returnObjects', () => {
    expect(String(i18n.t('recommendationsPool'))).toMatch(/returned an object/i);
  });

  it('returns the catalogue with returnObjects', () => {
    const pool = i18n.t('recommendationsPool', { returnObjects: true });
    expect(typeof pool).toBe('object');
    expect(Object.keys(pool as Record<string, unknown>).length).toBeGreaterThan(0);
  });

  it('carries the fields the mapper reads', () => {
    const pool = i18n.t('recommendationsPool', { returnObjects: true }) as Record<string, Record<string, string>>;
    const first = Object.values(pool)[0]!;
    for (const field of ['title', 'description', 'category', 'content']) {
      expect(typeof first[field]).toBe('string');
    }
  });
});
