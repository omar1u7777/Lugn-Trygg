import React, { useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { getDashboardRegionProps } from '../../constants/accessibility';
import { formatNumber } from '../../utils/intlFormatters';

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
  averageMood: number;
  streakDays: number;
  totalChats: number;
  achievementsCount: number;
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
 * Derive mood trend with psychological reframing
 * 
 * Psychological principles:
 * - Avoid negative labeling ("Nedåtgående" → "Varierande")
 * - Emphasize normalcy of emotional fluctuation
 * - Focus on self-awareness rather than performance
 */
const deriveMoodTrend = (
  moodSamples: number[] | undefined,
  averageMood: number
): { direction: 'up' | 'down' | 'stable'; value: string } => {
  const validSamples = (moodSamples || []).filter(
    (sample) => Number.isFinite(sample) && sample >= 0 && sample <= 10
  );

  if (validSamples.length < 2) {
    return { 
      direction: 'stable', 
      value: averageMood <= 4 ? 'Måendet behöver uppmärksamhet' : 'Stabilt överlag' 
    };
  }
  
  const mean = validSamples.reduce((sum, value) => sum + value, 0) / validSamples.length;
  const variance =
    validSamples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / validSamples.length;
  const standardDeviation = Math.sqrt(variance);
  const firstSample = validSamples[0];
  const lastSample = validSamples[validSamples.length - 1];
  
  if (firstSample === undefined || lastSample === undefined) {
    return { direction: 'stable', value: 'Ingen data' };
  }
  
  const changeOverPeriod = lastSample - firstSample;
  const latestScore = lastSample;

  // Psychologically-informed trend labeling
  // "Nedåtgående" reframed to "Utforskande" - neutral, curious framing
  if (changeOverPeriod <= -2 && latestScore <= 7) {
    return { direction: 'down', value: 'Utforskande fas' };
  }

  // "Fluktuerande" reframed to "Varierande" - more natural, less clinical
  if (standardDeviation >= 1.8) {
    return { direction: 'stable', value: 'Naturligt varierande' };
  }

  if (changeOverPeriod >= 2) {
    return { direction: 'up', value: 'Positiv utveckling' };
  }

  return { direction: 'stable', value: 'Balanserat' };
};

/**
 * Mini Sparkline Chart Component
 * Shows last 7 mood entries as a visual trend
 */
const MoodSparkline: React.FC<{ samples: number[] }> = ({ samples }) => {
  const validSamples = samples.filter(s => Number.isFinite(s) && s >= 0 && s <= 10);
  if (validSamples.length < 2) return null;

  // Take last 7 samples
  const recentSamples = validSamples.slice(-7);
  const min = Math.min(...recentSamples);
  const max = Math.max(...recentSamples);
  const range = max - min || 1;

  // Create SVG path
  const width = 100;
  const height = 24;
  const points = recentSamples.map((value, index) => {
    const x = (index / (recentSamples.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  // Use stable unique gradient ID to avoid conflicts with multiple sparklines
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `sparklineGradient-${uniqueId}`;

  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-6 mt-3 overflow-visible"
      aria-hidden="true"
    >
      {/* Gradient area under line */}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      
      {/* Area fill */}
      <path
        d={`${pathD} L ${width},${height} L 0,${height} Z`}
        fill={`url(#${gradientId})`}
      />
      
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Dots for each point */}
      {points.map((point, i) => {
        const [x, y] = point.split(',').map(Number);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="currentColor"
            className="opacity-60"
          />
        );
      })}
    </svg>
  );
};

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
}> = ({ title, value, icon, className = '', trend, color, large, children, subtitle, valueClassName, label, ariaLabel }) => {
  
  const bgColors = BG_COLORS;
  const iconColors = ICON_COLORS;

  // Psychologically-informed trend icons and labels
  const trendConfig = {
    up: { icon: '✦', label: 'Positiv utveckling', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    down: { icon: '~', label: 'Naturlig variation', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
    stable: { icon: '○', label: 'Stabilt', color: 'bg-white/90 text-neutral-700 dark:bg-slate-700/80 dark:text-neutral-200 shadow-sm' }
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
            title={`Visar din måendets riktning över tid: ${currentTrend.label}`}
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
const ConsistencyProgress: React.FC<{ current: number; total: number }> = ({ 
  current, 
  total 
}) => {
  const percentage = useMemo(() => {
    if (total === 0) return 0;
    return Math.min((current / total) * 100, 100);
  }, [current, total]);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-500">Din aktivitet</span>
        <span className="font-medium text-gray-700">{current} av {total} {total === 1 ? 'dag' : 'dagar'}</span>
      </div>
      
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <p className="mt-1.5 text-xs text-gray-500">
        {current === 1 && '🌱 Bra start! Fortsätt så.'}
        {current === 2 && '🌱 Fin rytm byggs upp!'}
        {current >= 3 && current < 5 && '✨ Stark konsekvens!'}
        {current >= 5 && '🔥 Imponerande dedikation!'}
        {current === 0 && '🌱 Varje dag är en ny möjlighet'}
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
  const moodTrend = useMemo(
    () => stats.moodTrend || deriveMoodTrend(stats.moodSamples, stats.averageMood),
    [stats.moodTrend, stats.moodSamples, stats.averageMood]
  );

  // Memoize mood samples count for subtitle
  const moodSampleCount = useMemo(
    () => (stats.moodSamples || []).filter(s => Number.isFinite(s)).length,
    [stats.moodSamples]
  );

  // Calculate next achievement milestone
  const nextAchievementIn = useMemo(() => {
    const count = stats.achievementsCount || 0;
    // Milestones at 1, 3, 5, 10, 15, 20, 25, 30, 40, 50
    const milestones = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50];
    const next = milestones.find(m => m > count);
    return next ? next - count : 0;
  }, [stats.achievementsCount]);

  // 💚 Psykologisk säkerhetsspärr för lågt mående
  const showSafetyBlock = stats.averageMood <= 4 && stats.averageMood > 0;

  // 🎯 Dynamisk mood display - mindre klinisk för låga värden
  const moodDisplay = useMemo(() => {
    const score = stats.averageMood;
    const isSwedish = t('dashboardStats.days') === 'dagar';
    
    if (score <= 4 && score > 0) {
      // För lågt mående: hela tal, varm text, mindre font, kvalitativ etikett
      return {
        value: `${Math.round(score)} ${isSwedish ? 'av' : 'of'} 10`, // "3 av 10" inte "3,0/10"
        className: 'font-serif font-bold text-xl sm:text-2xl text-rose-600 dark:text-rose-400',
        label: t('dashboardStats.hardDay'),
        ariaLabel: t('dashboardStats.moodAriaLabel', { score: Math.round(score) }),
      };
    }
    
    return {
      value: `${formatNumber(score, { minimumFractionDigits: 1 })} ${isSwedish ? 'av' : 'of'} 10`,
      className: `font-serif font-bold text-2xl sm:text-3xl ${score >= 7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-secondary-600 dark:text-secondary-400'}`,
      label: undefined,
      ariaLabel: t('dashboardStats.yourMood', { score: formatNumber(score, { minimumFractionDigits: 1 }) }),
    };
  }, [stats.averageMood, t]);

  // 🎯 Dynamisk streak display med singular/plural
  const streakText = useMemo(() => {
    const days = stats.streakDays;
    return `${days} ${days === 1 ? 'dag' : 'dagar'}`;
  }, [stats.streakDays]);
  const weeklyContext = useMemo(() => {
    const weekly = stats.weeklyChats || 0;
    if (weekly === 0) return t('dashboardStats.noChatsThisWeek');
    if (weekly === 1) return t('dashboardStats.oneChatThisWeek');
    return t('dashboardStats.chatsThisWeek', { count: weekly });
  }, [stats.weeklyChats, t]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-8 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`h-40 bg-gray-100 dark:bg-gray-800 rounded-[2rem] ${i === 0 ? 'md:col-span-2' : ''}`} 
          />
        ))}
      </div>
    );
  }

  return (
    <section className="mt-8" {...regionProps}>
      <h2 className="sr-only">{t('dashboardStats.sectionTitle')}</h2>

      {/* Bento Grid Layout - Enhanced 2026 Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 auto-rows-[minmax(180px,auto)]">

        {/* Main Hero Card - Mood with Sparkline */}
        <BentoItem
          title={t('dashboardStats.moodTitle')}
          value={moodDisplay.value}
          valueClassName={moodDisplay.className}
          label={moodDisplay.label}
          ariaLabel={moodDisplay.ariaLabel}
          icon="❤️"
          color="secondary"
          large
          className="md:col-span-2 md:row-span-1"
          trend={showSafetyBlock ? undefined : moodTrend}
          subtitle={t('dashboardStats.basedOnLogs', { count: moodSampleCount })}
        >
          {/* Mini sparkline - dold på mobil för att spara plats */}
          {stats.moodSamples && stats.moodSamples.length > 1 && (
            <div className="hidden sm:block">
              <MoodSparkline samples={stats.moodSamples} />
            </div>
          )}
          
          {/* 💚 Psykologisk säkerhetsspärr för lågt mående */}
          {showSafetyBlock && (
            <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                {t('dashboardStats.itsOkay')}
              </p>
              <div className="mt-2 flex gap-2">
                <a 
                  href="/ai-chat" 
                  className="text-xs bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700 transition-colors"
                >
                  {t('dashboardStats.talkToAI')}
                </a>
                <a 
                  href="/crisis" 
                  className="text-xs bg-white text-rose-600 border border-rose-600 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                >
                  {t('dashboardStats.getHelp')}
                </a>
              </div>
            </div>
          )}
        </BentoItem>

        {/* Streak Card - Ny "consistency" design utan loss aversion */}
        <BentoItem
          title={t('dashboardStats.streakTitle')}
          value={streakText}
          icon="🌱"
          color="accent"
          trend={{ direction: 'up', value: t('dashboardStats.streakActive') }}
        >
          <ConsistencyProgress 
            current={stats.streakDays} 
            total={stats.longestStreak || Math.max(stats.streakDays * 2, 7)} 
          />
        </BentoItem>

        {/* Chats Card with Weekly Context */}
        <BentoItem
          title={t('dashboardStats.chatsTitle')}
          value={formatNumber(stats.totalChats)}
          icon="💬"
          color="primary"
          trend={{ direction: 'stable', value: t('dashboardStats.total') }}
          subtitle={weeklyContext}
        />

        {/* Achievements Card with Progress */}
        <BentoItem
          title={t('dashboardStats.achievementsTitle')}
          value={stats.achievementsCount}
          icon="🏆"
          color="neutral"
          className="md:col-span-4 lg:col-span-4"
          trend={nextAchievementIn > 0 ? { direction: 'up', value: t('dashboardStats.progressOngoing') } : { direction: 'up', value: t('dashboardStats.allUnlocked') }}
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
