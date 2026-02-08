import { useState, useCallback } from 'react';
import { saveJournalEntry, getJournalEntries } from '../api/api';import { logger } from '../utils/logger';


interface UseJournalingOptions {
    user: any;
    announce: (message: string, priority?: 'polite' | 'assertive') => void;
    onProgress: (type: string, amount: number) => void;
}

export const useJournaling = ({ user, announce, onProgress }: UseJournalingOptions) => {
    const [content, setContent] = useState('');
    const [mood, setMood] = useState<number | undefined>();
    const [tags, setTags] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [entries, setEntries] = useState<any[]>([]);

    const loadHistory = useCallback(async () => {
        if (!user?.user_id) return;

        setIsLoading(true);
        try {
            const history = await getJournalEntries(user.user_id, 20);
            setEntries(history);
        } catch (error) {
            logger.error('Failed to load journal entries:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const saveEntry = useCallback(async () => {
        if (!user?.user_id || !content.trim()) {
            announce('Skriv något i din journal innan du sparar', 'assertive');
            return;
        }

        setIsSaving(true);
        try {
            await saveJournalEntry(user.user_id, content.trim(), mood, tags);
            setContent('');
            setMood(undefined);
            setTags([]);
            announce('Journalanteckning sparad!', 'polite');

            // Update progress
            onProgress('exercise', 10); // 10 minutes for journaling

            // Refresh journal history
            loadHistory();
        } catch (error) {
            logger.error('Failed to save journal entry:', error);
            announce('Kunde inte spara journalanteckning', 'assertive');
        } finally {
            setIsSaving(false);
        }
    }, [user, content, mood, tags, announce, onProgress, loadHistory]);

    return {
        content,
        setContent,
        mood,
        setMood,
        tags,
        setTags,
        entries,
        isSaving,
        isLoading,
        saveEntry,
        loadHistory
    };
};
