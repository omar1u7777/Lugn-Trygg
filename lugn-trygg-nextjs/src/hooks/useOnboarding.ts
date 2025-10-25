import { useState, useCallback, useEffect } from 'react';
import { trackEvent } from '../services/analytics';

const ONBOARDING_STEPS = {
  WELCOME: 0,
  GOALS: 1,
  START_JOURNEY: 2,
} as const;

const AVAILABLE_GOALS = [
  { id: 'stress', label: 'Hantera stress', icon: '😌' },
  { id: 'sleep', label: 'Bättre sömn', icon: '😴' },
  { id: 'focus', label: 'Ökad fokusering', icon: '🎯' },
  { id: 'clarity', label: 'Mental klarhet', icon: '✨' },
];

export const useOnboarding = (userId?: string) => {
  const STORAGE_KEY = `onboarding_${userId}`;

  const [currentStep, setCurrentStep] = useState(() => {
    if (!userId || typeof window === 'undefined') return ONBOARDING_STEPS.WELCOME;
    const saved = localStorage.getItem(`${STORAGE_KEY}_step`);
    return saved ? parseInt(saved, 10) : ONBOARDING_STEPS.WELCOME;
  });

  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => {
    if (!userId || typeof window === 'undefined') return [];
    const saved = localStorage.getItem(`${STORAGE_KEY}_goals`);
    return saved ? JSON.parse(saved) : [];
  });

  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (!userId || typeof window === 'undefined') return false;
    const saved = localStorage.getItem(`${STORAGE_KEY}_complete`);
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY}_complete`, JSON.stringify(onboardingComplete));
      console.log(`🎯 Onboarding status for ${userId}: ${onboardingComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    }
  }, [onboardingComplete, userId, STORAGE_KEY]);

  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY}_goals`, JSON.stringify(selectedGoals));
    }
  }, [selectedGoals, userId, STORAGE_KEY]);

  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY}_step`, currentStep.toString());
    }
  }, [currentStep, userId, STORAGE_KEY]);

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.START_JOURNEY) {
      setCurrentStep((s) => s + 1);
      trackEvent('onboarding_step_next', { userId, from_step: currentStep, to_step: currentStep + 1 });
    }
  }, [currentStep, userId]);

  const previousStep = useCallback(() => {
    if (currentStep > ONBOARDING_STEPS.WELCOME) {
      setCurrentStep((s) => s - 1);
      trackEvent('onboarding_step_previous', { userId, from_step: currentStep, to_step: currentStep - 1 });
    }
  }, [currentStep, userId]);

  const skipOnboarding = useCallback(() => {
    setOnboardingComplete(true);
    trackEvent('onboarding_skipped', { userId, at_step: currentStep });
  }, [currentStep, userId]);

  const completeOnboarding = useCallback(() => {
    setOnboardingComplete(true);
    if (userId && selectedGoals.length > 0) {
      trackEvent('onboarding_completed', { userId, selected_goals: selectedGoals, total_steps: Object.keys(ONBOARDING_STEPS).length });
    } else {
      trackEvent('onboarding_completed', { userId, total_steps: Object.keys(ONBOARDING_STEPS).length });
    }
  }, [selectedGoals, userId]);

  const toggleGoal = useCallback((goalId: string) => {
    setSelectedGoals((prev) => (prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]));
    trackEvent('onboarding_goal_toggled', { userId, goal_id: goalId });
  }, [userId]);

  return { currentStep, selectedGoals, onboardingComplete, nextStep, previousStep, skipOnboarding, completeOnboarding, toggleGoal };
};

export { ONBOARDING_STEPS, AVAILABLE_GOALS };

export default useOnboarding;
