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
    targetCycles,
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
  const [showDisclaimer, setShowDisclaimer] = useState(false);

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
    <div className={`flex flex-col items-center justify-center ${className}`} data-testid="biofeedback-circle">
      {/* Medical Disclaimer — collapsible */}
      <div className="mb-6 w-full max-w-md bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 rounded-lg overflow-hidden">
        <button type="button" onClick={() => setShowDisclaimer(!showDisclaimer)} className="w-full flex items-center justify-between p-3 text-sm text-amber-800 dark:text-amber-300 font-semibold">
          <span>{t('breathing.medical_disclaimer_title', '⚠️ Viktig medicinsk ansvarsfriskrivning')}</span>
          <span className="text-xs">{showDisclaimer ? '▲' : '▼'}</span>
        </button>
        {showDisclaimer && (
          <div className="px-4 pb-4 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            {t('breathing.medical_disclaimer', 'Andningsövningar är ett komplement till medicinsk behandling, inte en ersättning. Om du känner dig oroad, matt, yrsel eller andra symtom under övningen - AVBRYT OMEDELBAR och konsultera en läkare.')}
          </div>
        )}
      </div>

      {/* Connection status */}
      {isConnecting && (
        <div className="mb-4 text-sm text-yellow-600">
          {t('breathing.connecting', 'Ansluter till biofeedback...')}
        </div>
      )}

      {connectionError && (
        <div className="mb-4 text-sm text-slate-500 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-2">
          <p>{t('breathing.offlineMode', 'Biofeedback inte tillgängligt — andningsövningen fungerar ändå utmärkt.')}</p>
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
          className="absolute w-full h-full rounded-full border-4 border-white/30 dark:border-white/10"
          style={coherenceRingStyle}
        />
        
        {/* Main breathing circle */}
        <div 
          className="w-48 h-48 rounded-full flex items-center justify-center relative bg-linear-to-br from-indigo-400 to-purple-500 dark:from-indigo-600 dark:to-purple-700"
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
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-full text-sm shadow-lg text-gray-900 dark:text-white">
              <span className="text-red-500">❤️</span> {Math.round(biofeedback.heartRate)} BPM
            </div>
          )}
        </div>

        {/* Phase indicators around circle */}
        <div className="absolute top-0 text-sm font-medium text-gray-600 dark:text-gray-300">
          {getPatternName(pattern)}
        </div>
      </div>

      {/*
        Gated on a heart rate actually arriving, the same condition the BPM
        readout above already used.

        The backend HRV pipeline is real — RR intervals, SDNN, RMSSD, FFT-based
        LF/HF power, resonance in the 0.08-0.12 Hz band. Nothing feeds it. The
        frontend has no function that posts to /biofeedback/data and the app
        integrates no heart-rate sensor, so coherence and resonance rendered a
        confident "0" and "0" in the styling of measurements.

        Showing a measured-looking zero for something never measured is worse
        than showing nothing. The panel returns as soon as a source exists.
      */}
      {showBiofeedback && isActive && biofeedback.heartRate > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 text-center">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Math.round(biofeedback.coherenceScore)}
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">
              {t('breathing.coherence', 'Koherens')}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(biofeedback.resonanceScore)}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {t('breathing.resonance', 'Resonans')}
            </div>
          </div>
        </div>
      )}

      {/* Guidance text with abort instructions */}
      {biofeedback.guidance && (
        <div className="mt-4 text-center text-gray-700 dark:text-gray-300 max-w-xs">
          {biofeedback.guidance}
        </div>
      )}
      
      {isActive && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400 text-center max-w-xs">
          {t('breathing.abort_info', '❗ Klicka "AVBRYT" omedelbar om du blir oroad, yr eller mår illa')}
        </div>
      )}

      {/* Progress bar */}
      {isActive && (
        <div className="mt-4 w-full max-w-xs">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>{t('breathing.cycle', 'Cykel')} {cycleCount + 1}</span>
            <span>{Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, '0')}</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((cycleCount / Math.max(targetCycles, 1)) * 100, 100)}%` }}
            />
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
        className="mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
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
