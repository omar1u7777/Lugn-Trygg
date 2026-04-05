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
      const newData = typeof updates === 'function' 
        ? updates(data) 
        : { ...data, ...updates };
      
      setData(newData);
      
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
    [data, debouncedSave, delay]
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

  return {
    data,
    updateData,
    saveNow,
    cancelSave,
    revert,
    isSaving,
    hasUnsavedChanges: JSON.stringify(data) !== JSON.stringify(lastSaved),
  };
};
