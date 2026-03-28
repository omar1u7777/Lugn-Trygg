import { useState, useCallback } from 'react';
import { useExerciseTimer } from './useExerciseTimer';
import { KBT_PHASES } from '../constants/recommendations';
import { KBTPhaseName } from '../types/recommendation';

const MIN_NEGATIVE_LENGTH = 15;
const MIN_EVIDENCE_LENGTH = 30;
const MIN_ALTERNATIVE_LENGTH = 15;

const LOW_QUALITY_PATTERNS = [
    /^vet\s+inte$/i,
    /^idk$/i,
    /^ingen\s+aning$/i,
    /^jag\s+vet\s+inte$/i,
    /^-+$/,
    /^\.+$/,
];

const getWordCount = (value: string) => value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;

const isLowQualityInput = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return true;
    return LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(normalized));
};

const hasEvidenceStructure = (value: string) => {
    const normalized = value.toLowerCase();
    const hasFor = normalized.includes('för:') || normalized.includes('for:');
    const hasAgainst = normalized.includes('emot:') || normalized.includes('against:');
    return hasFor && hasAgainst;
};

const getDurationForPhase = (phase: KBTPhaseName) => {
    if (phase === 'challenge') return 180;
    if (phase === 'replace') return 120;
    if (phase === 'practice') return 300;
    return 0;
};

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
        const negativeThought = thoughts.negative.trim();
        const evidence = thoughts.evidence.trim();
        const alternative = thoughts.alternative.trim();

        // Validation
        if (phase === 'identify' && negativeThought.length < MIN_NEGATIVE_LENGTH) {
            if (options.announce) {
                options.announce(`Skriv minst ${MIN_NEGATIVE_LENGTH} tecken i din negativa tanke innan du fortsätter`, 'assertive');
            }
            return;
        }
        if (phase === 'identify' && getWordCount(negativeThought) < 4) {
            if (options.announce) options.announce('Försök beskriva tanken med minst fyra ord för att göra den tydlig', 'assertive');
            return;
        }
        if (phase === 'identify' && isLowQualityInput(negativeThought)) {
            if (options.announce) options.announce('Skriv en konkret tanke, inte bara ett kort standardsvar', 'assertive');
            return;
        }
        if (phase === 'challenge' && evidence.length < MIN_EVIDENCE_LENGTH) {
            if (options.announce) {
                options.announce(`Beskriv bevisen med minst ${MIN_EVIDENCE_LENGTH} tecken innan du fortsätter`, 'assertive');
            }
            return;
        }
        if (phase === 'challenge' && !hasEvidenceStructure(evidence)) {
            if (options.announce) {
                options.announce('Använd gärna strukturen "För:" och "Emot:" för en mer balanserad analys', 'assertive');
            }
            return;
        }
        if (phase === 'replace' && alternative.length < MIN_ALTERNATIVE_LENGTH) {
            if (options.announce) {
                options.announce(`Skapa en balanserad alternativ tanke med minst ${MIN_ALTERNATIVE_LENGTH} tecken`, 'assertive');
            }
            return;
        }
        if (phase === 'replace' && getWordCount(alternative) < 4) {
            if (options.announce) options.announce('Försök skriva minst fyra ord i din balanserade tanke', 'assertive');
            return;
        }
        if (phase === 'replace' && alternative.toLowerCase() === negativeThought.toLowerCase()) {
            if (options.announce) options.announce('Din alternativa tanke behöver skilja sig från den negativa tanken', 'assertive');
            return;
        }

        const currentIndex = KBT_PHASES.indexOf(phase);
        if (currentIndex < KBT_PHASES.length - 1) {
            const next = KBT_PHASES[currentIndex + 1];
            if (next) {
                setPhase(next);

                // Set time for next phase
                const duration = getDurationForPhase(next);

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
