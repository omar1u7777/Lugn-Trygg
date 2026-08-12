import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MONTHLY_PRICE_SEK,
  YEARLY_PRICE_PER_MONTH_SEK,
  ENTERPRISE_PRICE_SEK,
  yearlyTotalSek,
  yearlySavingsSek,
} from '../pricing';

/**
 * The price was written out in three separate components, one of them as
 * literal JSX text ("99 kr"). Updating one and missing another would show a
 * user two different prices inside the same app.
 *
 * The guard below is deliberately a source scan rather than a render test: the
 * failure mode is someone typing a number back into a component, and only
 * reading the files catches that.
 */
const PRICE_COMPONENTS = [
  'src/pages/UpgradePage.tsx',
  'src/components/PremiumGate.tsx',
  'src/components/SubscriptionForm.tsx',
];

describe('pricing', () => {
  it('keeps the yearly plan cheaper per month than the monthly one', () => {
    // The whole pitch for annual billing is that it saves money. If this ever
    // inverts, the page advertises a discount that costs more.
    expect(YEARLY_PRICE_PER_MONTH_SEK).toBeLessThan(MONTHLY_PRICE_SEK);
  });

  it('derives the yearly total and saving from the same numbers it shows', () => {
    expect(yearlyTotalSek()).toBe(YEARLY_PRICE_PER_MONTH_SEK * 12);
    expect(yearlySavingsSek()).toBe((MONTHLY_PRICE_SEK - YEARLY_PRICE_PER_MONTH_SEK) * 12);
    // A saving the user cannot actually get would be a false claim.
    expect(yearlySavingsSek()).toBeGreaterThan(0);
  });

  it('prices are whole kronor', () => {
    for (const price of [MONTHLY_PRICE_SEK, YEARLY_PRICE_PER_MONTH_SEK, ENTERPRISE_PRICE_SEK]) {
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThan(0);
    }
  });

  describe('no component writes a price of its own', () => {
    const prices = [MONTHLY_PRICE_SEK, YEARLY_PRICE_PER_MONTH_SEK, ENTERPRISE_PRICE_SEK];

    it.each(PRICE_COMPONENTS)('%s imports them instead', (relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
      const withoutImports = source
        .split('\n')
        .filter((line) => !line.includes('config/pricing'))
        .join('\n');

      for (const price of prices) {
        // Matches the number as a standalone token, so class names like
        // "gap-99" or "text-249" would not trip it.
        const literal = new RegExp(`(^|[^\\w.-])${price}([^\\w%.-]|$)`, 'm');
        expect(
          literal.test(withoutImports),
          `${relativePath} contains a literal ${price}; import it from config/pricing instead`
        ).toBe(false);
      }
    });
  });
});
