import React, { useState, useEffect, useRef } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';

interface DashboardHeaderProps {
  userName?: string;
  isLoading?: boolean;
  lastUpdatedAt?: Date;
  onFocusAction?: () => void;
  userId?: string;
}

const getGreeting = (moodContext?: string): string => {
  const hour = new Date().getHours();
  let baseGreeting: string;
  
  if (hour < 10) baseGreeting = "God morgon";
  else if (hour < 14) baseGreeting = "God dag";
  else if (hour < 18) baseGreeting = "God eftermiddag";
  else baseGreeting = "God kväll";
  
  // Psykologisk personalisering baserad på mood
  if (moodContext) {
    const lowerMood = moodContext.toLowerCase();
    if (lowerMood.includes('stress') || lowerMood.includes('ångest') || lowerMood.includes('orolig')) {
      return `${baseGreeting}. Ta det lugnt idag.`;
    }
    if (lowerMood.includes('trött') || lowerMood.includes('utmattad')) {
      return `${baseGreeting}. Kom ihåg att vila är produktivt.`;
    }
    if (lowerMood.includes('glad') || lowerMood.includes('lycklig') || lowerMood.includes('nöjd')) {
      return `${baseGreeting}! Underbart att se dig.`;
    }
  }
  
  return baseGreeting;
};

const getDailyFocusContent = () => {
  const hour = new Date().getHours();

  if (hour < 10) {
    return {
      title: 'Morgonfokus',
      description: 'Börja dagen med 3 djupa andetag. Följ orben.',
      actionLabel: 'Starta 3 andetag',
    };
  }

  if (hour < 18) {
    return {
      title: 'Dagens Fokus',
      description: 'Ta en kort paus med 3 djupa andetag innan nästa steg.',
      actionLabel: 'Starta 3 andetag',
    };
  }

  return {
    title: 'Kvällsfokus',
    description: 'Varva ner med 3 lugna andetag och checka in hur dagen känns.',
    actionLabel: 'Starta 3 andetag',
  };
};

type BreathingPhase = 'inhale' | 'exhale' | 'hold' | 'done';

const BREATH_COUNT_TARGET = 3;
const PHASE_SECONDS: Record<Exclude<BreathingPhase, 'done'>, number> = {
  inhale: 4,
  exhale: 4,
  hold: 2,
};
const DAILY_FOCUS_STORAGE_KEY = 'lugn-trygg-focus-breathing-last-completed';
const getTodayStorageValue = () => new Date().toISOString().slice(0, 10);

// Hjälpfunktion för att formatera tidsstämpel smart
const getSmartTimestamp = (lastUpdatedAt?: Date): string => {
  if (!lastUpdatedAt) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - lastUpdatedAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  // Dölj tidsstämpel om data är < 2 minuter gammal (för färsk)
  if (diffMinutes < 2) {
    return '';
  }
  
  // Visa "X minuter sedan" om < 60 minuter
  if (diffMinutes < 60) {
    return ` · Uppdaterat för ${diffMinutes} min sedan`;
  }
  
  // Visa klockslag om > 60 minuter
  return ` · Senast ${lastUpdatedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Breathing Orb Component - 2026 visual anchor
 */
const BreathingOrb = () => (
  <div className="relative w-16 h-16 flex items-center justify-center" aria-hidden="true">
    <div className="absolute inset-0 bg-primary-400/20 rounded-full animate-breathe-slow"></div>
    <div className="absolute inset-2 bg-primary-500/20 rounded-full animate-breathe-slow" style={{ animationDelay: '1s' }}></div>
    <div className="relative z-10 text-2xl">✨</div>
  </div>
);

/**
 * DashboardHeader Component (2026 Redesign)
 * 
 * Features:
 * - Dynamic Time-based Greeting
 * - "Breathing Orb" visual anchor
 * - Glassmorphism cards
 * - Simplified, editorial typography
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = 'vän',
  isLoading = false,
  lastUpdatedAt,
  onFocusAction,
  userId,
}) => {
  // Hämta dashboard data för mood-baserad personalisering
  const dashboardResult = userId ? useDashboardData(userId) : null;
  const stats = dashboardResult?.stats;
  const recentMood = stats?.averageMood;
  
  const [greeting, setGreeting] = useState(getGreeting(recentMood?.toString()));
  const [focusContent, setFocusContent] = useState(getDailyFocusContent());
  const [isBreathingSessionActive, setIsBreathingSessionActive] = useState(false);
  const [completedBreaths, setCompletedBreaths] = useState(0);
  const [breathingPhase, setBreathingPhase] = useState<BreathingPhase>('inhale');
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(PHASE_SECONDS.inhale);
  const breathingCardRef = useRef<HTMLDivElement>(null);

  // Focus management när breathing session startar
  useEffect(() => {
    if (isBreathingSessionActive && breathingCardRef.current) {
      breathingCardRef.current.focus();
    }
  }, [isBreathingSessionActive]);

  // Uppdatera hälsning när mood-data ändras
  useEffect(() => {
    if (recentMood !== undefined) {
      setGreeting(getGreeting(recentMood.toString()));
    }
  }, [recentMood]);

  useEffect(() => {
    // Update greeting every minute
    const interval = setInterval(() => {
      setGreeting(getGreeting());
      setFocusContent(getDailyFocusContent());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const lastCompleted = window.localStorage.getItem(DAILY_FOCUS_STORAGE_KEY);
    if (lastCompleted === getTodayStorageValue()) {
      setSessionCompleted(true);
      setBreathingPhase('done');
      setCompletedBreaths(BREATH_COUNT_TARGET);
    }
  }, []);

  useEffect(() => {
    if (!isBreathingSessionActive || breathingPhase === 'done') {
      return;
    }

    const phaseDuration = PHASE_SECONDS[breathingPhase];
    setPhaseSecondsLeft(phaseDuration);

    const countdown = window.setInterval(() => {
      setPhaseSecondsLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    const timer = window.setTimeout(() => {
      if (breathingPhase === 'inhale') {
        setBreathingPhase('exhale');
        return;
      }

      if (breathingPhase === 'exhale') {
        setBreathingPhase('hold');
        return;
      }

      const nextCompleted = completedBreaths + 1;
      if (nextCompleted >= BREATH_COUNT_TARGET) {
        setCompletedBreaths(BREATH_COUNT_TARGET);
        setBreathingPhase('done');
        setIsBreathingSessionActive(false);
        setSessionCompleted(true);
        window.localStorage.setItem(DAILY_FOCUS_STORAGE_KEY, getTodayStorageValue());
        return;
      }

      setCompletedBreaths(nextCompleted);
      setBreathingPhase('inhale');
    }, phaseDuration * 1000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdown);
    };
  }, [isBreathingSessionActive, breathingPhase, completedBreaths]);

  const startBreathingSession = () => {
    setCompletedBreaths(0);
    setBreathingPhase('inhale');
    setSessionCompleted(false);
    setPhaseSecondsLeft(PHASE_SECONDS.inhale);
    setIsBreathingSessionActive(true);
  };

  const handleContinueToCheckIn = () => {
    onFocusAction?.();
  };

  const getPhaseLabel = () => {
    if (breathingPhase === 'inhale') return 'Andas in';
    if (breathingPhase === 'exhale') return 'Andas ut';
    if (breathingPhase === 'hold') return 'Paus';
    return 'Klart';
  };

  const activeBreathNumber = Math.min(completedBreaths + 1, BREATH_COUNT_TARGET);
  const completedPhaseOffset =
    breathingPhase === 'inhale' ? 0 : breathingPhase === 'exhale' ? 1 : breathingPhase === 'hold' ? 2 : 3;
  const totalPhases = BREATH_COUNT_TARGET * 3;
  const completedPhases = sessionCompleted
    ? totalPhases
    : Math.min(completedBreaths * 3 + completedPhaseOffset, totalPhases);
  const breathingProgress = Math.round((completedPhases / totalPhases) * 100);

  return (
    <div className="relative overflow-hidden mb-4">
      <div className="world-class-container relative z-10 pt-4 pb-2">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

          {/* Welcome Text Section */}
          <div className="flex-1 min-w-0 animate-fade-in-up">
            <div className="flex items-center gap-4 mb-2">
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold tracking-wide uppercase">
                {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif font-medium text-neutral-900 dark:text-neutral-50 tracking-tight leading-tight mb-4">
              {greeting}, <br className="hidden sm:block" />
              <span className="text-primary-600 dark:text-primary-400 bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-500">
                {userName}
              </span>
            </h1>

            <p className="text-lg text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed">
              Hur känns din energi idag? Ta en stund och landa innan du börjar.
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <span
                className={`inline-block w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
                aria-hidden="true"
              />
              <span>
                {isLoading
                  ? 'Uppdaterar data...'
                  : `Uppdateras automatiskt${getSmartTimestamp(lastUpdatedAt)}`}
              </span>
            </div>
          </div>

          {/* Visual Anchor Section - The "Breathing" Card */}
          <div 
            ref={breathingCardRef}
            tabIndex={isBreathingSessionActive ? 0 : -1}
            role="region"
            aria-label="Andningsövning"
            className="w-full lg:w-auto mt-6 lg:mt-0 animate-fade-in-up" 
            style={{ animationDelay: '200ms' }}
          >
            <div 
              className="p-6 rounded-[2rem] flex items-center gap-6 w-full sm:min-w-[300px] max-w-sm bg-white/85 dark:bg-slate-800/85 border border-white/70 dark:border-white/15 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.45)]"
              aria-live="polite"
              aria-atomic="true"
            >
              <BreathingOrb />
              <div>
                <h3 className="font-serif text-lg text-neutral-900 dark:text-slate-100 mb-1">{focusContent.title}</h3>
                <p className="text-sm text-neutral-700 dark:text-slate-300 leading-snug">
                  {focusContent.description}
                </p>
                <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400" aria-live="polite">
                  {isBreathingSessionActive
                    ? `Andetag ${activeBreathNumber} av ${BREATH_COUNT_TARGET} · ${getPhaseLabel()} ${phaseSecondsLeft}s`
                    : sessionCompleted
                      ? 'Bra jobbat! Du har slutfört dagens 3 andetag.'
                      : 'Guidad övning: cirka 30 sekunder.'}
                </p>
                {(isBreathingSessionActive || sessionCompleted) && (
                  <div className="mt-2 h-1.5 w-full bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-500"
                      style={{ width: `${breathingProgress}%` }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={sessionCompleted ? handleContinueToCheckIn : startBreathingSession}
                  disabled={isBreathingSessionActive}
                  className="mt-3 inline-flex items-center rounded-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
                >
                  {isBreathingSessionActive
                    ? 'Guidad paus pågår...'
                    : sessionCompleted
                      ? 'Fortsätt till humörcheck-in'
                      : focusContent.actionLabel}
                </button>
                {isBreathingSessionActive && (
                  <button
                    type="button"
                    onClick={handleContinueToCheckIn}
                    className="mt-2 ml-2 inline-flex items-center rounded-full border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 text-xs font-semibold px-3 py-1.5 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
                  >
                    Hoppa över och fortsätt
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Background decorations */}
      <div className="absolute top-0 right-0 -z-10 opacity-30 dark:opacity-10 pointer-events-none overflow-hidden h-full w-full">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-secondary-200/40 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-primary-200/40 blur-[80px]" />
      </div>
    </div>
  );
};
