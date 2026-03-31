import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreathingExerciseBiofeedback } from '../hooks/useBreathingExerciseBiofeedback';
import { Button } from './ui/tailwind';

/**
 * BiofeedbackBreathingCircle - Animated breathing visualization
 * 
 * Features:
 * - Dynamic circle expansion/contraction synchronized with breath phases
 * - Color changes based on HRV coherence score
 * - Real-time biofeedback indicators
 * - Smooth animations using CSS transitions
 */

interface BiofeedbackBreathingCircleProps {
  userId: string;
  pattern?: 'coherence' | 'relax' | 'energize' | 'sleep';
  duration?: number; // minutes
  onComplete?: (cycles: number, coherence: number) => void;
  onCancel?: () => void;
  className?: string;
}

export const BiofeedbackBreathingCircle: React.FC<BiofeedbackBreathingCircleProps> = ({
  userId,
  pattern = 'coherence',
  duration = 5,
  onComplete,
  onCancel,
  className = ''
}) => {
  const { t } = useTranslation();
  const {
    isActive,
    isPaused,
    phase,
    cycleCount,
    totalSeconds,
    phaseSecondsLeft,
    biofeedback,
    isConnecting,
    connectionError,
    start,
    pause,
    resume,
    stop
  } = useBreathingExerciseBiofeedback({
    useBiofeedback: true,
    onComplete,
    targetCycles: Math.ceil((duration * 60) / 10) // Approximate cycles
  });

  const [showBiofeedback, setShowBiofeedback] = useState(true);

  // Get phase display text
  const getPhaseText = (phase: string): string => {
    const phaseMap: Record<string, string> = {
      'inhale': t('breathing.inhale', 'Andas in'),
      'hold': t('breathing.hold', 'Håll'),
      'exhale': t('breathing.exhale', 'Andas ut'),
      'exhale2': t('breathing.exhale', 'Andas ut'),
      'rest': t('breathing.rest', 'Vila'),
      'completed': t('breathing.completed', 'Klart!')
    };
    return phaseMap[phase] || phase;
  };

  // Get pattern display name
  const getPatternName = (pattern: string): string => {
    const patternMap: Record<string, string> = {
      'coherence': t('breathing.patterns.coherence', 'Hjärtkoherens'),
      'relax': t('breathing.patterns.relax', 'Avslappning 4-7-8'),
      'energize': t('breathing.patterns.energize', 'Box-andning'),
      'sleep': t('breathing.patterns.sleep', 'Sömn-andning')
    };
    return patternMap[pattern] || pattern;
  };

  // Handle start
  const handleStart = () => {
    start(userId);
  };

  // Handle stop
  const handleStop = () => {
    stop();
    onCancel?.();
  };

  // Calculate circle style based on biofeedback
  const circleStyle: React.CSSProperties = {
    transform: `scale(${biofeedback.visualization.circleScale})`,
    backgroundColor: `hsl(${biofeedback.visualization.colorHue}, 70%, 50%)`,
    boxShadow: `0 0 ${30 + biofeedback.resonanceScore * 0.5}px hsl(${biofeedback.visualization.colorHue}, 70%, 60%)`,
    transition: 'all 0.3s ease-out'
  };

  // Calculate coherence ring style
  const coherenceRingStyle: React.CSSProperties = {
    opacity: biofeedback.visualization.coherenceRing,
    transform: `scale(${1 + biofeedback.visualization.coherenceRing * 0.2})`,
    transition: 'all 0.5s ease-out'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Connection status */}
      {isConnecting && (
        <div className="mb-4 text-sm text-yellow-600">
          {t('breathing.connecting', 'Ansluter till biofeedback...')}
        </div>
      )}
      
      {connectionError && (
        <div className="mb-4 text-sm text-orange-600">
          {connectionError}
        </div>
      )}

      {/* Main breathing circle container */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Outer coherence ring */}
        <div 
          className="absolute w-full h-full rounded-full border-4 border-white/30"
          style={coherenceRingStyle}
        />
        
        {/* Main breathing circle */}
        <div 
          className="w-48 h-48 rounded-full flex items-center justify-center relative"
          style={circleStyle}
        >
          {/* Inner content */}
          <div className="text-center text-white">
            <div className="text-2xl font-bold">
              {getPhaseText(phase)}
            </div>
            <div className="text-lg">
              {phaseSecondsLeft}s
            </div>
          </div>

          {/* Heart rate indicator (if biofeedback available) */}
          {showBiofeedback && biofeedback.heartRate > 0 && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white/90 px-3 py-1 rounded-full text-sm shadow-lg">
              <span className="text-red-500">❤️</span> {Math.round(biofeedback.heartRate)} BPM
            </div>
          )}
        </div>

        {/* Phase indicators around circle */}
        <div className="absolute top-0 text-sm font-medium text-gray-600">
          {getPatternName(pattern)}
        </div>
      </div>

      {/* Biofeedback metrics */}
      {showBiofeedback && isActive && (
        <div className="mt-6 grid grid-cols-2 gap-4 text-center">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(biofeedback.coherenceScore)}
            </div>
            <div className="text-xs text-green-700">
              {t('breathing.coherence', 'Koherens')}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(biofeedback.resonanceScore)}
            </div>
            <div className="text-xs text-blue-700">
              {t('breathing.resonance', 'Resonans')}
            </div>
          </div>
        </div>
      )}

      {/* Guidance text */}
      {biofeedback.guidance && (
        <div className="mt-4 text-center text-gray-700 max-w-xs">
          {biofeedback.guidance}
        </div>
      )}

      {/* Progress */}
      {isActive && (
        <div className="mt-4 text-center text-gray-600">
          <div className="text-sm">
            {t('breathing.cycle', 'Cykel')} {cycleCount + 1} • {Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-6 flex gap-3">
        {!isActive ? (
          <Button 
            onClick={handleStart}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            {t('breathing.start', 'Starta andningsövning')}
          </Button>
        ) : (
          <>
            <Button
              onClick={isPaused ? resume : pause}
              variant="outline"
              className="px-4 py-2"
            >
              {isPaused ? t('common.resume', 'Fortsätt') : t('common.pause', 'Paus')}
            </Button>
            <Button
              onClick={handleStop}
              variant="outline"
              className="px-4 py-2 text-red-600 border-red-300 hover:bg-red-50"
            >
              {t('common.stop', 'Avsluta')}
            </Button>
          </>
        )}
      </div>

      {/* Toggle biofeedback display */}
      <button
        onClick={() => setShowBiofeedback(!showBiofeedback)}
        className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
      >
        {showBiofeedback 
          ? t('breathing.hideMetrics', 'Dölj mätvärden') 
          : t('breathing.showMetrics', 'Visa mätvärden')
        }
      </button>
    </div>
  );
};

export default BiofeedbackBreathingCircle;
