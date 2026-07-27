import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseWellnessTimerOptions {
  /** Called exactly once when the countdown reaches zero. Latest closure is
   *  always invoked — safe to pass an inline arrow on every render. */
  onComplete?: () => void;
}

export interface WellnessTimer {
  /** Seconds remaining in the countdown. */
  timeLeft: number;
  /** Whether an interval is currently ticking. */
  isRunning: boolean;
  /** Begin a countdown from `seconds`. Any previous interval is cleared first. */
  start: (seconds: number) => void;
  /** Halt ticking, preserving timeLeft. */
  pause: () => void;
  /** Resume ticking from the current timeLeft. */
  resume: () => void;
  /** Halt ticking and reset timeLeft to zero. */
  stop: () => void;
}

/**
 * Single-owner countdown timer for wellness sessions.
 *
 * Replaces the hand-rolled `setInterval` + ref bookkeeping that was duplicated
 * across meditation, sleep-story and exercise components. Guarantees:
 * - at most ONE live interval per hook instance (start/resume defensively clear),
 * - the interval is cleared on unmount,
 * - onComplete always sees the latest closure (no stale-callback refs needed).
 */
export function useWellnessTimer(options: UseWellnessTimerOptions = {}): WellnessTimer {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const beginTick = useCallback(() => {
    // Defensive clear: a double start/resume must never leak a second interval
    // (the historical 2×-speed countdown bug).
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setIsRunning(true);
  }, []);

  const start = useCallback((seconds: number) => {
    setTimeLeft(seconds);
    beginTick();
  }, [beginTick]);

  const stop = useCallback(() => {
    clearTick();
    setTimeLeft(0);
  }, [clearTick]);

  useEffect(() => clearTick, [clearTick]);

  return {
    timeLeft,
    isRunning,
    start,
    pause: clearTick,
    resume: beginTick,
    stop,
  };
}

export default useWellnessTimer;
