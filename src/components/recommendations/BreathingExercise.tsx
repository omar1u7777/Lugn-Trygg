import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreathingExercise } from '../../hooks/useBreathingExercise';
import { BiofeedbackBreathingCircle } from '../BiofeedbackBreathingCircle';
import { getBreathingPhases } from '../../constants/recommendations';
import { logger } from '../../utils/logger';

interface BreathingExerciseProps {
  userId?: string;
  onComplete?: (cycles: number) => void;
  onStressChange?: (before: number, after: number) => void;
  onPhaseChange?: (phase: string, instruction: string) => void;
  initialCycles?: 4 | 8 | 12;
  initialStressBefore?: number | null;
}

export const BreathingExercise: React.FC<BreathingExerciseProps> = ({ 
  userId, 
  onComplete, 
  onStressChange,
  onPhaseChange,
  initialCycles = 4,
  initialStressBefore = null 
}) => {
  const { t } = useTranslation();
  
  // Advanced state
  const [selectedBreathingCycles, setSelectedBreathingCycles] = useState<4 | 8 | 12>(initialCycles);
  const [breathingUseSound, setBreathingUseSound] = useState(false);
  const [breathingUseHaptics, setBreathingUseHaptics] = useState(true);
  const [breathingStressBefore, setBreathingStressBefore] = useState<number | null>(initialStressBefore);
  const [breathingStressAfter, setBreathingStressAfter] = useState<number | null>(null);
  const [showBreathingScience, setShowBreathingScience] = useState(false);
  const [isBreathingFullscreen, setIsBreathingFullscreen] = useState(false);
  const [useBiofeedbackMode, setUseBiofeedbackMode] = useState(false);
  const [biofeedbackPattern, setBiofeedbackPattern] = useState<'coherence' | 'relax' | 'energize' | 'sleep'>('coherence');
  const breathingAudioContextRef = useRef<AudioContext | null>(null);
  const breathingOutcomeSyncedRef = useRef(false);

  const {
    phase: breathingPhase,
    totalSeconds: _totalSeconds,
    phaseSecondsLeft,
    isActive: isBreathingActive,
    isPaused: isBreathingPaused,
    cycleCount: breathingCount,
    targetCycles,
    start: startBreathingExercise,
    pause: pauseBreathingExercise,
    resume: resumeBreathingExercise,
    stop: stopBreathingExercise
  } = useBreathingExercise({
    targetCycles: selectedBreathingCycles,
    onComplete: (cycles) => {
      breathingOutcomeSyncedRef.current = false;
      onComplete?.(cycles);
    },
    ...(onPhaseChange ? { onPhaseChange } : {})
  });

  const phases = getBreathingPhases(t);
  const currentPhase = phases.find(p => p.name === breathingPhase);
  const breathingCue = currentPhase || { title: breathingPhase, detail: '', icon: '🫁' };

  // Audio tone for phase transitions
  const playPhaseTone = useCallback((phase: string) => {
    if (!breathingUseSound || typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = breathingAudioContextRef.current || new AudioContextClass();
      breathingAudioContextRef.current = ctx;

      // Resume AudioContext if suspended (required by browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const frequencies: Record<string, number> = {
        inhale: 432,
        hold: 528,
        exhale: 396,
        exhale2: 396,
        completed: 528
      };

      oscillator.frequency.value = frequencies[phase] || 432;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      logger.debug('Could not play breathing tone', { error });
    }
  }, [breathingUseSound]);

  // Haptics and audio on phase change
  useEffect(() => {
    if (!isBreathingActive || isBreathingPaused) return;

    playPhaseTone(breathingPhase);

    if (
      breathingUseHaptics &&
      navigator.vibrate &&
      ['exhale', 'inhale', 'hold', 'exhale2', 'completed'].includes(breathingPhase)
    ) {
      navigator.vibrate(breathingPhase === 'completed' ? [80, 40, 120] : 35);
    }
  }, [breathingPhase, breathingUseHaptics, isBreathingActive, isBreathingPaused, playPhaseTone]);

  // Sync stress outcome when completed
  useEffect(() => {
    if (breathingPhase !== 'completed') return;

    if (breathingOutcomeSyncedRef.current) return;
    if (typeof breathingStressBefore !== 'number' || typeof breathingStressAfter !== 'number') return;

    breathingOutcomeSyncedRef.current = true;
    onStressChange?.(breathingStressBefore, breathingStressAfter);
  }, [breathingPhase, breathingStressBefore, breathingStressAfter, onStressChange]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (breathingAudioContextRef.current) {
        breathingAudioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className={`${isBreathingFullscreen ? 'fixed inset-0 z-[260] overflow-y-auto bg-black/80 p-4 sm:p-8' : ''}`}>
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-blue-200 dark:border-blue-800">

        {/* Mode toggle: Basic vs Biofeedback */}
        <div className="flex justify-center mb-4 gap-2">
          <button
            type="button"
            onClick={() => setUseBiofeedbackMode(false)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${!useBiofeedbackMode ? 'bg-blue-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100'}`}
          >
            🫁 {t('breathing.basicMode', 'Grundläge')}
          </button>
          <button
            type="button"
            onClick={() => setUseBiofeedbackMode(true)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${useBiofeedbackMode ? 'bg-purple-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100'}`}
          >
            💜 {t('breathing.hrvBiofeedback', 'HRV Biofeedback')}
          </button>
        </div>

        {/* Biofeedback mode: pattern selector + component */}
        {useBiofeedbackMode && (
          <div className="mb-4">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-3">
              {t('breathing.patternDescription', 'Välj andningsmönster — cirkeln animeras i realtid baserat på din andningsrytm.')}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {([
                { key: 'coherence', label: t('breathing.patterns.coherence', '❤️ Koherens 6bpm'), subtitle: '5-5' },
                { key: 'relax', label: t('breathing.patterns.relax', '😴 4-7-8'), subtitle: '4-7-8' },
                { key: 'energize', label: t('breathing.patterns.energize', '⚡ Box'), subtitle: '5-5-5-5' },
                { key: 'sleep', label: t('breathing.patterns.sleep', '🌙 Sömn'), subtitle: '4-6' },
              ] as const).map(({ key, label, subtitle }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBiofeedbackPattern(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${biofeedbackPattern === key ? 'bg-purple-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100'}`}
                >
                  {label}
                  <span className="ml-1 opacity-70 text-[10px]">({subtitle}s)</span>
                </button>
              ))}
            </div>
            <BiofeedbackBreathingCircle
              userId={userId}
              pattern={biofeedbackPattern}
              duration={5}
              onComplete={(_cycles, _coherence) => {
                setBreathingStressAfter(null);
              }}
              onCancel={() => setUseBiofeedbackMode(false)}
              className="w-full"
            />
          </div>
        )}

        {/* Basic mode (original UI) */}
        {!useBiofeedbackMode && (<>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-center sm:text-left">
            🫁 {t('breathing.interactiveGuide', 'Interaktiv Andningsguide')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBreathingUseSound(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${breathingUseSound ? 'bg-blue-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              {breathingUseSound ? `🔊 ${t('breathing.soundOn', 'Ljud på')}` : `🔈 ${t('breathing.soundOff', 'Ljud av')}`}
            </button>
            <button
              type="button"
              onClick={() => setBreathingUseHaptics(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${breathingUseHaptics ? 'bg-emerald-600 text-white' : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              {breathingUseHaptics ? `📳 ${t('breathing.hapticsOn', 'Haptik på')}` : `📴 ${t('breathing.hapticsOff', 'Haptik av')}`}
            </button>
            <button
              type="button"
              onClick={() => setIsBreathingFullscreen(prev => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {isBreathingFullscreen ? t('breathing.exitFullscreen', '🗗 Avsluta helskärm') : t('breathing.fullscreen', '🗖 Helskärm')}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
          {t('breathing.followInstructions', 'Följ cue-texten i cirkeln och siffrorna för att skapa ett lugnt andningsmönster.')}
        </p>

        <div className="mb-4 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg text-left">
          <label htmlFor="breathing-stress-before" className="text-sm font-medium text-rose-700 dark:text-rose-300 block mb-1">
            {t('breathing.stressBefore', 'Stress före start')} ({breathingStressBefore ?? 0}/100)
          </label>
          <input
            id="breathing-stress-before"
            type="range"
            min={0}
            max={100}
            step={5}
            value={breathingStressBefore ?? 0}
            onChange={(e) => setBreathingStressBefore(Number(e.target.value))}
            disabled={isBreathingActive || breathingPhase === 'completed'}
            className="w-full accent-rose-600"
          />
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
            {t('breathing.stressBeforeHint', 'Sätt en snabb baslinje innan andningsrundan.')}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          {[4, 8, 12].map((cycleOption) => (
            <button
              key={cycleOption}
              type="button"
              disabled={isBreathingActive}
              onClick={() => setSelectedBreathingCycles(cycleOption as 4 | 8 | 12)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedBreathingCycles === cycleOption
                ? 'bg-indigo-600 text-white'
                : 'bg-white/80 dark:bg-gray-700 text-gray-700 dark:text-gray-200'} ${isBreathingActive ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-100 dark:hover:bg-gray-600'}`}
            >
              {cycleOption} {t('breathing.cycles', 'cykler')}
            </button>
          ))}
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full border-4 transition-all duration-1000 ${breathingPhase === 'inhale' ? 'border-green-300 scale-150 opacity-60' : breathingPhase === 'exhale' || breathingPhase === 'exhale2' ? 'border-blue-300 scale-90 opacity-40' : 'border-gray-300 scale-100 opacity-20'}`}></div>
            <div className={`absolute inset-2 rounded-full border-2 transition-all duration-1000 ${breathingPhase === 'hold' ? 'border-yellow-300 scale-110 opacity-50' : 'border-transparent scale-100 opacity-0'}`}></div>

            <div
              className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-1000 transform ${breathingPhase === 'exhale'
                ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white scale-75 shadow-blue-500/50 shadow-lg'
                : breathingPhase === 'inhale'
                  ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-125 shadow-green-500/50 shadow-xl animate-pulse'
                  : breathingPhase === 'hold'
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white scale-110 shadow-yellow-500/50 shadow-lg'
                    : breathingPhase === 'exhale2'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white scale-75 shadow-blue-500/50 shadow-lg'
                      : breathingPhase === 'completed'
                        ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white scale-110 shadow-purple-500/50 shadow-xl'
                        : 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700 scale-100 shadow-gray-500/20 shadow-md'} `}
            >
              <span className="text-xs font-semibold tracking-wide uppercase opacity-90">
                {breathingCue.title}
              </span>
              <span className="text-3xl font-black leading-tight mt-1">
                {breathingPhase === 'completed' ? '✓' : phaseSecondsLeft > 0 ? phaseSecondsLeft : '•'}
              </span>
              <span className="text-xs font-medium mt-1 opacity-90">
                {t('breathing.cycle', 'Cykel')} {Math.min(breathingCount + (isBreathingActive ? 1 : 0), targetCycles)} / {targetCycles}
              </span>

              {breathingPhase === 'inhale' && (
                <div className="absolute inset-0 rounded-full border-2 border-green-300 animate-ping opacity-75"></div>
              )}
            </div>

            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex space-x-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'exhale' ? 'bg-blue-500 scale-125 animate-pulse' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'inhale' ? 'bg-green-500 scale-125 animate-pulse' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'hold' ? 'bg-yellow-500 scale-125 animate-pulse' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${breathingPhase === 'exhale2' ? 'bg-blue-600 scale-125 animate-pulse' : 'bg-gray-300'}`} />
            </div>
          </div>
        </div>

        <div className="text-center mb-4">
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {breathingCue.icon} {breathingCue.title}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{breathingCue.detail}</p>
        </div>

        <div className="text-center mb-4">
          <button
            type="button"
            onClick={() => setShowBreathingScience(prev => !prev)}
            className="text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline"
          >
            {showBreathingScience ? t('breathing.hide', 'Dölj') : t('breathing.show', 'Visa')}: {t('breathing.why478', 'Varför 4-7-8?')}
          </button>
          {showBreathingScience && (
            <div className="mt-3 text-sm text-left bg-white/80 dark:bg-gray-800/70 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 text-gray-700 dark:text-gray-300">
              {t('breathing.science478', '4-7-8-andning förlänger utandningen, vilket kan aktivera kroppens lugn- och återhämtningssystem. Tekniken kan hjälpa till att sänka upplevd stress, stabilisera andningsrytmen och skapa bättre fokus i stunden.')}
            </div>
          )}
        </div>

        {breathingPhase === 'completed' && (
          <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-left border border-emerald-100 dark:border-emerald-800">
            <label htmlFor="breathing-stress-after" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 block mb-1">
              {t('breathing.stressAfter', 'Stress efter övningen')} ({breathingStressAfter ?? 0}/100)
            </label>
            <input
              id="breathing-stress-after"
              type="range"
              min={0}
              max={100}
              step={5}
              value={breathingStressAfter ?? 0}
              onChange={(e) => setBreathingStressAfter(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            {typeof breathingStressBefore === 'number' && typeof breathingStressAfter === 'number' && (
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                {t('breathing.change', 'Förändring')}: {breathingStressAfter - breathingStressBefore <= 0 ? '' : '+'}{breathingStressAfter - breathingStressBefore} {t('breathing.points', 'poäng')}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center gap-3">
          {isBreathingActive ? (
            <>
              <button
                onClick={isBreathingPaused ? resumeBreathingExercise : pauseBreathingExercise}
                className={`px-6 py-3 ${isBreathingPaused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'} text-white font-medium rounded-lg transition-colors`}
              >
                {isBreathingPaused ? t('breathing.resume', '▶️ Fortsätt') : t('breathing.pause', '⏸️ Pausa')}
              </button>
              <button
                onClick={stopBreathingExercise}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                {t('breathing.stop', '⏹️ Stoppa')}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                breathingOutcomeSyncedRef.current = false;
                setBreathingStressAfter(null);
                startBreathingExercise();
              }}
              disabled={breathingStressBefore === null}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              {breathingPhase === 'completed' ? t('breathing.startNew', '🔁 Starta ny omgång') : t('breathing.startExercise', '🚀 Starta andningsövning')}
            </button>
          )}
        </div>
        {!isBreathingActive && breathingStressBefore === null && (
          <p className="text-center text-xs text-rose-600 dark:text-rose-300 mt-2">
            {t('breathing.selectStressHint', 'Välj stressnivå före start för att kunna jämföra effekten efteråt.')}
          </p>
        )}
        </>)}
      </div>
    </div>
  );
};
