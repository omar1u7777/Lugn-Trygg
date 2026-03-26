/**
 * UpgradePage - Sida för att uppgradera till Premium
 * 
 * Visar priser, fördelar och möjlighet att uppgradera.
 * Integrerar med Stripe för betalning.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession } from '@/api/subscription';
import { useSubscription, type SubscriptionTier } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';
import { Card } from '@/components/ui/tailwind';

/** Alla premium-fördelar */
const PREMIUM_FEATURES = [
  {
    category: 'Grundfunktioner',
    features: [
      { name: 'Humörloggning', free: '3/dag', premium: 'Obegränsat' },
      { name: 'AI-chattmeddelanden', free: '10/dag', premium: 'Obegränsat' },
      { name: 'Historik', free: '7 dagar', premium: 'Obegränsat' },
    ],
  },
  {
    category: 'Välmående',
    features: [
      { name: 'Lugnande ljud & meditationer', free: false, premium: true },
      { name: 'Guidade andningsövningar', free: true, premium: true },
      { name: 'Välmåendestatistik', free: false, premium: true },
    ],
  },
  {
    category: 'Insikter & Analyser',
    features: [
      { name: 'AI-insikter om ditt humör', free: false, premium: true },
      { name: 'Humörtrender & mönster', free: false, premium: true },
      { name: 'Veckorapporter', free: false, premium: true },
    ],
  },
  {
    category: 'Extra funktioner',
    features: [
      { name: 'Personlig dagbok', free: false, premium: true },
      { name: 'Röstchatt med AI', free: false, premium: true },
      { name: 'Belöningar & gamification', free: false, premium: true },
      { name: 'Sociala funktioner', free: false, premium: true },
      { name: 'Exportera din data', free: false, premium: true },
    ],
  },
];

const PLAN_LABELS: Record<SubscriptionTier, string> = {
  free: 'Gratis',
  premium: 'Premium',
  trial: 'Testperiod',
  enterprise: 'Enterprise',
};

const UpgradePage: React.FC = () => {
  const navigate = useNavigate();
  const { plan, loading } = useSubscription();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasFullAccess = !loading && (plan.tier === 'premium' || plan.tier === 'enterprise');

  // Om redan premium, visa bekräftelse
  if (hasFullAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fff7f0] to-[#fffaf5] p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <SparklesIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#2f2a24] mb-4">
            Du är redan {PLAN_LABELS[plan.tier]}! 🎉
          </h1>
          <p className="text-[#6d645d] mb-8">
            Du har tillgång till alla funktioner i Lugn & Trygg.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 bg-[#2c8374] hover:bg-[#1e5f54] text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Tillbaka till Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleUpgrade = async (planKey: 'premium' | 'enterprise' = 'premium') => {
    if (!user?.user_id || !user?.email) {
      setErrorMessage('Användarinformation saknas. Vänligen logga in på nytt.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const session = await createCheckoutSession(
        user.email,
        planKey,
        planKey === 'premium' ? selectedPlan : 'monthly'
      );

      if (session.url) {
        window.location.href = session.url;
      } else {
        setErrorMessage('Kunde inte skapa betalningssession. Försök igen.');
      }
    } catch (error: unknown) {
      logger.error('Stripe checkout failed', error);
      const apiError = error as { response?: { data?: { error?: string } } };
      const message = apiError?.response?.data?.error || 'Ett fel uppstod vid betalningen.';
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const monthlyPrice = 99;
  const yearlyPrice = 79; // Per månad vid årsbetalning
  const yearlyTotal = yearlyPrice * 12;
  const yearlySavings = (monthlyPrice - yearlyPrice) * 12;
  const enterprisePrice = 249;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff7f0] to-[#fffaf5] p-4 sm:p-6 lg:p-8">
      {/* Tillbaka-knapp */}
      <div className="max-w-5xl mx-auto mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[#6d645d] hover:text-[#2f2a24] transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Tillbaka
        </button>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-amber-300/30">
          <SparklesIcon className="w-4 h-4" />
          Uppgradera till Premium
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#2f2a24] mb-4">
          Investera i ditt välmående 🌿
        </h1>
        <p className="text-lg text-[#6d645d] max-w-2xl mx-auto">
          Få obegränsad tillgång till alla verktyg för att förbättra din mentala hälsa.
        </p>
      </div>

      {/* Prisplaner */}
      <div className="max-w-5xl mx-auto mb-12">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Månadsplan */}
          <Card 
            className={`p-6 cursor-pointer transition-all duration-300 border-2 ${
              selectedPlan === 'monthly' 
                ? 'border-[#2c8374] shadow-lg bg-white' 
                : 'border-[#e8dcd0] hover:border-[#2c8374]/50 hover:shadow-md bg-white/80'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#2f2a24]">
                Månadsvis
              </h3>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-[#2c8374] bg-[#2c8374]'
                  : 'border-[#e8dcd0]'
              }`}>
                {selectedPlan === 'monthly' && <CheckIcon className="w-4 h-4 text-white" />}
              </div>
            </div>
            <div className="mb-4">
              <span className="text-4xl font-bold text-[#2f2a24]">{monthlyPrice} kr</span>
              <span className="text-[#6d645d]">/månad</span>
            </div>
            <p className="text-sm text-[#6d645d]">
              Betala månadsvis, avsluta när du vill
            </p>
          </Card>

          {/* Årsplan */}
          <Card 
            className={`p-6 cursor-pointer transition-all duration-300 relative overflow-hidden border-2 ${
              selectedPlan === 'yearly' 
                ? 'border-[#2c8374] shadow-lg bg-white' 
                : 'border-[#e8dcd0] hover:border-[#2c8374]/50 hover:shadow-md bg-white/80'
            }`}
            onClick={() => setSelectedPlan('yearly')}
          >
            {/* Populär-badge */}
            <div className="absolute top-0 right-0 bg-gradient-to-r from-[#2c8374] to-[#3a9d8c] text-white text-xs font-bold px-3 py-1.5 rounded-bl-xl">
              🎁 SPARA {yearlySavings} kr
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#2f2a24]">
                Årsvis
              </h3>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedPlan === 'yearly'
                  ? 'border-[#2c8374] bg-[#2c8374]'
                  : 'border-[#e8dcd0]'
              }`}>
                {selectedPlan === 'yearly' && <CheckIcon className="w-4 h-4 text-white" />}
              </div>
            </div>
            <div className="mb-2">
              <span className="text-4xl font-bold text-[#2f2a24]">{yearlyPrice} kr</span>
              <span className="text-[#6d645d]">/månad</span>
            </div>
            <p className="text-sm text-[#6d645d] mb-2">
              Faktureras som {yearlyTotal} kr/år
            </p>
            <p className="text-sm text-[#2c8374] font-semibold">
              🎉 2 månader gratis!
            </p>
          </Card>

          {/* Enterprise */}
          <Card className="p-6 border-2 border-dashed border-[#c08a5d]/40 bg-[#fff7f0]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#2f2a24]">
                Enterprise
              </h3>
              <span className="text-xs font-bold text-[#c08a5d] uppercase bg-[#c08a5d]/10 px-2 py-1 rounded-full">Team</span>
            </div>
            <div className="mb-2">
              <span className="text-4xl font-bold text-[#2f2a24]">{enterprisePrice} kr</span>
              <span className="text-[#6d645d]">/månad per organisation</span>
            </div>
            <p className="text-sm text-[#6d645d] mb-4">
              För kliniker, företag och skolor
            </p>
            <ul className="text-sm text-[#2f2a24] space-y-2 mb-6">
              <li>✅ Prioriterad support 24/7</li>
              <li>✅ Teamadministration & roller</li>
              <li>✅ Avancerad rapportering & export</li>
              <li>✅ Dedikerad onboarding</li>
            </ul>
            <button
              onClick={() => handleUpgrade('enterprise')}
              disabled={isProcessing}
              className="w-full bg-[#2f2a24] text-white hover:bg-[#4d473f] font-semibold py-3 rounded-xl transition-all"
            >
              {isProcessing ? 'Behandlar...' : 'Uppgradera till Enterprise'}
            </button>
          </Card>
        </div>
      </div>

      {/* CTA-knapp */}
      <div className="max-w-md mx-auto mb-12">
        <button
          onClick={() => handleUpgrade()}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-[#2c8374] to-[#3a9d8c] hover:from-[#1e5f54] hover:to-[#2c8374] text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg transform hover:scale-[1.02]"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Behandlar...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <SparklesIcon className="w-6 h-6" />
              Uppgradera nu ✨
            </span>
          )}
        </button>

        {errorMessage && (
          <p className="mt-4 text-center text-sm text-red-500 bg-red-50 py-2 px-4 rounded-lg">
            {errorMessage}
          </p>
        )}

        {/* Förtroende-indikatorer */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <ShieldCheckIcon className="w-4 h-4" />
            Säker betalning
          </span>
          <span className="flex items-center gap-1">
            <CreditCardIcon className="w-4 h-4" />
            Avsluta när som helst
          </span>
        </div>
      </div>

      {/* Funktionsjämförelse */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
          Vad ingår?
        </h2>

        <div className="space-y-8">
          {PREMIUM_FEATURES.map((category, categoryIndex) => (
            <Card key={categoryIndex} className="overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {category.category}
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 overflow-x-auto">
                {/* Header row */}
                <div className="grid grid-cols-[minmax(180px,2fr)_minmax(88px,1fr)_minmax(88px,1fr)] sm:grid-cols-3 gap-2 sm:gap-0 px-3 sm:px-6 py-3 bg-gray-50/50 dark:bg-gray-800/50 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[360px] sm:min-w-0">
                  <span>Funktion</span>
                  <span className="text-center">Gratis</span>
                  <span className="text-center text-yellow-600 dark:text-yellow-400">Premium</span>
                </div>
                {category.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="grid grid-cols-[minmax(180px,2fr)_minmax(88px,1fr)_minmax(88px,1fr)] sm:grid-cols-3 gap-2 sm:gap-0 px-3 sm:px-6 py-4 items-center min-w-[360px] sm:min-w-0">
                    <span className="text-gray-900 dark:text-white text-sm break-words">
                      {feature.name}
                    </span>
                    <div className="text-center">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XMarkIcon className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {feature.free}
                        </span>
                      )}
                    </div>
                    <div className="text-center">
                      {typeof feature.premium === 'boolean' ? (
                        feature.premium ? (
                          <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XMarkIcon className="w-5 h-5 text-gray-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          {feature.premium}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Garanti */}
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="inline-flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-6 py-4">
          <HeartIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
          <div className="text-left">
            <p className="font-semibold text-green-800 dark:text-green-300">
              14 dagars ångerrätt
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              Inte nöjd? Få pengarna tillbaka, inga frågor.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ-länk */}
      <div className="max-w-2xl mx-auto mt-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Har du frågor?{' '}
          <button 
            onClick={() => navigate('/support')}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
          >
            Kontakta oss
          </button>
        </p>
      </div>
    </div>
  );
};

export default UpgradePage;
