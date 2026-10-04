/**
 * BUG-10: mood tags were rendered by their internal id, so the mood history
 * showed "#work" and "#family" where "#Arbete" and "#Familj" belonged. The
 * translations had existed all along under mood.tags.predefined.* — four views
 * simply printed the stored id instead of looking them up.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import i18n from '../../i18n';
import { tagLabel } from '../tagLabel';

beforeEach(async () => {
  await i18n.changeLanguage('sv');
});

afterAll(async () => {
  await i18n.changeLanguage('sv');
});

describe('tagLabel', () => {
  it('translates a preset tag instead of leaking its id', () => {
    expect(tagLabel(i18n.t, 'work')).toBe('Arbete');
    expect(tagLabel(i18n.t, 'family')).toBe('Familj');
  });

  it.each([
    ['en', 'work', 'Work'],
    ['no', 'work', 'Arbeid'],
  ])('follows the chosen language (%s)', async (lang, tag, expected) => {
    await i18n.changeLanguage(lang);
    expect(tagLabel(i18n.t, tag)).toBe(expected);
  });

  it('returns a custom tag unchanged', () => {
    // The user's own words have no key. i18next answers a missing key with the
    // key itself, so without the empty defaultValue this would render
    // "mood.tags.predefined.Trädgård" — worse than the id it replaced.
    expect(tagLabel(i18n.t, 'Trädgård')).toBe('Trädgård');
  });

  it('covers every preset the tag selector offers', () => {
    // If a preset is added to TagSelector without a translation, the id would
    // reach the screen again. This asserts the whole set, not a sample.
    const presets = [
      'work', 'family', 'friends', 'exercise', 'sleep', 'health',
      'stress', 'relaxation', 'social', 'alone', 'nature', 'creative',
    ];
    const untranslated = presets.filter((id) => tagLabel(i18n.t, id) === id);
    expect(untranslated).toEqual([]);
  });
});
