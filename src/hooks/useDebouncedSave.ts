import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

interface UseDebouncedSaveOptions<T> {
  onSave: (data: T) => Promise<void>;
  delay?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export const useDebouncedSave = <T extends Record<string, unknown>>(
  initialData: T,
  options: UseDebouncedSaveOptions<T>
) => {
  const { onSave, delay = 1000, onSuccess, onError } = options;
  const [data, setData] = useState<T>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<T>(initialData);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingSaveRef = useRef<T | null>(null);
  // CRITICAL FIX: Initialize with defensive value to prevent TDZ errors
  const dataRef = useRef<T>(initialData);
  
  // Sync data to ref using useEffect
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Debounced save function
  const debouncedSave = useCallback(
    async (dataToSave: T) => {
      try {
        setIsSaving(true);
        logger.debug('🔄 DEBOUNCED SAVE - Saving data:', dataToSave);
        await onSave(dataToSave);
        setLastSaved(dataToSave);
        onSuccess?.(dataToSave);
        logger.debug('✅ DEBOUNCED SAVE - Data saved successfully');
      } catch (error) {
        logger.error('❌ DEBOUNCED SAVE - Failed to save:', error);
        onError?.(error instanceof Error ? error : new Error('Save failed'));
      } finally {
        setIsSaving(false);
        pendingSaveRef.current = null;
      }
    },
    [onSave, onSuccess, onError]
  );

  // Update data and schedule save
  const updateData = useCallback(
    (updates: Partial<T> | ((prev: T) => T)) => {
      const current = dataRef.current;
      const newData = typeof updates === 'function' 
        ? updates(current) 
        : { ...current, ...updates };
      
      setData(newData);
      dataRef.current = newData;
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Store pending save
      pendingSaveRef.current = newData;
      
      // Schedule new save
      timeoutRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          debouncedSave(pendingSaveRef.current);
        }
      }, delay);
    },
    [debouncedSave, delay]
  );

  // Force immediate save
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (pendingSaveRef.current) {
      await debouncedSave(pendingSaveRef.current);
    }
  }, [debouncedSave]);

  // Cancel pending save
  const cancelSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    pendingSaveRef.current = null;
    setIsSaving(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Revert to last saved
  const revert = useCallback(() => {
    setData(lastSaved);
    cancelSave();
  }, [lastSaved, cancelSave]);

  /**
   * Adopt server state as the new baseline: sets both the working copy and the
   * comparison point, without scheduling a save.
   *
   * Callers that loaded settings from the server used updateData for this,
   * which moves `data` but leaves `lastSaved` on whatever the hook was
   * initialised with — the component's hardcoded defaults. hasUnsavedChanges
   * then reported true the instant the fetch resolved, so the profile's
   * notification tab announced "Osparade ändringar" before the user had
   * touched anything. cancelSave() does not help: it clears the pending timer,
   * not the baseline.
   */
  const setBaseline = useCallback((serverData: T) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Drop any queued write as well as its timer. A save scheduled from the
    // pre-load defaults would otherwise fire after this and put them back.
    pendingSaveRef.current = null;
    // dataRef feeds updateData's partial merge; leaving it stale would make
    // the next edit merge into the values this call just replaced.
    dataRef.current = serverData;
    setData(serverData);
    setLastSaved(serverData);
  }, []);

  return {
    data,
    updateData,
    saveNow,
    cancelSave,
    revert,
    setBaseline,
    isSaving,
    hasUnsavedChanges: JSON.stringify(data) !== JSON.stringify(lastSaved),
  };
};
