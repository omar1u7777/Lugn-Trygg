/**
 * The prices shown to users, in one place.
 *
 * These were duplicated across three components — UpgradePage, PremiumGate and
 * SubscriptionForm — with PremiumGate holding "99 kr" as literal JSX text.
 * Changing the price in one place and missing another would show a user two
 * different prices inside the same app, and quite possibly a third at the
 * till.
 *
 * IMPORTANT: these are display values only. What the user is actually charged
 * comes from the Stripe Price objects referenced by STRIPE_PRICE_* on the
 * backend, and nothing here keeps the two in step. If you change a price,
 * change it in Stripe and here, and check them against each other — showing
 * one amount and charging another is not just a bug, it is a consumer-law
 * problem in Sweden.
 */

/** Monthly plan, SEK per month. */
export const MONTHLY_PRICE_SEK = 99;

/** Yearly plan, SEK per month, billed annually. */
export const YEARLY_PRICE_PER_MONTH_SEK = 79;

/** Enterprise plan, SEK per month. */
export const ENTERPRISE_PRICE_SEK = 249;

export const CURRENCY_SUFFIX = 'kr';

/** What the yearly plan actually costs up front. */
export const yearlyTotalSek = (): number => YEARLY_PRICE_PER_MONTH_SEK * 12;

/** What the user saves per year by paying annually. */
export const yearlySavingsSek = (): number =>
  (MONTHLY_PRICE_SEK - YEARLY_PRICE_PER_MONTH_SEK) * 12;
