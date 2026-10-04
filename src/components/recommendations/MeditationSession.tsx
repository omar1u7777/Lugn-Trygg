import React, { useState, useCallback, useEffect, useRef } from 'react';
import { formatTime } from '../../constants/recommendationsConstants';
import { logger } from '../../utils/logger';

interface MeditationSessionProps {
  duration: number;
  title: string;
  onSaveSession?: (sessionData: { type: string; duration: number; technique: string; completedCycles: number; notes: string }) => void | Promise<void>;
  onUpdateProgress?: (type: string, duration: number) => void;
}

export const MeditationSession: React.FC<MeditationSessionProps> = ({
  duration,
  title,
  onSaveSession,
  onUpdateProgress,
}) => {
  const [isMeditationActive, setIsMeditationActive] = useState(false);
  const [meditationTimeLeft, setMeditationTimeLeft] = useState(duration * 60);
  const [isMeditationPaused, setIsMeditationPaused] = useState(false);
  const meditationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMeditationCompleteRef = useRef<() => Promise<void>>(async () => {});

  const handleMeditationComplete = useCallback(async () => {
    if (meditationTimerRef.current) {
      clearInterval(meditationTimerRef.current);
      meditationTimerRef.current = null;
    }
    setIsMeditationActive(false);
    setMeditationTimeLeft(0);

    // Update progress
    if (onUpdateProgress) {
      onUpdateProgress('meditation', duration);
    }

    // Save meditation session to backend
    if (onSaveSession) {
      const sessionData = {
        type: 'meditation',
        duration: duration,
        technique: title,
        completedCycles: 1,
        notes: `Meditation session - ${title}`
      };
      try {
        await onSaveSession(sessionData);
      } catch (error) {
        logger.error('Failed to save meditation session:', error);
      }
    }
  }, [duration, title, onUpdateProgress, onSaveSession]);

  useEffect(() => {
    handleMeditationCompleteRef.current = handleMeditationComplete;
  }, [handleMeditationComplete]);

  const startMeditationSession = useCallback((durationMinutes: number) => {
    if (meditationTimerRef.current) {
      clearInterval(meditationTimerRef.current);
    }
    setIsMeditationActive(true);
    setMeditationTimeLeft(durationMinutes * 60);
    setIsMeditationPaused(false);

    const timer = setInterval(() => {
      setMeditationTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          void handleMeditationCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    meditationTimerRef.current = timer;
  }, []);

  const toggleMeditationPause = useCallback(() => {
    if (isMeditationPaused) {
      // Resume
      setIsMeditationPaused(false);
      const timer = setInterval(() => {
        setMeditationTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            void handleMeditationCompleteRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      meditationTimerRef.current = timer;
    } else {
      // Pause
      if (meditationTimerRef.current) {
        clearInterval(meditationTimerRef.current);
        meditationTimerRef.current = null;
      }
      setIsMeditationPaused(true);
    }
  }, [isMeditationPaused]);

  const stopMeditationSession = useCallback(() => {
    if (meditationTimerRef.current) {
      clearInterval(meditationTimerRef.current);
      meditationTimerRef.current = null;
    }
    setIsMeditationActive(false);
    setMeditationTimeLeft(duration * 60);
    setIsMeditationPaused(false);
  }, [duration]);

  // Sync meditationTimeLeft when duration changes
  useEffect(() => {
    if (!isMeditationActive) {
      setMeditationTimeLeft(duration * 60);
    }
  }, [duration, isMeditationActive]);

  // Auto-start when component mounts (only if not already active)
  useEffect(() => {
    if (!isMeditationActive) {
      startMeditationSession(duration);
    }
    return () => {
      if (meditationTimerRef.current) {
        clearInterval(meditationTimerRef.current);
      }
    };
  }, [duration, isMeditationActive, startMeditationSession]);

  return (
    <div className="bg-linear-to-br from-purple-50 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-8 mb-6 border-2 border-purple-200 dark:border-purple-800 text-center shadow-lg">
      <div className="flex flex-col items-center">
        <button
          onClick={() => !isMeditationActive && startMeditationSession(duration)}
          className="w-40 h-40 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center mb-8 relative shadow-inner group transition-all"
        >
          <div className={`absolute inset-0 rounded-full border-4 border-purple-500/20 ${!isMeditationPaused && isMeditationActive ? 'animate-ping' : ''}`} />
          <span className={`text-6xl transition-transform ${!isMeditationPaused && isMeditationActive ? 'scale-110' : 'group-hover:scale-110'}`} role="img" aria-label="meditation">🧘</span>
        </button>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm">
          {isMeditationActive ? 'Fokusera på din andning och var närvarande i nuet.' : 'Redo att börja? Hitta en bekväm position.'}
        </p>

        <div className="text-6xl font-mono font-bold text-purple-600 dark:text-purple-400 mb-10 tracking-widest bg-white dark:bg-gray-800 px-8 py-4 rounded-3xl shadow-lg border border-purple-100 dark:border-purple-900">
          {formatTime(meditationTimeLeft || duration * 60)}
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={stopMeditationSession}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all text-gray-600 dark:text-gray-300"
            title="Stoppa"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
          </button>

          <button
            onClick={toggleMeditationPause}
            className="w-20 h-20 rounded-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xl hover:scale-105 active:scale-95"
          >
            {isMeditationPaused || !isMeditationActive ? (
              <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            )}
          </button>

          <button
            onClick={handleMeditationComplete}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-all text-green-600 dark:text-green-400"
            title="Snabb-slutför"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>

        {!isMeditationActive && meditationTimeLeft === 0 && (
          <div className="mt-8 animate-bounce">
            <p className="text-green-600 dark:text-green-400 font-bold text-xl">✨ Passet Slutfört! ✨</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeditationSession;
