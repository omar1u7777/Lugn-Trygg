import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDashboardRegionProps } from '../../constants/accessibility';

// 🎨 Konstanta färgobjekt - flyttade utanför komponent för prestanda
const BG_COLORS = {
  primary: 'bg-primary-50 dark:bg-primary-900/10 text-primary-900 dark:text-primary-100',
  secondary: 'bg-secondary-50 dark:bg-secondary-900/10 text-secondary-900 dark:text-secondary-100',
  accent: 'bg-accent-50 dark:bg-accent-900/10 text-accent-900 dark:text-accent-100',
  neutral: 'bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-neutral-100'
} as const;

const ICON_COLORS = {
  primary: 'bg-primary-100 text-primary-600',
  secondary: 'bg-secondary-100 text-secondary-600',
  accent: 'bg-accent-100 text-accent-600',
  neutral: 'bg-neutral-100 text-neutral-600'
} as const;

export interface DashboardStatsData {
  streakDays: number;
  achievementsCount: number;
  averageMood?: number;
  totalChats?: number;
  moodSamples?: number[];
  moodTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  streakTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  chatsTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  achievementsTrend?: { direction: 'up' | 'down' | 'stable'; value: string };
  // Additional data for enhanced UX
  longestStreak?: number;
  nextAchievementIn?: number;
  totalMoodLogs?: number;
  weeklyChats?: number;
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
  trend?: { direction: 'up' | 'down' | 'stable'; value: string; } | undefined;
  color: 'primary' | 'secondary' | 'accent' | 'neutral';
  large?: boolean;
  children?: React.ReactNode;
  subtitle?: string;
  valueClassName?: string;
  label?: string | undefined;
  ariaLabel?: string;
  t: (key: string) => string;
}> = ({ title, value, icon, className = '', trend, color, large, children, subtitle, valueClassName, label, ariaLabel, t }) => {
  
  const bgColors = BG_COLORS;
  const iconColors = ICON_COLORS;

  const trendConfig = {
    up: { icon: '✦', label: t('dashboardStats.positiveDevelopment'), color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    down: { icon: '~', label: t('dashboardStats.naturallyVarying'), color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
    stable: { icon: '○', label: t('dashboardStats.stable'), color: 'bg-white/90 text-neutral-700 dark:bg-slate-700/80 dark:text-neutral-200 shadow-sm' }
  };

  const currentTrend = trend ? trendConfig[trend.direction] : null;

  return (
    <div 
      className={`relative overflow-hidden rounded-[2rem] p-6 transition-all duration-300 
        hover:scale-[1.02] hover:shadow-lg border border-transparent hover:border-black/5 
        active:scale-[0.98] cursor-pointer select-none min-h-[160px]
        ${bgColors[color]} ${className}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div 
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl 
            ${iconColors[color]} bg-opacity-50 transition-transform duration-200`}
        >
          {icon}
        </div>
        {trend && currentTrend && (
          <span 
            className={`text-xs font-medium px-2 sm:px-2.5 py-1 rounded-full backdrop-blur-sm 
              transition-colors duration-200 ${currentTrend.color}`}
            title={t('dashboardStats.trendTooltip', { label: currentTrend.label })}
          >
            {currentTrend.icon} {currentTrend.label}
          </span>
        )}
      </div>

      <div>
        <p className="text-sm font-medium opacity-70 mb-1 uppercase tracking-wider">
          {title}
        </p>
        <h3 
          className={valueClassName || `font-serif font-bold text-2xl sm:text-3xl ${large ? 'lg:text-4xl' : ''}`}
          aria-label={ariaLabel}
        >
          {value}
        </h3>
        {label && (
          <p className="text-xs mt-1 font-medium text-rose-600 dark:text-rose-400">
            {label}
          </p>
        )}
        {subtitle && (
          <p className="text-xs mt-1 opacity-60">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </div>
  );
};

/**
 * Consistency Progress Component
 * Ny design utan loss aversion - fokuserar på tillväxt istället för "streak"
 */
const ConsistencyProgress: React.FC<{ current: number; total: number; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ 
  current, 
  total,
  t,
}) => {
  const percentage = useMemo(() => {
    if (total === 0) return 0;
    return Math.min((current / total) * 100, 100);
  }, [current, total]);

  const encouragementKey = current === 0 ? 'dashboardStats.encouragement0'
    : current === 1 ? 'dashboardStats.encouragement1'
    : current === 2 ? 'dashboardStats.encouragement2'
    : current >= 3 && current < 5 ? 'dashboardStats.encouragement3'
    : 'dashboardStats.encouragement5';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-500">{t('dashboardStats.yourActivity')}</span>
        <span className="font-medium text-gray-700">{t('dashboardStats.activityOfTotal', { current, total })}</span>
      </div>
      
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <p className="mt-1.5 text-xs text-gray-500">
        {t(encouragementKey)}
      </p>
    </div>
  );
};

/**
 * Achievement Progress Component
 * Shows progress toward next milestone
 */
const AchievementProgress: React.FC<{ 
  count: number; 
  nextIn?: number;
}> = ({ count, nextIn }) => {
  const { t } = useTranslation();
  
  // 🎯 Special case for new users - welcoming message instead of progress
  if (count === 0) {
    return (
      <div className="mt-3">
        <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
          {t('dashboardStats.startJourney')}
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: '5%' }}
          />
        </div>
      </div>
    );
  }

  if (!nextIn || nextIn <= 0) {
    return (
      <div className="mt-3 text-xs text-emerald-600 font-medium">
        {t('dashboardStats.allAchievementsUnlocked')}
      </div>
    );
  }

  // Calculate actual progress toward next milestone
  const milestones = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50];
  const currentMilestone = milestones.find(m => m > count) || 50;
  const previousMilestone = milestones[milestones.indexOf(currentMilestone) - 1] || 0;
  const progressInMilestone = count - previousMilestone;
  const milestoneSize = currentMilestone - previousMilestone;
  const progress = Math.min((progressInMilestone / milestoneSize) * 100, 100);
  
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500">{t('dashboardStats.nextMilestone')}</span>
        <span className="font-medium text-gray-700">{count} / {currentMilestone}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neutral-400 to-neutral-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {nextIn === 1 
          ? t('dashboardStats.almostThere') 
          : t('dashboardStats.activitiesToNext', { count: nextIn })}
      </p>
    </div>
  );
};

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, isLoading = false }) => {
  const { t } = useTranslation();
  const regionProps = getDashboardRegionProps('stats');

  // Memoize trend calculation to prevent unnecessary recalculations
  // (mood trend removed — mood shown in SuperMoodLogger above)

  // Calculate next achievement milestone
  const nextAchievementIn = useMemo(() => {
    const count = stats.achievementsCount || 0;
    // Milestones at 1, 3, 5, 10, 15, 20, 25, 30, 40, 50
    const milestones = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50];
    const next = milestones.find(m => m > count);
    return next ? next - count : 0;
  }, [stats.achievementsCount]);

  // 🎯 Dynamisk streak display med singular/plural
  const streakText = useMemo(() => {
    const days = stats.streakDays;
    return t('dashboardStats.streakDays', { count: days });
  }, [stats.streakDays, t]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mt-8 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div 
            key={i} 
            className="h-40 bg-gray-100 dark:bg-gray-800 rounded-[2rem]" 
          />
        ))}
      </div>
    );
  }

  return (
    <section className="mt-8" {...regionProps}>
      <h2 className="sr-only">{t('dashboardStats.sectionTitle')}</h2>

      {/* Bento Grid Layout - Streak + Achievements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 auto-rows-[minmax(180px,auto)]">

        {/* Streak Card - Ny "consistency" design utan loss aversion */}
        <BentoItem
          title={t('dashboardStats.streakTitle')}
          value={streakText}
          icon="🌱"
          color="accent"
          trend={{ direction: 'up', value: t('dashboardStats.streakActive') }}
          t={t}
        >
          <ConsistencyProgress 
            current={stats.streakDays} 
            total={stats.longestStreak || Math.max(stats.streakDays * 2, 7)}
            t={t}
          />
        </BentoItem>

        {/* Achievements Card with Progress */}
        <BentoItem
          title={t('dashboardStats.achievementsTitle')}
          value={stats.achievementsCount}
          icon="🏆"
          color="neutral"
          trend={nextAchievementIn > 0 ? { direction: 'up', value: t('dashboardStats.progressOngoing') } : { direction: 'up', value: t('dashboardStats.allUnlocked') }}
          t={t}
        >
          <AchievementProgress 
            count={stats.achievementsCount} 
            nextIn={nextAchievementIn} 
          />
        </BentoItem>
      </div>
    </section>
  );
};
