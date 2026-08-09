import { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';

interface UserProgress {
  exercisesCompleted: number;
  meditationMinutes: number;
  articlesRead: number;
  weeklyGoalProgress: number;
}

interface UseUserProgressParams {
  userId?: string;
}

const EMPTY_PROGRESS: UserProgress = {
  exercisesCompleted: 0,
  meditationMinutes: 0,
  articlesRead: 0,
  weeklyGoalProgress: 0,
};

/** Keeps only finite non-negative numbers, so a corrupted entry costs the user
 *  one counter rather than turning every total into NaN. */
const toUserProgress = (value: unknown): UserProgress => {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_PROGRESS };
  const record = value as Record<string, unknown>;
  const num = (key: keyof UserProgress): number => {
    const raw = record[key];
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
  };
  return {
    exercisesCompleted: num('exercisesCompleted'),
    meditationMinutes: num('meditationMinutes'),
    articlesRead: num('articlesRead'),
    weeklyGoalProgress: num('weeklyGoalProgress'),
  };
};

export function useUserProgress({ userId }: UseUserProgressParams) {
  const [userProgress, setUserProgress] = useState<UserProgress>({ ...EMPTY_PROGRESS });

  const saveUserProgress = useCallback((progress: UserProgress) => {
    if (userId) {
      try {
        localStorage.setItem(`user_progress_${userId}`, JSON.stringify(progress));
        logger.debug('Saved user progress:', progress);
      } catch (error) {
        // setItem throws on a full quota and in Safari private mode. This runs
        // inside a setState updater, so an unhandled throw took the whole page
        // down as the user completed an exercise. Losing the counter is bad;
        // crashing on the reward for finishing something is worse.
        logger.error('Failed to save user progress:', error);
      }
    }
  }, [userId]);

  const updateProgress = useCallback((type: string, amount?: number) => {
    logger.debug('📊 UPDATE PROGRESS called:', { type, amount, userId });
    setUserProgress(prev => {
      const newProgress = { ...prev };

      switch (type) {
        case 'exercise':
          newProgress.exercisesCompleted += amount ?? 1;
          logger.debug('📊 Exercise completed, new count:', newProgress.exercisesCompleted);
          break;
        case 'meditation':
          newProgress.meditationMinutes += amount ?? 0;
          logger.debug('📊 Meditation minutes added', {
            addedMinutes: amount,
            totalMinutes: newProgress.meditationMinutes,
          });
          break;
        case 'article':
          newProgress.articlesRead += amount ?? 1;
          logger.debug('📊 Article read, new count:', newProgress.articlesRead);
          break;
      }

      newProgress.weeklyGoalProgress = Math.min((newProgress.exercisesCompleted / 7) * 100, 100);

      logger.debug('📊 New progress state:', newProgress);
      saveUserProgress(newProgress);
      return newProgress;
    });
  }, [userId, saveUserProgress]);

  const loadUserProgress = useCallback(() => {
    logger.debug('📊 LOAD USER PROGRESS called, user:', userId);
    if (userId) {
      const storageKey = `user_progress_${userId}`;
      logger.debug('📊 Loading from localStorage key:', storageKey);
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(storageKey);
      } catch (error) {
        // getItem throws too when storage is blocked entirely.
        logger.error('Failed to read user progress:', error);
      }
      logger.debug('📊 Raw localStorage data:', saved);
      if (saved) {
        try {
          const parsed: unknown = JSON.parse(saved);
          // JSON.parse succeeding does not mean the shape is right. A corrupted
          // or older entry used to be trusted wholesale, and the first
          // `+= 1` on a missing counter turned the user's totals into NaN,
          // which then rendered as "NaN övningar" with no way back.
          setUserProgress(toUserProgress(parsed));
        } catch (error) {
          logger.error('Failed to load user progress:', error);
        }
      } else {
        logger.debug('📊 No saved progress found in localStorage');
      }
    } else {
      logger.debug('📊 No user ID available for loading progress');
    }
  }, [userId]);

  useEffect(() => {
    loadUserProgress();
  }, [loadUserProgress]);

  return {
    userProgress,
    setUserProgress,
    saveUserProgress,
    updateProgress,
    loadUserProgress,
  };
}
