import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreathingExerciseBiofeedback, BreathingPattern } from '../hooks/useBreathingExerciseBiofeedback';
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

// Pattern configs matching the backend breathing_breathing_service.py patterns
const PATTERN_CONFIGS: Record<string, BreathingPattern> = {
  coherence: {
    id: 'coherence_6bpm',
    name: 'Hjärtkoherens 6bpm',
    description: 'Optimerad för HRV-resonans vid 0.1Hz',
    durations: { inhale: 5, hold: 0, exhale: 5, holdEmpty: 0 },
    breathsPerMinute: 6,
    targetHrvResonance: true,
  },
  relax: {
    id: 'relax_478',
    name: 'Avslappning 4-7-8',
    description: 'Aktiverar parasympatiska nervsystemet',
    durations: { inhale: 4, hold: 7, exhale: 8, holdEmpty: 0 },
    breathsPerMinute: 3.2,
    targetHrvResonance: false,
  },
  energize: {
    id: 'energize_box',
    name: 'Box-andning',
    description: 'Balanserar energi och fokus',
    durations: { inhale: 5, hold: 5, exhale: 5, holdEmpty: 5 },
    breathsPerMinute: 3,
    targetHrvResonance: false,
  },
  sleep: {
    id: 'sleep_446',
    name: 'Sömn-andning 4-4-6',
    description: 'Förbereder kroppen för sömn',
    durations: { inhale: 4, hold: 0, exhale: 6, holdEmpty: 0 },
    breathsPerMinute: 4,
    targetHrvResonance: false,
  },
};

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
    retryCount,
    start,
    pause,
    resume,
    stop,
    retryConnection
  } = useBreathingExerciseBiofeedback({
    useBiofeedback: true,
    onComplete,
    targetCycles: Math.ceil((duration * 60) / 10), // Approximate cycles
    pattern: PATTERN_CONFIGS[pattern] ?? PATTERN_CONFIGS['coherence'],
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
      {/* Medical Disclaimer */}
      <div className="mb-6 w-full max-w-md bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
        <div className="text-sm text-amber-800">
          <div className="font-semibold mb-2">
            {t('breathing.medical_disclaimer_title', '⚠️ Viktig medicinsk ansvarsfriskrivning')}
          </div>
          <div className="text-xs leading-relaxed">
            {t('breathing.medical_disclaimer', 'Andningsövningar är ett komplement till medicinsk behandling, inte en ersättning. Om du känner dig oroad, matt, yrsel eller andra symtom under övningen - AVBRYT OMEDELBAR och konsultera en läkare.')}
          </div>
        </div>
      </div>

      {/* Connection status */}
      {isConnecting && (
        <div className="mb-4 text-sm text-yellow-600">
          {t('breathing.connecting', 'Ansluter till biofeedback...')}
        </div>
      )}
      
      {connectionError && (
        <div className="mb-4 text-sm text-orange-600 text-center">
          <p>{connectionError}</p>
          {isActive && (
            <Button
              onClick={() => {
                void retryConnection();
              }}
              variant="outline"
              className="mt-2 px-3 py-1 text-xs"
            >
              {t('breathing.retryConnection', 'Försök ansluta igen')}
              {retryCount > 0 ? ` (${retryCount})` : ''}
            </Button>
          )}
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

      {/* Guidance text with abort instructions */}
      {biofeedback.guidance && (
        <div className="mt-4 text-center text-gray-700 max-w-xs">
          {biofeedback.guidance}
        </div>
      )}
      
      {isActive && (
        <div className="mt-3 text-xs text-red-600 text-center max-w-xs">
          {t('breathing.abort_info', '❗ Klicka "AVBRYT" omedelbar om du blir oroad, yr eller mår illa')}
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
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold border-red-600"
              title={t('breathing.abort_tooltip', 'Avbryt övningen omedelbar')}
            >
              {t('breathing.abort', '⚠️ AVBRYT')}
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
