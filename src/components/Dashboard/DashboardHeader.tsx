import React, { useState, useEffect } from 'react';

interface DashboardHeaderProps {
  userName?: string;
  isLoading?: boolean;
  lastUpdatedAt?: Date;
  onFocusAction?: () => void;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 10) return "God morgon";
  if (hour < 14) return "God dag";
  if (hour < 18) return "God eftermiddag";
  return "God kväll";
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
}) => {
  const [greeting, setGreeting] = useState(getGreeting());
  const [focusContent, setFocusContent] = useState(getDailyFocusContent());
  const [isBreathingSessionActive, setIsBreathingSessionActive] = useState(false);
  const [completedBreaths, setCompletedBreaths] = useState(0);
  const [breathingPhase, setBreathingPhase] = useState<BreathingPhase>('inhale');
  const [sessionCompleted, setSessionCompleted] = useState(false);

  useEffect(() => {
    // Update greeting every minute
    const interval = setInterval(() => {
      setGreeting(getGreeting());
      setFocusContent(getDailyFocusContent());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isBreathingSessionActive || breathingPhase === 'done') {
      return;
    }

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
      if (nextCompleted >= 3) {
        setCompletedBreaths(3);
        setBreathingPhase('done');
        setIsBreathingSessionActive(false);
        setSessionCompleted(true);
        return;
      }

      setCompletedBreaths(nextCompleted);
      setBreathingPhase('inhale');
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [isBreathingSessionActive, breathingPhase, completedBreaths]);

  const startBreathingSession = () => {
    setCompletedBreaths(0);
    setBreathingPhase('inhale');
    setSessionCompleted(false);
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

  const activeBreathNumber = Math.min(completedBreaths + 1, 3);

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
                  ? 'Uppdaterar data automatiskt...'
                  : `Uppdateras automatiskt${lastUpdatedAt ? ` · Senast ${lastUpdatedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
              </span>
            </div>
          </div>

          {/* Visual Anchor Section - The "Breathing" Card */}
          <div className="w-full lg:w-auto mt-6 lg:mt-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="p-6 rounded-[2rem] flex items-center gap-6 w-full sm:min-w-[300px] max-w-sm bg-white/85 dark:bg-slate-800/85 border border-white/70 dark:border-white/15 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.45)]">
              <BreathingOrb />
              <div>
                <h3 className="font-serif text-lg text-neutral-900 dark:text-slate-100 mb-1">{focusContent.title}</h3>
                <p className="text-sm text-neutral-700 dark:text-slate-300 leading-snug">
                  {focusContent.description}
                </p>
                <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400" aria-live="polite">
                  {isBreathingSessionActive
                    ? `Andetag ${activeBreathNumber} av 3 · ${getPhaseLabel()}`
                    : sessionCompleted
                      ? 'Bra jobbat! 3 av 3 andetag klara.'
                      : 'Guidad övning: cirka 20 sekunder.'}
                </p>
                {isBreathingSessionActive && (
                  <div className="mt-2 h-1.5 w-full bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-500"
                      style={{ width: `${(completedBreaths / 3) * 100}%` }}
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
