import { useState, useCallback } from 'react';
import { useExerciseTimer } from './useExerciseTimer';
import { KBT_PHASES } from '../constants/recommendations';
import { KBTPhaseName } from '../types/recommendation';

interface UserThoughts {
    negative: string;
    evidence: string;
    alternative: string;
}

export const useKBTExercise = (options: {
    initialThoughts?: UserThoughts;
    initialPhase?: KBTPhaseName;
    onComplete?: () => void;
    announce?: (message: string, priority?: 'polite' | 'assertive') => void;
} = {}) => {
    const [phase, setPhase] = useState<KBTPhaseName>(options.initialPhase || 'identify');
    const [thoughts, setThoughts] = useState<UserThoughts>(options.initialThoughts || {
        negative: '',
        evidence: '',
        alternative: ''
    });
    const [timeLeft, setTimeLeft] = useState(0);

    const { isActive, start: startTimer, stop: stopTimer, setTime } = useExerciseTimer(0, {
        countdown: true,
        onTick: (t) => setTimeLeft(t),
        onComplete: () => nextPhase()
    });

    const nextPhase = useCallback(() => {
        // Validation
        if (phase === 'identify' && thoughts.negative.trim().length < 10) {
            if (options.announce) options.announce('Skriv minst 10 tecken i din negativa tanke innan du fortsätter', 'assertive');
            return;
        }
        if (phase === 'challenge' && thoughts.evidence.trim().length < 20) {
            if (options.announce) options.announce('Beskriv bevisen för och emot tanken innan du fortsätter', 'assertive');
            return;
        }
        if (phase === 'replace' && thoughts.alternative.trim().length < 10) {
            if (options.announce) options.announce('Skapa en balanserad alternativ tanke innan du fortsätter', 'assertive');
            return;
        }

        const currentIndex = KBT_PHASES.indexOf(phase);
        if (currentIndex < KBT_PHASES.length - 1) {
            const next = KBT_PHASES[currentIndex + 1];
            if (next) {
                setPhase(next);

                // Set time for next phase
                let duration = 0;
                if (next === 'challenge') duration = 180;
                else if (next === 'replace') duration = 120;
                else if (next === 'practice') duration = 300;

                if (duration > 0) {
                    setTimeLeft(duration);
                    setTime(duration);
                    if (!isActive) startTimer();
                } else {
                    stopTimer();
                    if (options.onComplete) options.onComplete();
                }
            }
        } else {
            stopTimer();
            setPhase('complete');
            if (options.onComplete) options.onComplete();
        }
    }, [phase, thoughts, options, isActive, startTimer, stopTimer, setTime]);

    const start = useCallback(() => {
        setPhase('identify');
        setThoughts({ negative: '', evidence: '', alternative: '' });
        setTimeLeft(120);
        setTime(120);
        startTimer();
    }, [startTimer, setTime]);

    const updateThoughts = useCallback((field: keyof UserThoughts, value: string) => {
        setThoughts(prev => ({ ...prev, [field]: value }));
    }, []);

    return {
        phase,
        thoughts,
        updateThoughts,
        timeLeft,
        isActive,
        start,
        nextPhase,
        stop: stopTimer,
        setPhase,
        setThoughts
    };
};
