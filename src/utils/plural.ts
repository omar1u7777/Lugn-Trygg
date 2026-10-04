const svPlural = new Intl.PluralRules('sv-SE');

/**
 * "1 dag" / "2 dagar" for the Swedish strings that are not yet in the locale
 * files. They used to be written as `${n} dagar`, which read "1 dagar",
 * "1 veckor", "1 referenser" (UI audit L-5). Translated strings use
 * i18next's _one/_other keys instead.
 */
export const svCount = (n: number, one: string, other: string): string =>
  `${n} ${svPlural.select(n) === 'one' ? one : other}`;
