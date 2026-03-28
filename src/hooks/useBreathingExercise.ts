import { useState, useCallback, useEffect, useRef } from 'react';
import { useExerciseTimer } from './useExerciseTimer';
import { BREATHING_PHASES } from '../constants/recommendations';

export type BreathingPhase = 'prepare' | 'exhale' | 'inhale' | 'hold' | 'exhale2' | 'rest' | 'completed';

export const useBreathingExercise = (options: {
    onComplete?: (cycleCount: number) => void;
    onPhaseChange?: (phase: BreathingPhase, instruction: string, secondsLeft?: number) => void;
    targetCycles?: number;
} = {}) => {
    const { onComplete, onPhaseChange, targetCycles: targetCyclesOption } = options;
    const [phase, setPhase] = useState<BreathingPhase>('rest');
    const [cycleCount, setCycleCount] = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(0);
    const completionTriggeredRef = useRef(false);
    const callbacksRef = useRef({ onComplete, onPhaseChange });

    const cycleTotalTime = BREATHING_PHASES.reduce((sum, p) => sum + p.duration, 0);
    const targetCycles = targetCyclesOption ?? 4;

    useEffect(() => {
        callbacksRef.current = { onComplete, onPhaseChange };
    }, [onComplete, onPhaseChange]);

    const onTick = useCallback((seconds: number) => {
        setTotalSeconds(seconds);
    }, []);

    const {
        isActive,
        isPaused,
        start: startTimer,
        pause: pauseTimer,
        resume: resumeTimer,
        stop: stopTimer
    } = useExerciseTimer(0, {
        countdown: false,
        onTick
    });

    useEffect(() => {
        if (!isActive) return;

        if (totalSeconds === 0) return;

        const completedCycles = Math.floor(totalSeconds / cycleTotalTime);
        if (completedCycles !== cycleCount) {
            setCycleCount(completedCycles);
        }

        if (completedCycles >= targetCycles) {
            if (!completionTriggeredRef.current) {
                completionTriggeredRef.current = true;
                stopTimer();
                setPhase('completed');
                setPhaseSecondsLeft(0);
                callbacksRef.current.onComplete?.(completedCycles);
            }
            return;
        }

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
            callbacksRef.current.onPhaseChange?.(nextPhaseName, currentPhase.instruction, secondsLeft);
        }
    }, [cycleCount, totalSeconds, isActive, cycleTotalTime, phase, stopTimer, targetCycles]);

    const start = useCallback(() => {
        completionTriggeredRef.current = false;
        setCycleCount(0);
        setTotalSeconds(0);
        setPhase('exhale');
        setPhaseSecondsLeft(BREATHING_PHASES[0].duration);
        startTimer();
        callbacksRef.current.onPhaseChange?.(
            BREATHING_PHASES[0].name as BreathingPhase,
            BREATHING_PHASES[0].instruction,
            BREATHING_PHASES[0].duration
        );
    }, [startTimer]);

    const stop = useCallback(() => {
        completionTriggeredRef.current = false;
        stopTimer();
        setPhase('rest');
        setCycleCount(0);
        setTotalSeconds(0);
        setPhaseSecondsLeft(0);
    }, [stopTimer]);

    const pause = useCallback(() => {
        pauseTimer();
    }, [pauseTimer]);

    const resume = useCallback(() => {
        resumeTimer();
    }, [resumeTimer]);

    return {
        isActive,
        isPaused,
        phase,
        cycleCount,
        totalSeconds,
        phaseSecondsLeft,
        targetCycles,
        start,
        pause,
        resume,
        stop
    };
};
