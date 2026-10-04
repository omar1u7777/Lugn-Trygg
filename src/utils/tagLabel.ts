import type { TFunction } from 'i18next';

/**
 * The display label for a mood tag.
 *
 * Tags are stored by internal id — `work`, `family`, `friends`, `creative` —
 * and four separate views rendered that id straight to the screen as `#work`.
 * The translations existed the whole time (`mood.tags.predefined.work` has been
 * "Arbete" in sv, "Work" in en, "Arbeid" in no); nothing looked them up.
 *
 * Custom tags are the user's own words and have no key, so they are returned
 * unchanged. That is the reason for the empty defaultValue rather than a
 * missing-key check: i18next returns the key itself when a key is absent, and
 * printing `mood.tags.predefined.Whatever` would be worse than printing what
 * the user typed.
 */
export const tagLabel = (t: TFunction, tag: string): string => {
  const translated = t(`mood.tags.predefined.${tag}`, { defaultValue: '' });
  return typeof translated === 'string' && translated.length > 0 ? translated : tag;
};
