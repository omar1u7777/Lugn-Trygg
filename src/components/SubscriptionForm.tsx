import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';
import { createCheckoutSession } from '../api/subscription';
import { logger } from '../utils/logger';
import { getStripePublishableKey } from '../config/env';

type BillingPeriod = 'monthly' | 'yearly';

const FEATURES = [
  { label: 'Obegränsade minnen och fotoalbum', free: false },
  { label: 'Avancerade AI-insikter och humöranalys', free: false },
  { label: 'CBT-övningar och guidad mindfulness', free: false },
  { label: 'Detaljerade analysdiagram (månad/år)', free: false },
  { label: 'Google Fit, Fitbit & hälsoapp-integration', free: false },
  { label: 'AI-kommunikationstränare', free: false },
  { label: 'Klinisk bedömning (PHQ-9, GAD-7)', free: false },
  { label: 'Prioriterad support', free: false },
  { label: 'Humörlogg (upp till 5 per dag)', free: true },
  { label: 'Daglig AI-chatt (10 meddelanden)', free: true },
  { label: 'Krishjälp och SOS-funktion', free: true },
];

const MONTHLY_PRICE = 99;
const YEARLY_PRICE = 79; // billed as 948/year

const SubscriptionForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  // [U5] Detect whether Stripe is configured in this environment.
  // The current flow uses Stripe Checkout (backend redirect) and does NOT require
  // the publishable key on the frontend, but we surface a notice if it is missing
  // so developers know to add VITE_STRIPE_PUBLISHABLE_KEY for future Elements work.
  const stripePublishableKey = getStripePublishableKey();
  const stripeConfigured = Boolean(stripePublishableKey);

  const saving = Math.round((MONTHLY_PRICE - YEARLY_PRICE) * 12);
  const displayPrice = billing === 'monthly' ? MONTHLY_PRICE : YEARLY_PRICE;
  const yearlyTotal = YEARLY_PRICE * 12;

  const handleSubscribe = async () => {
    if (!user?.user_id || !user?.email) {
      setError('Användarinformation saknas');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await createCheckoutSession(user.email, 'premium', billing);

      if (session.url) {
        window.location.href = session.url;
      } else {
        setError('Kunde inte skapa betalningssession');
      }
    } catch (err: unknown) {
      logger.error('Subscription error:', err);
      const errorMessage =
        err instanceof Error &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response &&
        'data' in err.response &&
        typeof err.response.data === 'object' &&
        err.response.data &&
        'error' in err.response.data
          ? String(err.response.data.error)
          : 'Ett fel uppstod vid prenumeration';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900 mb-3">
          <span className="text-2xl">💎</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Uppgradera till Premium</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Lås upp alla funktioner för din mentala hälsa
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          onClick={() => setBilling('monthly')}
          className={`px-4 py-2 rounded-l-lg border text-sm font-medium transition-colors ${
            billing === 'monthly'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Månadsvis
        </button>
        <button
          onClick={() => setBilling('yearly')}
          className={`px-4 py-2 rounded-r-lg border-t border-b border-r text-sm font-medium transition-colors relative ${
            billing === 'yearly'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Årsvis
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">
            Spara {saving} kr
          </span>
        </button>
      </div>

      {/* Pricing card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-indigo-200 dark:border-indigo-700 overflow-hidden mb-4">
        {/* Price display */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white text-center">
          <div className="flex items-end justify-center gap-1">
            <span className="text-4xl font-bold">{displayPrice}</span>
            <span className="text-lg mb-1">kr</span>
            <span className="text-indigo-200 mb-1">/månad</span>
          </div>
          {billing === 'yearly' && (
            <p className="text-sm text-indigo-200 mt-1">
              Faktureras {yearlyTotal} kr/år · Spara {saving} kr jämfört med månadsvis
            </p>
          )}
          {billing === 'monthly' && (
            <p className="text-sm text-indigo-200 mt-1">
              Byt till årsvis och spara {saving} kr/år
            </p>
          )}
        </div>

        {/* Feature list */}
        <div className="p-5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
            Ingår i Premium
          </p>
          <ul className="space-y-2.5">
            {FEATURES.filter(f => !f.free).map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature.label}
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Även i gratisversionen
            </p>
            <ul className="space-y-1.5">
              {FEATURES.filter(f => f.free).map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {/* [U5] Development-only notice when Stripe publishable key is not configured */}
          {!stripeConfigured && import.meta.env.DEV && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="alert">
              ⚠️ <strong>Dev-läge:</strong> VITE_STRIPE_PUBLISHABLE_KEY saknas i .env. Betalningar fungerar via Stripe Checkout men Stripe Elements kräver nyckeln.
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 
                       text-white font-semibold rounded-xl transition-colors flex items-center 
                       justify-center gap-2 text-sm"
            aria-label={`Uppgradera till Premium — ${displayPrice} kr/månad`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Bearbetar...
              </>
            ) : (
              <>
                🚀 Uppgradera Nu — {displayPrice} kr/mån
              </>
            )}
          </button>

          {/* Trust signals */}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              Säker betalning via Stripe
            </span>
            <span>·</span>
            <span>Ingen bindningstid</span>
            <span>·</span>
            <span>Avsluta när som helst</span>
          </div>

          {/* [U5] Explicit redirect notice — users are sent to Stripe's hosted checkout page. */}
          <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
            Du omdirigeras till Stripes säkra betalningssida för att slutföra köpet.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionForm;
