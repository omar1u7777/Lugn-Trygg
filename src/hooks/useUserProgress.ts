import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { getActivityProgress, saveActivityProgress, type ActivityProgress } from '../api/dashboard';

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

  /** Push counters to the server. The server keeps the higher of each value,
   *  so a failed push costs nothing beyond a delay — the next one carries the
   *  same totals. Deliberately not awaited: finishing an exercise should not
   *  wait on the network, and it must not fail because the network did. */
  const syncUp = useCallback((progress: UserProgress) => {
    if (!userId) return;
    const { exercisesCompleted, meditationMinutes, articlesRead } = progress;
    saveActivityProgress({ exercisesCompleted, meditationMinutes, articlesRead }).catch((error) => {
      logger.error('Failed to sync activity progress:', error);
    });
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
      syncUp(newProgress);
      return newProgress;
    });
  }, [userId, saveUserProgress, syncUp]);

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

  // localStorage is read first because it is instant and offline-safe, then
  // reconciled with the server so a second device sees the same totals.
  const syncedForUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return;
    syncedForUser.current = userId;

    let cancelled = false;
    const controller = new AbortController();

    getActivityProgress(controller.signal)
      .then((remote: ActivityProgress) => {
        if (cancelled) return;
        setUserProgress((local) => {
          // Take the higher of each counter, matching what the server does.
          // Neither side is authoritative: the server may hold work from
          // another device, and this device may hold work not pushed yet.
          const merged: UserProgress = {
            exercisesCompleted: Math.max(local.exercisesCompleted, remote.exercisesCompleted ?? 0),
            meditationMinutes: Math.max(local.meditationMinutes, remote.meditationMinutes ?? 0),
            articlesRead: Math.max(local.articlesRead, remote.articlesRead ?? 0),
            weeklyGoalProgress: 0,
          };
          merged.weeklyGoalProgress = Math.min((merged.exercisesCompleted / 7) * 100, 100);
          saveUserProgress(merged);
          // Only push when this device is ahead, so a plain page load does
          // not write anything the server does not already know.
          if (
            merged.exercisesCompleted > (remote.exercisesCompleted ?? 0) ||
            merged.meditationMinutes > (remote.meditationMinutes ?? 0) ||
            merged.articlesRead > (remote.articlesRead ?? 0)
          ) {
            syncUp(merged);
          }
          return merged;
        });
      })
      .catch((error) => {
        if (cancelled) return;
        // Keep whatever localStorage gave us. Progress the user can see is
        // better than a spinner, and the next update will push it up.
        logger.error('Could not load activity progress from server:', error);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, saveUserProgress, syncUp]);

  return {
    userProgress,
    setUserProgress,
    saveUserProgress,
    updateProgress,
    loadUserProgress,
  };
}
