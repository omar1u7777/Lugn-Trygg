/**
 * PremiumGate - Komponent som begränsar tillgång till premium-funktioner
 * 
 * Visar ett uppgraderingsmeddelande för gratisanvändare som försöker 
 * komma åt premium-funktioner.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, type SubscriptionFeatures, type SubscriptionTier } from '@/contexts/SubscriptionContext';
import { LockClosedIcon, SparklesIcon, CheckIcon } from '@heroicons/react/24/outline';

// Typ för feature-namn
export type FeatureName = keyof SubscriptionFeatures;

interface PremiumGateProps {
  /** Funktionen som krävs för åtkomst */
  feature: FeatureName;
  /** Innehållet som visas om användaren har tillgång */
  children?: React.ReactNode;
  /** Valfri titel för uppgraderingsmeddelandet */
  title?: string;
  /** Valfri beskrivning */
  description?: string;
  /** Om true, visar innehållet suddigt bakom låset */
  showBlurredPreview?: boolean;
}

/** Premium-fördelar att visa i uppgraderingsboxen */
const PREMIUM_BENEFITS = [
  'Obegränsade humörloggningar',
  'Obegränsade AI-chattmeddelanden',
  'Full historik (inte bara 7 dagar)',
  'Lugnande ljud & meditationer',
  'Djupgående insikter & analyser',
  'Personlig dagbok',
  'Belöningar & gamification',
  'Sociala funktioner',
  'Exportera din data',
  'Röstchatt med AI',
];

/** Funktionsnamn på svenska */
const FEATURE_NAMES: Record<FeatureName, string> = {
  voiceChat: 'Röstchatt',
  sounds: 'Lugnande ljud',
  analytics: 'Analyser',
  insights: 'Insikter',
  journal: 'Dagbok',
  gamification: 'Belöningar',
  social: 'Sociala funktioner',
  export: 'Dataexport',
  aiStories: 'AI-berättelser',
  recommendations: 'Rekommendationer',
  wellness: 'Välmåendehubben',
};

const PLAN_LABELS: Record<SubscriptionTier, string> = {
  free: 'Gratis',
  premium: 'Premium',
  trial: 'Testperiod',
  enterprise: 'Enterprise',
};

export const PremiumGate: React.FC<PremiumGateProps> = ({
  feature,
  children,
  title,
  description,
  showBlurredPreview = false,
}) => {
  const { hasFeature, plan, loading } = useSubscription();
  const navigate = useNavigate();

  // Visa laddningsindikator medan vi kollar prenumeration
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Om användaren har tillgång, visa innehållet
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Standardmeddelanden
  const featureName = FEATURE_NAMES[feature] || feature;
  const defaultTitle = `${featureName} är en Premium-funktion`;
  const defaultDescription = `Uppgradera till Premium för att få tillgång till ${String(featureName).toLowerCase()} och mycket mer.`;

  return (
    <div className="relative min-h-[400px]">
      {/* Suddig förhandsvisning om aktiverad */}
      {showBlurredPreview && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="filter blur-lg opacity-30 pointer-events-none">
            {children}
          </div>
        </div>
      )}

      {/* Uppgraderingsbox */}
      <div className="relative z-10 flex items-center justify-center min-h-[400px] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          {/* Ikon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center mb-6">
            <LockClosedIcon className="w-8 h-8 text-white" />
          </div>

          {/* Titel */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {title || defaultTitle}
          </h2>

          {/* Beskrivning */}
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {description || defaultDescription}
          </p>

          {/* Premium-fördelar */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-gray-900 dark:text-white">
                Premium inkluderar:
              </span>
            </div>
            <ul className="space-y-2">
              {PREMIUM_BENEFITS.slice(0, 5).map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {benefit}
                </li>
              ))}
              <li className="text-sm text-gray-500 dark:text-gray-400 italic pl-6">
                ...och mycket mer
              </li>
            </ul>
          </div>

          {/* Pris */}
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              99 kr<span className="text-lg font-normal text-gray-500">/månad</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Avsluta när du vill
            </p>
          </div>

          {/* Knappar */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/upgrade')}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Uppgradera till Premium
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-2 transition-colors"
            >
              Gå tillbaka
            </button>
          </div>

          {/* Nuvarande plan */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Din nuvarande plan: <span className="font-medium">{PLAN_LABELS[plan.tier]}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook för att enkelt kolla om en funktion är tillgänglig
 * och visa ett meddelande om den inte är det
 */
export const usePremiumFeature = (feature: FeatureName) => {
  const { hasFeature, plan } = useSubscription();
  const hasAccess = hasFeature(feature);

  return {
    hasAccess,
    isPremium: plan.tier === 'premium',
    featureName: FEATURE_NAMES[feature] || feature,
  };
};

export default PremiumGate;
