import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import {
  getCBTExercises,
  getCBTInsights,
  getCBTModules,
  getPersonalizedSession,
  type CBTExercise,
  type CBTInsights,
  type CBTModule,
  type PersonalizedSession,
  updateCBTProgress,
} from '../api/cbt';

interface UseCBTExercisesParams {
  userId?: string;
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
  /**
   * Whether to fetch CBT data at all. The compact recommendations panel on
   * the dashboard renders no CBT content, yet loaded modules, a session,
   * insights and exercises — four requests on every dashboard load.
   */
  enabled?: boolean;
}

export function useCBTExercises({ userId, announce, enabled = true }: UseCBTExercisesParams) {
  const { t } = useTranslation();
  const [cbtModules, setCbtModules] = useState<CBTModule[]>([]);
  const [cbtSession, setCbtSession] = useState<PersonalizedSession | null>(null);
  const [cbtInsights, setCbtInsights] = useState<CBTInsights | null>(null);
  const [cbtExercises, setCbtExercises] = useState<CBTExercise[]>([]);
  const [cbtLoading, setCbtLoading] = useState(false);
  const [cbtError, setCbtError] = useState<string | null>(null);
  const [cbtCurrentMood, setCbtCurrentMood] = useState<string>('neutral');
  const [activeCbtExerciseId, setActiveCbtExerciseId] = useState<string | null>(null);

  // Behavioral Activation exercise state
  const [baStep, setBaStep] = useState(0);
  const [baActivities, setBaActivities] = useState('');
  const [baSelectedActivity, setBaSelectedActivity] = useState('');
  const [baBarriers, setBaBarriers] = useState('');
  const [baPlan, setBaPlan] = useState('');
  const [baPleasureRating, setBaPleasureRating] = useState<number | null>(null);
  const [baReflection, setBaReflection] = useState('');

  // Worry Time exercise state
  const [wtStep, setWtStep] = useState(0);
  const [wtWorries, setWtWorries] = useState('');
  const [wtScheduledTime, setWtScheduledTime] = useState('');
  const [wtPostponeCommitted, setWtPostponeCommitted] = useState(false);
  const [wtReflection, setWtReflection] = useState('');

  const startCbtExercise = useCallback((exerciseId: string) => {
    setActiveCbtExerciseId(exerciseId);
    if (exerciseId === 'behavioral_activation') {
      setBaStep(1); setBaActivities(''); setBaSelectedActivity('');
      setBaBarriers(''); setBaPlan(''); setBaPleasureRating(null); setBaReflection('');
    } else if (exerciseId === 'worry_time') {
      setWtStep(1); setWtWorries(''); setWtScheduledTime('');
      setWtPostponeCommitted(false); setWtReflection('');
    }
  }, []);

  const completeCbtExercise = useCallback((exerciseId: string, difficultyRating: number) => {
    updateCBTProgress({
      exerciseId,
      successRate: difficultyRating <= 2 ? 0.9 : difficultyRating <= 4 ? 0.7 : 0.5,
      timeSpent: exerciseId === 'behavioral_activation' ? 20 : 25,
      difficultyRating,
    }).catch((error) => {
      logger.error('Failed to update CBT progress:', error);
    });
    setActiveCbtExerciseId(null);
    announce(t('recommendations.announce.exerciseCompleted', 'Övning slutförd! Bra jobbat!'), 'polite');
  }, [announce, t]);

  useEffect(() => {
    if (!userId || !enabled) {
      setCbtModules([]);
      setCbtSession(null);
      setCbtInsights(null);
      setCbtExercises([]);
      setCbtError(null);
      return;
    }

    let active = true;
    const loadCbtData = async () => {
      setCbtLoading(true);
      setCbtError(null);
      try {
        const [modulesResult, sessionResult, insightsResult, exercisesResult] = await Promise.allSettled([
          getCBTModules(),
          getPersonalizedSession(cbtCurrentMood),
          getCBTInsights(),
          getCBTExercises(),
        ]);

        if (!active) return;

        if (modulesResult.status === 'fulfilled') setCbtModules(modulesResult.value);
        if (sessionResult.status === 'fulfilled') setCbtSession(sessionResult.value);
        if (insightsResult.status === 'fulfilled') setCbtInsights(insightsResult.value);
        if (exercisesResult.status === 'fulfilled') setCbtExercises(exercisesResult.value);

        const hasAtLeastOneSuccess = [modulesResult, sessionResult, insightsResult, exercisesResult]
          .some((item) => item.status === 'fulfilled');

        if (!hasAtLeastOneSuccess) {
          setCbtError(t('recommendations.cbt.errorLoad', 'CBT-data kunde inte laddas just nu. Försök igen senare.'));
        }
      } catch (error) {
        logger.error('Failed to load CBT data', { error });
        if (active) {
          setCbtError(t('recommendations.cbt.errorLoadShort', 'CBT-data kunde inte laddas just nu.'));
        }
      } finally {
        if (active) {
          setCbtLoading(false);
        }
      }
    };

    loadCbtData();
    return () => {
      active = false;
    };
  }, [userId, enabled, cbtCurrentMood, t]);

  return {
    cbtModules,
    cbtSession,
    cbtInsights,
    cbtExercises,
    cbtLoading,
    cbtError,
    cbtCurrentMood,
    setCbtCurrentMood,
    activeCbtExerciseId,
    setActiveCbtExerciseId,
    startCbtExercise,
    completeCbtExercise,
    // BA state
    baStep,
    setBaStep,
    baActivities,
    setBaActivities,
    baSelectedActivity,
    setBaSelectedActivity,
    baBarriers,
    setBaBarriers,
    baPlan,
    setBaPlan,
    baPleasureRating,
    setBaPleasureRating,
    baReflection,
    setBaReflection,
    // WT state
    wtStep,
    setWtStep,
    wtWorries,
    setWtWorries,
    wtScheduledTime,
    setWtScheduledTime,
    wtPostponeCommitted,
    setWtPostponeCommitted,
    wtReflection,
    setWtReflection,
  };
}
