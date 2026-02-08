/**
 * Onboarding Flow Component
 * 3-step guided tutorial for new users
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { trackEvent } from '../services/analytics';
import { CheckIcon } from '@heroicons/react/24/outline';
import { saveOnboardingGoals, skipOnboarding } from '../api/onboarding';
import OptimizedImage from './ui/OptimizedImage';
import { getOnboardingHeroImageId } from '../config/env';import { logger } from '../utils/logger';


interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  content?: React.ReactNode;
}

interface OnboardingFlowProps {
  onComplete: () => void;
  userId: string;
}

// Must match Backend ALLOWED_GOALS in onboarding_routes.py
const WELLNESS_GOALS = [
  'Hantera stress',
  'Bättre sömn',
  'Ökad fokusering',
  'Mental klarhet',
  'Ångesthantering',
  'Självkänsla',
  'Relationsstöd',
  'Arbetsbalans'
];

// Helper function to create goal selection step content dynamically
const createGoalSelectionContent = (selectedGoals: string[], toggleGoal: (goal: string) => void) => (
  <div className="space-y-4" role="region" aria-label="Goal Selection Step" tabIndex={0}>
    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
      Välj dina wellness-mål:
    </h3>
    <div className="space-y-2">
      {WELLNESS_GOALS.map((goal) => (
        <button
          key={goal}
          onClick={() => toggleGoal(goal)}
          className={`w-full px-4 py-2.5 rounded-lg border-2 font-medium transition-all duration-200 flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px] ${
            selectedGoals.includes(goal)
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span>{goal}</span>
          {selectedGoals.includes(goal) && (
            <CheckIcon className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
      <span className="text-info-500">ℹ️</span> Du kan välja ett eller flera mål
    </p>
  </div>
);

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Välkommen till Lugn & Trygg',
    description: 'Din personliga mental health-app',
    icon: '🌟',
    content: (
      <div className="space-y-4" role="region" aria-label="Welcome Step" tabIndex={0}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Hej! Vi är glada att du är här.
        </h3>
        <p className="text-base text-gray-700 dark:text-gray-300">
          Lugn & Trygg hjälper dig att hantera stress, förbättra din mental hälsa och hitta lugn i ditt dagliga liv.
        </p>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          ✨ Din personliga resa börjar här
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Med dina valda mål kommer vi att ge dig personliga rekommendationer för att stötta din mental hälsa.
        </p>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Sätt dina mål',
    description: 'Vad vill du uppnå?',
    icon: '🎯',
    content: null, // Will be set dynamically in the render
  },
  {
    id: 3,
    title: 'Starta din resa',
    description: 'Du är redo!',
    icon: '🚀',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Du är nu redo att börja!
        </h3>
        <p className="text-base text-gray-700 dark:text-gray-300">
          Börja med en kort meditation eller spåra din nuvarande humör för att få personliga rekommendationer.
        </p>
      </div>
    ),
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, userId }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const ONBOARDING_HERO_IMAGE_ID = getOnboardingHeroImageId();
  const ONBOARDING_HERO_FALLBACK_SRC = 'https://res.cloudinary.com/dxmijbysc/image/upload/c_scale,w_auto,dpr_auto,q_auto,f_auto/hero-bild_pfcdsx.jpg';
  const ONBOARDING_HERO_SIZES = '(min-width: 1280px) 380px, (min-width: 1024px) 340px, 90vw';

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) => {
      const newGoals = prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal];
      logger.debug('🎯 Goals updated:', newGoals);
      return newGoals;
    });
    trackEvent('goal_selected', { goal, userId });
  };

  const canProceedToNextStep = () => {
    // Step 2 (goal selection) requires at least one goal selected
    if (activeStep === 1) {
      const canProceed = selectedGoals.length > 0;
      logger.debug('🎯 Can proceed from step 2?', canProceed, 'Selected goals:', selectedGoals.length);
      return canProceed;
    }
    return true;
  };

  const handleNext = async () => {
    if (!canProceedToNextStep()) {
      return;
    }

    if (activeStep < ONBOARDING_STEPS.length - 1) {
      setActiveStep(activeStep + 1);
      trackEvent('onboarding_step_completed', {
        step: activeStep + 1,
        selectedGoals: activeStep === 1 ? selectedGoals : undefined,
        userId,
      });
    } else {
      // Last step - save to backend
      await handleComplete();
    }
  };

  const handleSkip = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      await skipOnboarding(userId);
      
      trackEvent('onboarding_skipped', { userId });
      
      // Mark in localStorage
      localStorage.setItem(`onboarding_${userId}_complete`, 'true');
      
      onComplete();
    } catch (error) {
      logger.error('❌ Failed to skip onboarding:', error);
      // Continue anyway - don't block user
      trackEvent('onboarding_skipped', { userId });
      localStorage.setItem(`onboarding_${userId}_complete`, 'true');
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    logger.debug('🎯 ONBOARDING - Complete clicked', {
      currentStep,
      selectedGoals,
      userId
    });
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      logger.debug('💾 ONBOARDING - Saving goals to backend...');
      // Save goals to backend
      const result = await saveOnboardingGoals(userId, selectedGoals);
      logger.debug('✅ ONBOARDING - Goals saved successfully:', result);
      
      trackEvent('onboarding_completed', { 
        userId,
        goals: selectedGoals,
        goalCount: selectedGoals.length
      });
      
      // Mark in localStorage
      localStorage.setItem(`onboarding_${userId}_complete`, 'true');
      
      onComplete();
    } catch (error) {
      logger.error('❌ Failed to save goals:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save goals');
      setIsSaving(false);
      
      // Don't block user - show error but allow retry
      // User can click "Starta" again to retry
    }
  };

  const currentStep = ONBOARDING_STEPS[activeStep];
  
  if (!currentStep) {
    return null;
  }

  // For goal selection step, create dynamic content
  const stepContent = activeStep === 1 
    ? createGoalSelectionContent(selectedGoals, toggleGoal)
    : currentStep.content;
  
  const progress = ((activeStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-primary-50 via-secondary-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-subtitle"
    >
      {/* Main content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2">
          <div
            className="h-2 bg-gradient-to-r from-primary-600 to-secondary-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
            <div>
              {/* Step indicator */}
              <div className="mb-6">
                <p 
                  className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  Steg {activeStep + 1} av {ONBOARDING_STEPS.length}
                </p>
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="min-h-[200px]"
                >
                  <div 
                    className="text-5xl mb-3"
                    role="img"
                    aria-label={`Step ${activeStep + 1}: ${currentStep.title}`}
                  >
                    {currentStep.icon}
                  </div>
                  <h2 
                    id="onboarding-title"
                    className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2"
                  >
                    {currentStep.title}
                  </h2>
                  <p 
                    id="onboarding-subtitle"
                    className="text-base text-gray-600 dark:text-gray-400 mb-6"
                  >
                    {currentStep.description}
                  </p>
                  
                  {/* Error display */}
                  {saveError && (
                    <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg">
                      <p className="text-sm text-error-800 dark:text-error-300">
                        ❌ {saveError}
                      </p>
                      <p className="text-xs text-error-700 dark:text-error-400 mt-1">
                        Försök igen eller hoppa över
                      </p>
                    </div>
                  )}
                  
                  {stepContent}
                </motion.div>
              </AnimatePresence>

              {/* Stepper dots */}
              <div 
                className="flex items-center justify-center gap-2 my-6"
                aria-label="Onboarding steps"
              >
                {ONBOARDING_STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${
                      activeStep === idx
                        ? 'bg-primary-600 text-white scale-110'
                        : activeStep > idx
                        ? 'bg-success-700 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                    aria-label={`Step ${idx + 1}: ${step.title}`}
                    aria-current={activeStep === idx ? 'step' : undefined}
                  >
                    {activeStep > idx ? <CheckIcon className="w-5 h-5" /> : step.id}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={handleSkip}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
                >
                  Hoppa över
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedToNextStep() || isSaving}
                  className="w-full sm:flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px] flex items-center justify-center gap-2 order-1 sm:order-2"
                  aria-label={activeStep === 1 && selectedGoals.length === 0 ? 'Välj minst ett mål för att fortsätta' : undefined}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Sparar...</span>
                    </>
                  ) : activeStep === 1 ? (
                    <span>Nästa {selectedGoals.length > 0 ? `(${selectedGoals.length} mål valda)` : '(Välj minst 1 mål)'}</span>
                  ) : (
                    <span>{activeStep === ONBOARDING_STEPS.length - 1 ? 'Starta' : 'Nästa'}</span>
                  )}
                </button>
              </div>

              {/* Mobile hero */}
              <div className="lg:hidden mt-8" aria-hidden="true">
                <div className="relative rounded-[28px] border border-white/60 dark:border-white/10 overflow-hidden shadow-xl">
                  <OptimizedImage
                    src={ONBOARDING_HERO_IMAGE_ID}
                    alt="Illustration av onboardingresan"
                    width={360}
                    height={320}
                    sizes="100vw"
                    placeholder="blur"
                    fallbackSrc={ONBOARDING_HERO_FALLBACK_SRC}
                    priority
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>

            {/* Desktop hero */}
            <div className="hidden lg:block" aria-hidden="true">
              <div className="relative">
                <div className="absolute inset-6 blur-3xl bg-gradient-to-br from-primary-200/70 via-secondary-200/60 to-amber-200/60 dark:from-primary-500/30 dark:via-secondary-500/30 dark:to-amber-500/30 -z-10 rounded-[40px]"></div>
                <div className="relative rounded-[32px] border border-white/70 dark:border-white/10 overflow-hidden shadow-2xl">
                  <OptimizedImage
                    src={ONBOARDING_HERO_IMAGE_ID}
                    alt="Illustration av onboardingresan"
                    width={420}
                    height={360}
                    sizes={ONBOARDING_HERO_SIZES}
                    placeholder="blur"
                    fallbackSrc={ONBOARDING_HERO_FALLBACK_SRC}
                    priority
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;


