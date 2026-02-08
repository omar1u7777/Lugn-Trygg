import React from 'react';
import { Card } from '../ui/tailwind/Card';
import { DASHBOARD_REGION_MAP, getDashboardRegionProps } from '../../constants/accessibility';
import { formatNumber } from '../../utils/intlFormatters';

export interface DashboardStatsData {
  averageMood: number;
  streakDays: number;
  totalChats: number;
  achievementsCount: number;
  moodTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  streakTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  chatsTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  achievementsTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
}

interface DashboardStatsProps {
  stats: DashboardStatsData;
  isLoading?: boolean;
}

/**
 * Bento Grid Item Component
 */
const BentoItem: React.FC<{
  title: string;
  value: string | number;
  icon: string;
  className?: string;
  trend?: { direction: 'up' | 'down' | 'stable'; value: string };
  color: 'primary' | 'secondary' | 'accent' | 'neutral';
  large?: boolean;
}> = ({ title, value, icon, className = '', trend, color, large }) => {
  const bgColors = {
    primary: 'bg-primary-50 dark:bg-primary-900/10 text-primary-900 dark:text-primary-100',
    secondary: 'bg-secondary-50 dark:bg-secondary-900/10 text-secondary-900 dark:text-secondary-100',
    accent: 'bg-accent-50 dark:bg-accent-900/10 text-accent-900 dark:text-accent-100',
    neutral: 'bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-neutral-100'
  };

  const iconColors = {
    primary: 'bg-primary-100 text-primary-600',
    secondary: 'bg-secondary-100 text-secondary-600',
    accent: 'bg-accent-100 text-accent-600',
    neutral: 'bg-neutral-100 text-neutral-600'
  };

  return (
    <div className={`relative overflow-hidden rounded-[2rem] p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-transparent hover:border-black/5 ${bgColors[color]} ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${iconColors[color]} bg-opacity-50`}>
          {icon}
        </div>
        {trend && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/50 backdrop-blur-sm">
            {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'} {trend.value}
          </span>
        )}
      </div>

      <div>
        <p className="text-sm font-medium opacity-70 mb-1 uppercase tracking-wider">{title}</p>
        <h3 className={`font-serif font-bold ${large ? 'text-4xl' : 'text-3xl'}`}>
          {value}
        </h3>
      </div>

      {large && (
        <div className="absolute right-0 bottom-0 w-32 h-32 opacity-10 translate-x-8 translate-y-8 rotate-12 pointer-events-none">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 0 L100 50 L50 100 L0 50 Z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, isLoading = false }) => {
  const regionProps = getDashboardRegionProps('stats');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`h-40 bg-gray-100 dark:bg-gray-800 rounded-[2rem] ${i === 0 ? 'md:col-span-2' : ''}`} />
        ))}
      </div>
    );
  }

  return (
    <section className="mt-8" {...regionProps}>
      <h2 className="sr-only">Statistik Översikt</h2>

      {/* Bento Grid Layout - 2026 Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 auto-rows-[minmax(180px,auto)]">

        {/* Main Hero Card - Mood */}
        <BentoItem
          title="Ditt Mående"
          value={`${formatNumber(stats.averageMood, { minimumFractionDigits: 1 })}/10`}
          icon="❤️"
          color="secondary"
          large
          className="md:col-span-2 md:row-span-1"
          trend={{
            direction: 'stable',
            value: 'Stabilt'
          }}
        />

        {/* Secondary Card - Streak */}
        <BentoItem
          title="Nuvarande Streak"
          value={`${stats.streakDays} dagar`}
          icon="🔥"
          color="accent"
          trend={{ direction: 'up', value: 'Ökar' }}
        />

        {/* Tertiary Card - Chats */}
        <BentoItem
          title="AI Samtal"
          value={stats.totalChats}
          icon="💬"
          color="primary"
          trend={{ direction: 'stable', value: 'Totalt' }}
        />

        {/* Quaternary Card - Achievements */}
        <BentoItem
          title="Achievements"
          value={stats.achievementsCount}
          icon="🏆"
          color="neutral"
          className="md:col-span-4 lg:col-span-4"
        />
      </div>
    </section>
  );
};
