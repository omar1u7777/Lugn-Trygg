/**
 * BUG-08 — unsourced clinical efficacy claims.
 *
 * The 4-7-8 module stated "Kliniska studier visar 78% minskning av
 * ångestsymptom efter 4 veckor" and "sänker kortisolnivåer med upp till 30%".
 * Neither cited anything, and no source was found for either figure.
 *
 * A precise percentage reads as a measured finding. In an app whose users may
 * weigh it against seeking actual treatment, that is not a copy problem.
 *
 * This asserts the property rather than the two strings: no efficacy
 * percentage anywhere in the recommendation content or the locale bundles.
 * Someone adding "reduces stress by 40%" tomorrow fails this without anyone
 * remembering BUG-08.
 */

import { describe, it, expect } from 'vitest';
import sv from '../../i18n/locales/sv.json';
import en from '../../i18n/locales/en.json';
import no from '../../i18n/locales/no.json';

/** "78%", "up to 30 %", "78 procent" — the shapes an efficacy claim takes. */
const PERCENT_CLAIM = /\d+\s?(%|procent|prosent|per cent|percent)/i;

/** Words that make a percentage a clinical claim rather than, say, progress. */
const CLINICAL_CONTEXT =
  /(ångest|angst|anxiety|kortisol|cortisol|symptom|symtom|klinisk|clinical|studie|study|studier|studies|minskning|reduction|reduksjon)/i;

const flatten = (obj: Record<string, unknown>, prefix = ''): [string, string][] =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flatten(value as Record<string, unknown>, path);
    }
    return typeof value === 'string' ? [[path, value] as [string, string]] : [];
  });

describe('no unsourced clinical efficacy claims', () => {
  it.each([['sv', sv], ['en', en], ['no', no]])(
    'the %s bundle states no percentage as a clinical outcome',
    (_lang, bundle) => {
      const offenders = flatten(bundle as Record<string, unknown>)
        .filter(([, text]) => PERCENT_CLAIM.test(text) && CLINICAL_CONTEXT.test(text))
        .map(([path, text]) => `${path}: ${text}`);

      expect(offenders).toEqual([]);
    }
  );

  it('keeps the mechanism, which is ordinary physiology', async () => {
    // Removing the claims must not strip the explanation. A long exhale
    // engaging the parasympathetic nervous system is not an efficacy claim,
    // and the exercise makes no sense without it.
    const { RECOMMENDATIONS_POOL } = await import('../recommendations');
    const breathing = RECOMMENDATIONS_POOL.find((r) => r.id === 'stress-1');

    expect(breathing?.content).toMatch(/parasympatiska/i);
    expect(breathing?.content).not.toMatch(/78|kortisol/i);
  });

  it('does not call the technique scientifically proven', async () => {
    // The literature does not support that strength of claim for 4-7-8
    // specifically, whatever it supports for paced breathing in general.
    const { RECOMMENDATIONS_POOL } = await import('../recommendations');
    const breathing = RECOMMENDATIONS_POOL.find((r) => r.id === 'stress-1');

    expect(breathing?.description).not.toMatch(/vetenskapligt beprövad/i);
  });
});
