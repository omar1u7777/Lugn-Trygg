import { describe, it, expect } from 'vitest';
import sv from '../locales/sv.json';
import en from '../locales/en.json';
import no from '../locales/no.json';

/**
 * Three pages shipped entirely in Swedish with no useTranslation at all, so an
 * English or Norwegian user read Swedish. Wrapping the strings in t() only
 * helps if the keys actually exist in every locale — otherwise i18next falls
 * back to the Swedish inline default and nothing has changed for them.
 *
 * These namespaces are checked for exact structural parity so a key added to
 * one language and forgotten in another fails here rather than in front of a
 * user.
 */
const CHECKED_NAMESPACES = ['feedbackForm', 'referral', 'healthIntegrations'] as const;

type Json = Record<string, unknown>;

const flatten = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Json).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  );
};

const placeholders = (value: string): string[] =>
  (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

const at = (locale: Json, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => (acc as Json)?.[key], locale);

const LOCALES: Array<[string, Json]> = [
  ['en', en as Json],
  ['no', no as Json],
];

/**
 * Strings that are genuinely identical between two languages. Swedish and
 * Norwegian share plenty of vocabulary, so an exact match is not proof that
 * nobody translated it. Listed explicitly, per locale, so the check stays
 * strict everywhere else instead of being loosened for all of them.
 */
const LEGITIMATELY_IDENTICAL: Record<string, ReadonlySet<string>> = {
  no: new Set([
    'healthIntegrations.benefits.autoSync', // "Automatisk synkronisering" in both
  ]),
  en: new Set(),
};

describe('locale parity for the newly translated pages', () => {
  describe.each(CHECKED_NAMESPACES)('%s', (namespace) => {
    const svKeys = flatten((sv as Json)[namespace]).sort();

    it('exists in every locale', () => {
      expect((sv as Json)[namespace]).toBeDefined();
      for (const [name, locale] of LOCALES) {
        expect(locale[namespace], `${name} is missing the ${namespace} namespace`).toBeDefined();
      }
    });

    it.each(LOCALES)('has exactly the same keys in %s', (name, locale) => {
      const keys = flatten(locale[namespace]).sort();
      expect(keys, `${name}.${namespace} differs from sv`).toEqual(svKeys);
    });

    it.each(LOCALES)('is actually translated in %s, not copied from Swedish', (name, locale) => {
      // Emoji-only and symbol values legitimately match across languages; a
      // long prose string that is byte-identical to the Swedish is a sign the
      // translation was never written.
      const allowed = LEGITIMATELY_IDENTICAL[name] ?? new Set<string>();
      const untranslated = svKeys.filter((key) => {
        if (allowed.has(`${namespace}.${key}`)) return false;
        const svValue = at(sv as Json, `${namespace}.${key}`);
        const value = at(locale, `${namespace}.${key}`);
        if (typeof svValue !== 'string' || typeof value !== 'string') return false;
        return svValue === value && svValue.replace(/[^\p{L}]/gu, '').length > 12;
      });
      expect(untranslated, `${name}.${namespace} still holds Swedish text`).toEqual([]);
    });

    it.each(LOCALES)('keeps every interpolation placeholder in %s', (name, locale) => {
      const mismatched = svKeys.filter((key) => {
        const svValue = at(sv as Json, `${namespace}.${key}`);
        const value = at(locale, `${namespace}.${key}`);
        if (typeof svValue !== 'string' || typeof value !== 'string') return false;
        // A dropped {{provider}} renders the literal braces to the user.
        return JSON.stringify(placeholders(svValue)) !== JSON.stringify(placeholders(value));
      });
      expect(mismatched, `${name}.${namespace} lost or renamed a placeholder`).toEqual([]);
    });
  });
});
