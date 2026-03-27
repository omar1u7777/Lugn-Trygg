import React, { useState, useEffect } from 'react';

interface DashboardHeaderProps {
  userName?: string;
  isLoading?: boolean;
  lastUpdatedAt?: Date;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 10) return "God morgon";
  if (hour < 14) return "God dag";
  if (hour < 18) return "God eftermiddag";
  return "God kväll";
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
}) => {
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    // Update greeting every minute
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
                <h3 className="font-serif text-lg text-neutral-900 dark:text-slate-100 mb-1">Dagens Fokus</h3>
                <p className="text-sm text-neutral-700 dark:text-slate-300 leading-snug">
                  Börja dagen med 3 djupa andetag. Följ orben.
                </p>
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
