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

export function useUserProgress({ userId }: UseUserProgressParams) {
  const [userProgress, setUserProgress] = useState<UserProgress>({
    exercisesCompleted: 0,
    meditationMinutes: 0,
    articlesRead: 0,
    weeklyGoalProgress: 0,
  });

  const saveUserProgress = useCallback((progress: UserProgress) => {
    if (userId) {
      localStorage.setItem(`user_progress_${userId}`, JSON.stringify(progress));
      logger.debug('Saved user progress:', progress);
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
      const saved = localStorage.getItem(storageKey);
      logger.debug('📊 Raw localStorage data:', saved);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          logger.debug('📊 Parsed user progress:', parsed);
          setUserProgress(parsed);
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
