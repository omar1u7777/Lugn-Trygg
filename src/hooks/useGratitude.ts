import { useState, useEffect, useCallback } from 'react';import { logger } from '../utils/logger';


interface UseGratitudeOptions {
    user: any;
    onProgress: (type: 'exercise' | 'meditation' | 'article', amount?: number) => void;
    announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

export const useGratitude = ({ user, onProgress, announce }: UseGratitudeOptions) => {
    const [isActive, setIsActive] = useState(false);
    const [day, setDay] = useState(1);
    const [entries, setEntries] = useState<{ [key: number]: string[] }>({});
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Load progress on mount or user change
    useEffect(() => {
        if (user?.user_id) {
            const saved = localStorage.getItem(`gratitude_challenge_${user.user_id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setEntries(parsed.entries || {});
                    setDay(parsed.currentDay || 1);
                    if (parsed.startDate) {
                        setStartDate(new Date(parsed.startDate));
                    }
                    setIsActive(true); // Assume active if data exists? Or maybe we need explicit active flag in storage?
                    // Original code didn't save 'isActive' explicitly in the JSON structure shown in saveGratitudeEntry,
                    // but logic suggests if data exists we might want to resume.
                    // However, original 'startGratitudeChallenge' loads data.
                    // Let's stick to manual start or inferred activity.
                    logger.debug('💾 Loaded gratitude challenge progress:', parsed);
                } catch (error) {
                    logger.error('Failed to load gratitude challenge:', error);
                }
            }
        }
    }, [user]);

    const start = useCallback(() => {
        logger.debug('🙏 Starting 7-day gratitude challenge');
        setIsActive(true);
        setDay(1);
        setStartDate(new Date());

        // Re-load to ensure sync if restarting? Original did this.
        if (user?.user_id) {
            const saved = localStorage.getItem(`gratitude_challenge_${user.user_id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setEntries(parsed.entries || {});
                    setDay(parsed.currentDay || 1);
                    if (parsed.startDate) {
                        setStartDate(new Date(parsed.startDate));
                    }
                } catch (e) { logger.error(e); }
            }
        }
    }, [user]);

    const saveEntry = useCallback(async (currentDay: number, currentEntries: string[]) => {
        if (isSaving) return;

        // Check if day completed
        if (entries[currentDay] && entries[currentDay].filter(e => e.trim()).length >= 3) {
            announce(`Dag ${currentDay} är redan slutförd`, 'polite');
            return;
        }

        setIsSaving(true);

        try {
            const newEntries = { ...entries, [currentDay]: currentEntries };
            setEntries(newEntries);

            if (user?.user_id) {
                const challengeData = {
                    entries: newEntries,
                    currentDay: day,
                    startDate: startDate?.toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                localStorage.setItem(`gratitude_challenge_${user.user_id}`, JSON.stringify(challengeData));
                logger.debug('💾 Saved gratitude entry:', challengeData);
            }

            onProgress('exercise', 5);
            announce(`Dag ${currentDay} tacksamhet sparad`, 'polite');

            setTimeout(() => {
                setIsSaving(false);
            }, 500);

        } catch (error) {
            logger.error('Failed to save gratitude entry:', error);
            setIsSaving(false);
            announce('Kunde inte spara tacksamhet', 'assertive');
        }
    }, [entries, isSaving, user, day, startDate, onProgress, announce]);

    const complete = useCallback(() => {
        logger.debug('🎉 Gratitude challenge completed!');
        if (user?.user_id) {
            localStorage.removeItem(`gratitude_challenge_${user.user_id}`);
        }
        onProgress('exercise', 35);
        setIsActive(false);
        setDay(1);
        setEntries({});
        setStartDate(null);
        announce('7-dagars tacksamhetsutmaning slutförd! Bra jobbat!', 'polite');
    }, [user, onProgress, announce]);

    const cancel = useCallback(() => {
        logger.debug('❌ Gratitude challenge cancelled');
        if (user?.user_id) {
            localStorage.removeItem(`gratitude_challenge_${user.user_id}`);
        }
        setIsActive(false);
        setDay(1);
        setEntries({});
        setStartDate(null);
        announce('Tacksamhetsutmaning avbruten', 'polite');
    }, [user, announce]);

    const updateEntries = useCallback((newEntries: { [key: number]: string[] }) => {
        setEntries(newEntries);
    }, []);

    const nextDay = useCallback(() => {
        if (day < 7) {
            setDay(d => d + 1);
        } else {
            complete();
        }
    }, [day, complete]);

    const getPrompts = useCallback((currentDay: number) => {
        const prompts = [
            "Vad är du mest tacksam för idag?",
            "Vilka människor i ditt liv är du tacksam för?",
            "Vilka små saker i vardagen uppskattar du?",
            "Vad har gått bra den senaste veckan?",
            "Vilka styrkor har du som du är tacksam för?",
            "Vilka möjligheter ser du fram emot?",
            "Vad har du lärt dig nyligen som du är tacksam för?"
        ];
        return prompts[currentDay - 1] || prompts[0];
    }, []);

    return {
        isActive,
        day,
        entries,
        startDate,
        isSaving,
        start,
        saveEntry,
        complete,
        cancel,
        updateEntries,
        nextDay,
        getPrompts
    };
};
