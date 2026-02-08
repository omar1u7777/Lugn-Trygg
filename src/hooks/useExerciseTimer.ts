import { useState, useEffect, useRef, useCallback } from 'react';

interface UseExerciseTimerOptions {
    onComplete?: () => void;
    onTick?: (seconds: number) => void;
    countdown?: boolean;
}

export const useExerciseTimer = (initialSeconds: number = 0, options: UseExerciseTimerOptions = {}) => {
    const { countdown = true } = options;
    const [time, setTime] = useState(initialSeconds);
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const start = useCallback(() => {
        setIsActive(true);
        setIsPaused(false);
    }, []);

    const pause = useCallback(() => {
        setIsPaused(true);
    }, []);

    const resume = useCallback(() => {
        setIsPaused(false);
    }, []);

    const stop = useCallback(() => {
        setIsActive(false);
        setIsPaused(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const reset = useCallback((newSeconds?: number) => {
        stop();
        setTime(newSeconds !== undefined ? newSeconds : initialSeconds);
    }, [initialSeconds, stop]);

    useEffect(() => {
        if (isActive && !isPaused) {
            timerRef.current = setInterval(() => {
                setTime(prev => {
                    const next = countdown ? prev - 1 : prev + 1;

                    if (options.onTick) {
                        options.onTick(next);
                    }

                    if (countdown && next <= 0) {
                        stop();
                        if (options.onComplete) {
                            options.onComplete();
                        }
                        return 0;
                    }

                    return next;
                });
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isActive, isPaused, countdown, options, stop]);

    return {
        time,
        isActive,
        isPaused,
        start,
        pause,
        resume,
        stop,
        reset,
        setTime
    };
};
