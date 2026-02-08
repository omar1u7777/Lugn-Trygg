import React, { useState, useEffect } from 'react';
import OptimizedImage from '../ui/OptimizedImage';
import { getDashboardHeroImageId } from '../../config/env';

interface DashboardHeaderProps {
  userName?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const HERO_FALLBACK_SRC = 'https://res.cloudinary.com/dxmijbysc/image/upload/c_scale,w_auto,dpr_auto,q_auto,f_auto/hero-bild_pfcdsx.jpg';
const HERO_IMAGE_ID = getDashboardHeroImageId();
const HERO_SIZES = '(min-width: 1280px) 560px, (min-width: 1024px) 480px, (min-width: 768px) 60vw, 90vw';

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
  onRefresh,
  isLoading = false,
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
    <div className="relative overflow-hidden mb-8">
      <div className="world-class-container relative z-10 pt-8 pb-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

          {/* Welcome Text Section */}
          <div className="flex-1 min-w-0 animate-fade-in-up">
            <div className="flex items-center gap-4 mb-2">
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold tracking-wide uppercase">
                {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-medium text-neutral-900 dark:text-neutral-50 tracking-tight leading-tight mb-4">
              {greeting}, <br className="hidden sm:block" />
              <span className="text-primary-600 dark:text-primary-400 bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-500">
                {userName}
              </span>
            </h1>

            <p className="text-lg text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed">
              Hur känns din energi idag? Ta en stund och landa innan du börjar.
            </p>

            <div className="mt-8 flex items-center gap-4">
              {/* Quick Action Button - Example */}
              {onRefresh && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isLoading) onRefresh();
                  }}
                  disabled={isLoading}
                  className="group flex items-center gap-3 px-6 py-3 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  <span>{isLoading ? 'Uppdaterar...' : 'Uppdatera vy'}</span>
                  <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Visual Anchor Section - The "Breathing" Card */}
          <div className="w-full lg:w-auto mt-6 lg:mt-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="glass-panel dark:glass-panel-dark p-6 rounded-[2rem] flex items-center gap-6 min-w-[300px] max-w-sm">
              <BreathingOrb />
              <div>
                <h3 className="font-serif text-lg text-neutral-900 dark:text-white mb-1">Dagens Fokus</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-snug">
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
