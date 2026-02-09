import { useState, useCallback, useEffect, useRef } from 'react';
import { muscleGroups } from '../constants/recommendations';

export type PMRPhase = 'prepare' | 'tense' | 'relax' | 'completed';

interface UsePMROptions {
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    customTiming: { tense: number; relax: number };
    onComplete?: (duration: number, muscleGroupsCount: number) => void;
    onPhaseChange?: (phase: PMRPhase, muscleGroup: any, timeLeft: number) => void;
}

export const usePMR = ({ difficulty, customTiming, onComplete, _onPhaseChange }: UsePMROptions) => {
    const [isActive, setIsActive] = useState(false);
    const [phase, setPhase] = useState<PMRPhase>('prepare');
    const [currentMuscleGroupIndex, setCurrentMuscleGroupIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);

    // Refs to track state inside closure-based intervals if needed, but we'll use clean useEffect
    const sessionStartTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate timing based on difficulty
    const getTiming = useCallback(() => {
        if (difficulty === 'beginner') return { tense: 5, relax: 10 };
        if (difficulty === 'intermediate') return { tense: 7, relax: 15 };
        if (difficulty === 'advanced') return { tense: 10, relax: 20 };
        return customTiming;
    }, [difficulty, customTiming]);

    const stop = useCallback(() => {
        setIsActive(false);
        setPhase('prepare');
        setCurrentMuscleGroupIndex(0);
        setTimeLeft(0);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const start = useCallback(() => {
        // Clear any existing timer
        if (timerRef.current) clearInterval(timerRef.current);

        setIsActive(true);
        setPhase('prepare');
        setCurrentMuscleGroupIndex(0);
        setTimeLeft(5); // Start with 5s preparation
        sessionStartTimeRef.current = Date.now();

        const timing = getTiming();

        // Local variables for the interval closure
        let currentPhase: PMRPhase = 'prepare';
        let currentGroupIdx = 0;
        let currentTimeLeft = 5;

        timerRef.current = setInterval(() => {
            currentTimeLeft--;
            setTimeLeft(currentTimeLeft);

            // Phase transition logic
            if (currentPhase === 'prepare' && currentTimeLeft <= 0) {
                currentPhase = 'tense';
                currentTimeLeft = timing.tense;
                setPhase('tense');
                setTimeLeft(currentTimeLeft);
            } else if (currentPhase === 'tense' && currentTimeLeft <= 0) {
                currentPhase = 'relax';
                currentTimeLeft = timing.relax;
                setPhase('relax');
                setTimeLeft(currentTimeLeft);
            } else if (currentPhase === 'relax' && currentTimeLeft <= 0) {
                currentGroupIdx++;
                if (currentGroupIdx >= muscleGroups.length) {
                    // Complete
                    currentPhase = 'completed';
                    setPhase('completed');
                    clearInterval(timerRef.current!);
                    timerRef.current = null;
                    setIsActive(false);

                    const duration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000 / 60);
                    if (onComplete) onComplete(duration, muscleGroups.length);

                    // Reset after delay
                    setTimeout(() => {
                        setPhase('prepare');
                        setCurrentMuscleGroupIndex(0);
                    }, 3000);
                    return;
                } else {
                    // Next group
                    currentPhase = 'tense';
                    currentTimeLeft = timing.tense;
                    setPhase('tense');
                    setCurrentMuscleGroupIndex(currentGroupIdx);
                    setTimeLeft(currentTimeLeft);
                }
            }
        }, 1000);
    }, [getTiming, onComplete]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return {
        isActive,
        phase,
        currentMuscleGroupIndex,
        timeLeft,
        start,
        stop,
        muscleGroups // Re-export for convenience
    };
};
