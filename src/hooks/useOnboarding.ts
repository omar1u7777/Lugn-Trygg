import { useState, useCallback, useEffect } from 'react';
import { trackEvent } from '../services/analytics';

interface UseOnboardingReturn {
  currentStep: number;
  selectedGoals: string[];
  onboardingComplete: boolean;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  toggleGoal: (goal: string) => void;
}

const ONBOARDING_STEPS = {
  WELCOME: 0,
  GOALS: 1,
  START_JOURNEY: 2,
};

const AVAILABLE_GOALS = [
  { id: 'stress', label: 'Hantera stress', icon: '😌' },
  { id: 'sleep', label: 'Bättre sömn', icon: '😴' },
  { id: 'focus', label: 'Ökad fokusering', icon: '🎯' },
  { id: 'clarity', label: 'Mental klarhet', icon: '✨' },
];

/**
 * Hook for managing onboarding flow state with localStorage persistence
 * Onboarding is shown only ONCE per user - when onboardingComplete is true,
 * it will never show again unless user data is cleared
 */
export const useOnboarding = (userId?: string): UseOnboardingReturn => {
  const STORAGE_KEY = `onboarding_${userId}`;
  
  // Initialize from localStorage if available
  const [currentStep, setCurrentStep] = useState(() => {
    if (!userId) return ONBOARDING_STEPS.WELCOME;
    const saved = localStorage.getItem(`${STORAGE_KEY}_step`);
    return saved ? parseInt(saved, 10) : ONBOARDING_STEPS.WELCOME;
  });

  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => {
    if (!userId) return [];
    const saved = localStorage.getItem(`${STORAGE_KEY}_goals`);
    return saved ? JSON.parse(saved) : [];
  });

  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (!userId) return false;
    const saved = localStorage.getItem(`${STORAGE_KEY}_complete`);
    // Parse as boolean - if localStorage has the key, user completed onboarding
    return saved ? JSON.parse(saved) : false;
  });

  // Save onboardingComplete to localStorage whenever it changes
  // This persists across all future sessions for this user
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY}_complete`, JSON.stringify(onboardingComplete));
      // Log for debugging
      console.log(`🎯 Onboarding status for ${userId}: ${onboardingComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    }
  }, [onboardingComplete, userId, STORAGE_KEY]);

  // Save selectedGoals to localStorage whenever they change
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY}_goals`, JSON.stringify(selectedGoals));
    }
  }, [selectedGoals, userId, STORAGE_KEY]);

  // Save currentStep to localStorage whenever it changes
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY}_step`, currentStep.toString());
    }
  }, [currentStep, userId, STORAGE_KEY]);

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.START_JOURNEY) {
      setCurrentStep(currentStep + 1);
      trackEvent('onboarding_step_next', {
        userId,
        from_step: currentStep,
        to_step: currentStep + 1,
      });
    }
  }, [currentStep, userId]);

  const previousStep = useCallback(() => {
    if (currentStep > ONBOARDING_STEPS.WELCOME) {
      setCurrentStep(currentStep - 1);
      trackEvent('onboarding_step_previous', {
        userId,
        from_step: currentStep,
        to_step: currentStep - 1,
      });
    }
  }, [currentStep, userId]);

  const skipOnboarding = useCallback(() => {
    setOnboardingComplete(true);
    trackEvent('onboarding_skipped', {
      userId,
      at_step: currentStep,
    });
  }, [currentStep, userId]);

  const completeOnboarding = useCallback(() => {
    setOnboardingComplete(true);
    // Also save selected goals to user profile via API (optional)
    if (userId && selectedGoals.length > 0) {
      trackEvent('onboarding_completed', {
        userId,
        selected_goals: selectedGoals,
        total_steps: Object.keys(ONBOARDING_STEPS).length,
      });
    } else {
      trackEvent('onboarding_completed', {
        userId,
        total_steps: Object.keys(ONBOARDING_STEPS).length,
      });
    }
  }, [selectedGoals, userId]);

  const toggleGoal = useCallback(
    (goalId: string) => {
      setSelectedGoals((prev) => {
        if (prev.includes(goalId)) {
          return prev.filter((g) => g !== goalId);
        } else {
          return [...prev, goalId];
        }
      });

      trackEvent('onboarding_goal_toggled', {
        userId,
        goal_id: goalId,
      });
    },
    [userId]
  );

  return {
    currentStep,
    selectedGoals,
    onboardingComplete,
    nextStep,
    previousStep,
    skipOnboarding,
    completeOnboarding,
    toggleGoal,
  };
};

export { ONBOARDING_STEPS, AVAILABLE_GOALS };
export default useOnboarding;
