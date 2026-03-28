import { useState, useCallback, useEffect } from 'react';
import { useExerciseTimer } from './useExerciseTimer';
import { BREATHING_PHASES } from '../constants/recommendations';

export type BreathingPhase = 'prepare' | 'exhale' | 'inhale' | 'hold' | 'exhale2' | 'rest' | 'completed';

export const useBreathingExercise = (options: {
    onComplete?: (cycleCount: number) => void;
    onPhaseChange?: (phase: BreathingPhase, instruction: string, secondsLeft?: number) => void;
    targetCycles?: number;
} = {}) => {
    const [phase, setPhase] = useState<BreathingPhase>('rest');
    const [cycleCount, setCycleCount] = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(0);

    const cycleTotalTime = BREATHING_PHASES.reduce((sum, p) => sum + p.duration, 0);
    const targetCycles = options.targetCycles ?? 4;

    const onTick = useCallback((seconds: number) => {
        setTotalSeconds(seconds);
    }, []);

    const { isActive, start: startTimer, stop: stopTimer } = useExerciseTimer(0, {
        countdown: false,
        onTick
    });

    useEffect(() => {
        if (!isActive) return;

        if (totalSeconds === 0) return;

        const currentCycleTime = ((totalSeconds - 1) % cycleTotalTime) + 1;

        // Find current phase
        let elapsed = 0;
        let currentPhase = BREATHING_PHASES[0];
        for (const p of BREATHING_PHASES) {
            if (currentCycleTime <= elapsed + p.duration) {
                currentPhase = p;
                break;
            }
            elapsed += p.duration;
        }

        const elapsedInPhase = currentCycleTime - elapsed;
        const secondsLeft = Math.max(currentPhase.duration - elapsedInPhase + 1, 0);
        setPhaseSecondsLeft(secondsLeft);

        if (phase !== (currentPhase.name as BreathingPhase)) {
            const nextPhaseName = currentPhase.name as BreathingPhase;
            setPhase(nextPhaseName);
            if (options.onPhaseChange) {
                options.onPhaseChange(nextPhaseName, currentPhase.instruction, secondsLeft);
            }
        }

        if (currentCycleTime === cycleTotalTime) {
            setCycleCount(prev => {
                const next = prev + 1;
                if (next >= targetCycles) {
                    stopTimer();
                    setPhase('completed');
                    setPhaseSecondsLeft(0);
                    if (options.onComplete) options.onComplete(next);
                }
                return next;
            });
        }
    }, [totalSeconds, isActive, cycleTotalTime, phase, options, stopTimer, targetCycles]);

    const start = useCallback(() => {
        setCycleCount(0);
        setTotalSeconds(0);
        setPhase('exhale');
        setPhaseSecondsLeft(BREATHING_PHASES[0].duration);
        startTimer();
        if (options.onPhaseChange) {
            options.onPhaseChange(
                BREATHING_PHASES[0].name as BreathingPhase,
                BREATHING_PHASES[0].instruction,
                BREATHING_PHASES[0].duration
            );
        }
    }, [startTimer, options]);

    const stop = useCallback(() => {
        stopTimer();
        setPhase('rest');
        setCycleCount(0);
        setTotalSeconds(0);
        setPhaseSecondsLeft(0);
    }, [stopTimer]);

    return {
        isActive,
        phase,
        cycleCount,
        totalSeconds,
        phaseSecondsLeft,
        targetCycles,
        start,
        stop
    };
};
