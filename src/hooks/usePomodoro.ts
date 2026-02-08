import { useState, useEffect, useRef, useCallback } from 'react';

export type PomodoroPhase = 'work' | 'break' | 'completed';

export const formatPomodoroTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface UsePomodoroOptions {
    workTime: number; // minutes
    breakTime: number; // minutes
    totalSessions: number;
    onSessionComplete?: (session: number, type: 'work' | 'break', duration: number) => void;
    onComplete?: () => void;
    onTick?: (timeLeft: number) => void;
    onPhaseChange?: (phase: PomodoroPhase, session: number) => void;
}

export const usePomodoro = ({
    workTime,
    breakTime,
    totalSessions,
    onSessionComplete,
    onComplete,
    onTick,
    onPhaseChange
}: UsePomodoroOptions) => {
    const [isActive, setIsActive] = useState(false);
    const [phase, setPhase] = useState<PomodoroPhase>('work');
    const [timeLeft, setTimeLeft] = useState(workTime * 60);
    const [session, setSession] = useState(1);

    // Refs for closure access
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const handlersRef = useRef({ onSessionComplete, onComplete, onTick, onPhaseChange });

    const stateRef = useRef({
        phase: 'work' as PomodoroPhase,
        session: 1,
        timeLeft: workTime * 60,
        workTime,
        breakTime,
        totalSessions
    });

    // Update refs when props/handlers change
    useEffect(() => {
        handlersRef.current = { onSessionComplete, onComplete, onTick, onPhaseChange };
    }, [onSessionComplete, onComplete, onTick, onPhaseChange]);

    useEffect(() => {
        stateRef.current.workTime = workTime;
        stateRef.current.breakTime = breakTime;
        stateRef.current.totalSessions = totalSessions;

        // Update display time if sitting idle in work phase (e.g. user changed settings)
        if (!isActive && stateRef.current.phase === 'work') {
            setTimeLeft(workTime * 60);
            stateRef.current.timeLeft = workTime * 60;
        }
    }, [workTime, breakTime, totalSessions, isActive]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const stop = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsActive(false);
        setPhase('work');
        setSession(1);
        setTimeLeft(stateRef.current.workTime * 60);

        // Update ref
        stateRef.current.phase = 'work';
        stateRef.current.session = 1;
        stateRef.current.timeLeft = stateRef.current.workTime * 60;
    }, []);

    const handlePhaseEnd = () => {
        const currentState = stateRef.current;
        const handlers = handlersRef.current;

        const { phase: currentPhase, session: currentSession, totalSessions, workTime, breakTime } = currentState;

        if (currentPhase === 'work') {
            if (handlers.onSessionComplete) handlers.onSessionComplete(currentSession, 'work', workTime);

            if (currentSession >= totalSessions) {
                // Completed all
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;

                setPhase('completed');
                setIsActive(false);
                currentState.phase = 'completed';

                if (handlers.onPhaseChange) handlers.onPhaseChange('completed', currentSession);
                if (handlers.onComplete) handlers.onComplete();
            } else {
                // Start break
                const nextTime = breakTime * 60;
                setPhase('break');
                setTimeLeft(nextTime);
                currentState.phase = 'break';
                currentState.timeLeft = nextTime;

                if (handlers.onPhaseChange) handlers.onPhaseChange('break', currentSession);
            }
        } else if (currentPhase === 'break') {
            if (handlers.onSessionComplete) handlers.onSessionComplete(currentSession, 'break', breakTime);

            // Start next work session
            const nextSession = currentSession + 1;
            const nextTime = workTime * 60;

            setSession(nextSession);
            setPhase('work');
            setTimeLeft(nextTime);

            currentState.session = nextSession;
            currentState.phase = 'work';
            currentState.timeLeft = nextTime;

            if (handlers.onPhaseChange) handlers.onPhaseChange('work', nextSession);
        }
    };

    const start = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        setIsActive(true);
        // Reset only if starting fresh? For now, we assume simple start = restart/continue
        // But if stopped, state is reset. If active, this might restart current phase?
        // Let's assume start implies "start or resume".
        // But our stop resets. 
        // If we want pause/resume we need more logic. 
        // Original implementation didn't have pause. It had start/stop.
        // So start starts the timer on current state.

        // Note: stateRef has current timeLeft.

        if (stateRef.current.phase === 'completed') {
            // Reset if trying to start after completion
            stateRef.current.phase = 'work';
            stateRef.current.session = 1;
            stateRef.current.timeLeft = stateRef.current.workTime * 60;
            setPhase('work');
            setSession(1);
            setTimeLeft(stateRef.current.workTime * 60);
        }

        // If coming from stopped state, ensure we are in sync?
        // Stop sets timeLeft.

        timerRef.current = setInterval(() => {
            stateRef.current.timeLeft -= 1;
            setTimeLeft(stateRef.current.timeLeft);

            if (handlersRef.current.onTick) {
                handlersRef.current.onTick(stateRef.current.timeLeft);
            }

            if (stateRef.current.timeLeft <= 0) {
                handlePhaseEnd();
            }
        }, 1000);
    }, []);

    return {
        isActive,
        phase,
        timeLeft,
        session,
        start,
        stop
    };
};
