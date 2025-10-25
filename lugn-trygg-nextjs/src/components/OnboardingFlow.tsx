import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Step,
  Stepper,
  StepLabel,
  Card,
  LinearProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { trackEvent } from '../services/analytics';

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

const WELLNESS_GOALS = ['Hantera stress', 'Bättre sömn', 'Ökad fokusering', 'Mental klarhet'];

const createGoalSelectionContent = (selectedGoals: string[], toggleGoal: (goal: string) => void) => (
  <Box role="region" aria-label="Goal Selection Step" tabIndex={0}>
    <Typography variant="h6" gutterBottom>
      Välj dina wellness-mål:
    </Typography>
    <Box>
      {WELLNESS_GOALS.map((goal) => (
        <Button
          key={goal}
          variant={selectedGoals.includes(goal) ? 'contained' : 'outlined'}
          onClick={() => toggleGoal(goal)}
          fullWidth
          sx={{
            mb: 1,
            backgroundColor: selectedGoals.includes(goal) ? '#3f51b5' : 'transparent',
            color: selectedGoals.includes(goal) ? 'white' : 'inherit',
            borderColor: selectedGoals.includes(goal) ? '#3f51b5' : '#ccc',
            '&:hover': {
              backgroundColor: selectedGoals.includes(goal) ? '#303f9f' : '#f5f5f5',
            },
          }}
        >
          {goal} {selectedGoals.includes(goal) ? '✓' : ''}
        </Button>
      ))}
    </Box>
    <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary' }}>
      ℹ️ Du kan välja ett eller flera mål
    </Typography>
  </Box>
);

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Välkommen till Lugn & Trygg',
    description: 'Din personliga mental health-app',
    icon: '🌟',
    content: (
      <Box role="region" aria-label="Welcome Step" tabIndex={0}>
        <Typography variant="h6" gutterBottom>
          Hej! Vi är glada att du är här.
        </Typography>
        <Typography variant="body2">
          Lugn & Trygg hjälper dig att hantera stress, förbättra din mental hälsa och hitta lugn i ditt dagliga liv.
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          <strong>✨ Din personliga resa börjar här</strong>
        </Typography>
        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
          Med dina valda mål kommer vi att ge dig personliga rekommendationer för att stötta din mental hälsa.
        </Typography>
      </Box>
    ),
  },
  {
    id: 2,
    title: 'Sätt dina mål',
    description: 'Vad vill du uppnå?',
    icon: '🎯',
    content: null,
  },
  {
    id: 3,
    title: 'Starta din resa',
    description: 'Du är redo!',
    icon: '🚀',
    content: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Du är nu redo att börja!
        </Typography>
        <Typography variant="body2">
          Börja med en kort meditation eller spåra din nuvarande humör för att få personliga rekommendationer.
        </Typography>
      </Box>
    ),
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, userId }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
    trackEvent('goal_selected', { goal, userId });
  };

  const canProceedToNextStep = () => {
    if (activeStep === 1) {
      return selectedGoals.length > 0;
    }
    return true;
  };

  const handleNext = () => {
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
      handleComplete();
    }
  };

  const handleSkip = () => {
    trackEvent('onboarding_skipped', { userId });
    onComplete();
  };

  const handleComplete = () => {
    trackEvent('onboarding_completed', { userId });
    onComplete();
  };

  const currentStep = ONBOARDING_STEPS[activeStep];
  if (!currentStep) return null;
  const stepContent = activeStep === 1 ? createGoalSelectionContent(selectedGoals, toggleGoal) : currentStep.content;
  const progress = ((activeStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <Box role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-subtitle">
      <Card elevation={3}>
        <LinearProgress variant="determinate" value={progress} />
        <Box>
          <Typography aria-live="polite" aria-atomic="true">
            Steg {activeStep + 1} av {ONBOARDING_STEPS.length}
          </Typography>
        </Box>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <Box role="img" aria-label={`Step ${activeStep + 1}: ${currentStep.title}`}>
              {currentStep.icon}
            </Box>
            <Typography id="onboarding-title" variant="h5" gutterBottom>
              {currentStep.title}
            </Typography>
            <Typography id="onboarding-subtitle" variant="subtitle2" gutterBottom>
              {currentStep.description}
            </Typography>
            {stepContent}
          </motion.div>
        </AnimatePresence>
        <Stepper activeStep={activeStep} aria-label="Onboarding steps">
          {ONBOARDING_STEPS.map((step, idx) => (
            <Step key={step.id} aria-label={`Step ${idx + 1}: ${step.title}`} aria-current={activeStep === idx ? 'step' : undefined}>
              <StepLabel>{step.id}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <Box>
          <Button variant="text" onClick={handleSkip}>Hoppa över</Button>
          <Button variant="contained" onClick={handleNext} fullWidth disabled={!canProceedToNextStep()}>
            {activeStep === ONBOARDING_STEPS.length - 1 ? 'Starta' : 'Nästa'}
          </Button>
        </Box>
      </Card>
    </Box>
  );
};

export default OnboardingFlow;
