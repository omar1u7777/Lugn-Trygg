import { useState, useCallback, useEffect, useRef } from 'react';
import { useExerciseTimer } from './useExerciseTimer';

// Biofeedback types
export type BreathingPhase = 'prepare' | 'exhale' | 'inhale' | 'hold' | 'exhale2' | 'rest' | 'completed';

export interface BiofeedbackData {
  phase: BreathingPhase;
  phaseProgress: number; // 0.0 - 1.0
  heartRate: number;
  coherenceScore: number; // 0-100
  resonanceScore: number; // 0-100
  guidance: string;
  visualization: {
    circleScale: number; // 0.5 - 1.0
    colorHue: number; // 120-180 (green to blue)
    coherenceRing: number; // 0-1
    phaseIndicator: string;
  };
}

export interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  durations: {
    inhale: number;
    hold: number;
    exhale: number;
    holdEmpty: number;
  };
  breathsPerMinute: number;
  targetHrvResonance: boolean;
}

export interface BreathingSession {
  sessionId: string;
  pattern: string;
  targetDuration: number;
  startTime: Date;
}

export interface BiofeedbackOptions {
  onComplete?: (cycleCount: number, finalCoherence: number) => void;
  onPhaseChange?: (phase: BreathingPhase, instruction: string, secondsLeft?: number) => void;
  onBiofeedbackUpdate?: (data: BiofeedbackData) => void;
  targetCycles?: number;
  useBiofeedback?: boolean; // Enable HRV feedback
  pattern?: BreathingPattern;
}

/**
 * Enhanced breathing exercise hook with biofeedback support
 * Integrates real-time HRV data for physiological coherence training
 */
export const useBreathingExerciseBiofeedback = (options: BiofeedbackOptions = {}) => {
  const { 
    onComplete, 
    onPhaseChange, 
    onBiofeedbackUpdate,
    targetCycles: targetCyclesOption,
    useBiofeedback = false,
    pattern
  } = options;

  // Core state
  const [phase, setPhase] = useState<BreathingPhase>('rest');
  const [cycleCount, setCycleCount] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(0);
  
  // Biofeedback state
  const [biofeedback, setBiofeedback] = useState<BiofeedbackData>({
    phase: 'rest',
    phaseProgress: 0,
    heartRate: 0,
    coherenceScore: 0,
    resonanceScore: 0,
    guidance: 'Förbered dig för andningsövningen',
    visualization: {
      circleScale: 0.5,
      colorHue: 120,
      coherenceRing: 0,
      phaseIndicator: 'rest'
    }
  });
  
  const [session, setSession] = useState<BreathingSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Refs
  const completionTriggeredRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onPhaseChange, onBiofeedbackUpdate });
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<BreathingSession | null>(null);

  // Update callbacks ref
  useEffect(() => {
    callbacksRef.current = { onComplete, onPhaseChange, onBiofeedbackUpdate };
  }, [onComplete, onPhaseChange, onBiofeedbackUpdate]);

  // Calculate cycle timing
  const getCycleDuration = useCallback(() => {
    if (pattern) {
      const { inhale, hold, exhale, holdEmpty } = pattern.durations;
      return inhale + hold + exhale + holdEmpty;
    }
    // Default 4-7-8
    return 19; // 4 + 7 + 8
  }, [pattern]);

  const targetCycles = targetCyclesOption ?? 4;
  const cycleTotalTime = getCycleDuration();

  // Timer hook
  const {
    isActive,
    isPaused,
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    stop: stopTimer
  } = useExerciseTimer(0, {
    countdown: false,
    onTick: useCallback((seconds: number) => {
      setTotalSeconds(seconds);
    }, [])
  });

  // Phase calculation with biofeedback integration
  useEffect(() => {
    if (!isActive) return;
    if (totalSeconds === 0) return;

    const completedCycles = Math.floor(totalSeconds / cycleTotalTime);
    
    if (completedCycles !== cycleCount) {
      setCycleCount(completedCycles);
    }

    // Check completion
    if (completedCycles >= targetCycles) {
      if (!completionTriggeredRef.current) {
        completionTriggeredRef.current = true;
        stopTimer();
        setPhase('completed');
        setPhaseSecondsLeft(0);
        
        // Final biofeedback update
        const finalCoherence = biofeedback.coherenceScore;
        setBiofeedback(prev => ({
          ...prev,
          phase: 'completed',
          guidance: `Utmärkt! Genomförde ${completedCycles} cykler med medelkoherens ${finalCoherence.toFixed(0)}%`
        }));
        
        callbacksRef.current.onComplete?.(completedCycles, finalCoherence);
        
        // End backend session if biofeedback enabled
        if (useBiofeedback && sessionRef.current) {
          endBackendSession();
        }
      }
      return;
    }

    // Calculate current phase
    const currentCycleTime = ((totalSeconds - 1) % cycleTotalTime) + 1;
    let elapsed = 0;
    let currentPhase: BreathingPhase = 'exhale';
    let phaseDuration = 2;
    let phaseInstruction = 'Andas ut';

    // Determine phase based on pattern
    if (pattern) {
      const { inhale, hold, exhale, holdEmpty } = pattern.durations;
      
      if (currentCycleTime <= inhale) {
        currentPhase = 'inhale';
        phaseDuration = inhale;
        phaseInstruction = 'Andas in genom näsan';
        elapsed = 0;
      } else if (currentCycleTime <= inhale + hold) {
        currentPhase = 'hold';
        phaseDuration = hold;
        phaseInstruction = hold > 0 ? 'Håll andan' : 'Fortsätt andas';
        elapsed = inhale;
      } else if (currentCycleTime <= inhale + hold + exhale) {
        currentPhase = 'exhale2';
        phaseDuration = exhale;
        phaseInstruction = 'Andas ut genom munnen';
        elapsed = inhale + hold;
      } else {
        currentPhase = 'hold';
        phaseDuration = holdEmpty;
        phaseInstruction = holdEmpty > 0 ? 'Paus' : 'Fortsätt';
        elapsed = inhale + hold + exhale;
      }
    } else {
      // Default 4-7-8 timing
      if (currentCycleTime <= 4) {
        currentPhase = 'inhale';
        phaseDuration = 4;
        phaseInstruction = 'Andas in genom näsan';
        elapsed = 0;
      } else if (currentCycleTime <= 11) {
        currentPhase = 'hold';
        phaseDuration = 7;
        phaseInstruction = 'Håll andan';
        elapsed = 4;
      } else {
        currentPhase = 'exhale2';
        phaseDuration = 8;
        phaseInstruction = 'Andas ut genom munnen';
        elapsed = 11;
      }
    }

    const elapsedInPhase = currentCycleTime - elapsed;
    const secondsLeft = Math.max(phaseDuration - elapsedInPhase + 1, 0);
    const phaseProgress = elapsedInPhase / phaseDuration;

    setPhaseSecondsLeft(secondsLeft);

    // Update phase and biofeedback
    if (phase !== currentPhase) {
      setPhase(currentPhase);
      callbacksRef.current.onPhaseChange?.(currentPhase, phaseInstruction, secondsLeft);
      
      // Update biofeedback with new phase
      updateBiofeedbackVisualization(currentPhase, phaseProgress);
    }

  }, [cycleCount, totalSeconds, isActive, cycleTotalTime, phase, pattern, targetCycles, stopTimer, useBiofeedback, biofeedback.coherenceScore]);

  // Update biofeedback visualization
  const updateBiofeedbackVisualization = useCallback((
    currentPhase: BreathingPhase, 
    progress: number
  ) => {
    setBiofeedback(prev => {
      // Calculate circle scale based on phase
      let circleScale = 0.5;
      if (currentPhase === 'inhale') {
        circleScale = 0.5 + 0.5 * progress; // Expand
      } else if (currentPhase === 'exhale' || currentPhase === 'exhale2') {
        circleScale = 1.0 - 0.5 * progress; // Contract
      } else if (currentPhase === 'hold') {
        circleScale = 0.75; // Steady
      }

      // Color based on coherence
      const colorHue = 120 + (prev.coherenceScore / 100) * 60; // Green to blue

      return {
        ...prev,
        phase: currentPhase,
        phaseProgress: progress,
        visualization: {
          circleScale,
          colorHue,
          coherenceRing: prev.coherenceScore / 100,
          phaseIndicator: currentPhase
        }
      };
    });
  }, []);

  // WebSocket connection for biofeedback
  const connectBiofeedback = useCallback(async (sessionId: string, token: string) => {
    if (!useBiofeedback) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const wsUrl = `${process.env.REACT_APP_WS_URL || 'wss://api.lugn-trygg.se'}/biofeedback?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Biofeedback WebSocket connected');
        setIsConnecting(false);
        
        // Join room for this user
        ws.send(JSON.stringify({
          event: 'join_room',
          data: { user_id: sessionRef.current?.userId }
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.event === 'biofeedback_update') {
          const feedback = data.data;
          
          setBiofeedback({
            phase: feedback.phase,
            phaseProgress: feedback.phase_progress,
            heartRate: feedback.heart_rate,
            coherenceScore: feedback.coherence,
            resonanceScore: feedback.resonance,
            guidance: feedback.guidance,
            visualization: feedback.visualization
          });

          callbacksRef.current.onBiofeedbackUpdate?.({
            phase: feedback.phase,
            phaseProgress: feedback.phase_progress,
            heartRate: feedback.heart_rate,
            coherenceScore: feedback.coherence,
            resonanceScore: feedback.resonance,
            guidance: feedback.guidance,
            visualization: feedback.visualization
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Kunde inte ansluta till biofeedback');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      wsRef.current = ws;

    } catch (error) {
      console.error('Failed to connect biofeedback:', error);
      setConnectionError('Anslutningsfel');
      setIsConnecting(false);
    }
  }, [useBiofeedback]);

  // Start backend biofeedback session
  const startBackendSession = useCallback(async (userId: string, patternId: string, duration: number) => {
    if (!useBiofeedback) return null;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/biofeedback/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pattern: patternId,
          duration: duration
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      
      if (data.success) {
        const newSession: BreathingSession = {
          sessionId: data.session_id,
          pattern: patternId,
          targetDuration: duration,
          startTime: new Date()
        };
        
        setSession(newSession);
        sessionRef.current = newSession;
        
        // Connect WebSocket
        if (data.ws_namespace) {
          connectBiofeedback(data.session_id, token || '');
        }
        
        return newSession;
      }
    } catch (error) {
      console.error('Failed to start biofeedback session:', error);
      setConnectionError('Kunde inte starta biofeedback-session');
    }
    
    return null;
  }, [useBiofeedback, connectBiofeedback]);

  // End backend session
  const endBackendSession = useCallback(async () => {
    if (!sessionRef.current) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/biofeedback/end/${sessionRef.current.sessionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Session summary:', data.summary);
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, []);

  // Start exercise
  const start = useCallback(async (userId?: string) => {
    completionTriggeredRef.current = false;
    setCycleCount(0);
    setTotalSeconds(0);
    setPhase('exhale');
    setPhaseSecondsLeft(2);
    
    // Start backend session if biofeedback enabled
    if (useBiofeedback && userId) {
      const patternId = pattern?.id || 'coherence';
      await startBackendSession(userId, patternId, Math.ceil((targetCycles * cycleTotalTime) / 60));
    }
    
    // Get initial instruction
    const initialInstruction = pattern?.durations.inhale === 4 ? 
      'Andas in genom näsan' : 'Förbered dig';
    
    callbacksRef.current.onPhaseChange?.('exhale', initialInstruction, 2);
    
    startTimer();
  }, [startTimer, useBiofeedback, pattern, targetCycles, cycleTotalTime, startBackendSession]);

  // Stop exercise
  const stop = useCallback(() => {
    completionTriggeredRef.current = false;
    stopTimer();
    setPhase('rest');
    setCycleCount(0);
    setTotalSeconds(0);
    setPhaseSecondsLeft(0);
    
    // End backend session
    if (useBiofeedback) {
      endBackendSession();
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopTimer, useBiofeedback, endBackendSession]);

  // Pause
  const pause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  // Resume
  const resume = useCallback(() => {
    resumeTimer();
  }, [resumeTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (useBiofeedback && sessionRef.current) {
        endBackendSession();
      }
    };
  }, [useBiofeedback, endBackendSession]);

  return {
    // Core breathing state
    isActive,
    isPaused,
    phase,
    cycleCount,
    totalSeconds,
    phaseSecondsLeft,
    targetCycles,
    
    // Biofeedback state
    biofeedback,
    session,
    isConnecting,
    connectionError,
    
    // Actions
    start,
    pause,
    resume,
    stop
  };
};

export default useBreathingExerciseBiofeedback;
