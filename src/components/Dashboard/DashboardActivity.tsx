import React from 'react';
import { getDashboardRegionProps } from '../../constants/accessibility';
import { formatRelativeTimeFromNow } from '../../utils/intlFormatters';

export interface ActivityItem {
  id: string;
  type: 'mood' | 'chat' | 'achievement' | 'meditation' | 'journal';
  timestamp: Date;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

interface DashboardActivityProps {
  activities: ActivityItem[];
  emptyStateMessage?: string;
  isLoading?: boolean;
}

/**
 * 2026 Timeline Item Component
 * Renders a single activity event in a vertical timeline.
 */
const TimelineItem: React.FC<{ activity: ActivityItem; index: number }> = ({ activity, index }) => {
  const isFirst = index === 0;

  return (
    <div
      className="relative pl-8 sm:pl-10 group"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Connector Line (masked at top for first item) */}
      {!isFirst && (
        <div className="absolute left-[19px] sm:left-[23px] -top-8 h-8 w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
      )}

      {/* Timeline Dot/Icon */}
      <div
        className={`absolute left-0 top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center z-10 
          transform transition-transform duration-300 group-hover:scale-110 shadow-sm
          ${activity.id.includes('mood') ? 'bg-pink-50 text-pink-500 dark:bg-pink-900/20 dark:text-pink-300' :
            activity.id.includes('chat') ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-300' :
              'bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300'}
        `}
      >
        <span className="text-xl sm:text-2xl filter drop-shadow-sm">{activity.icon}</span>
      </div>

      {/* Content Card */}
      <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-white/20 dark:border-white/5 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-300 hover:shadow-md ml-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 leading-snug">
              {activity.description}
            </p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
              {formatRelativeTimeFromNow(activity.timestamp)}
            </p>
          </div>

          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${activity.colorClass} bg-opacity-10 opacity-70`}>
            {activity.type}
          </span>
        </div>
      </div>

      {/* Continuous Line downwards */}
      <div className="absolute left-[19px] sm:left-[23px] top-10 bottom-[-32px] w-0.5 bg-gray-200 dark:bg-gray-700 group-last:hidden" aria-hidden="true" />
    </div>
  );
};

export const DashboardActivity: React.FC<DashboardActivityProps> = ({
  activities,
  emptyStateMessage = 'Ingen aktivitet än. Börja logga ditt humör!',
  isLoading = false,
}) => {
  const regionProps = getDashboardRegionProps('activity');

  if (isLoading) {
    return (
      <div className="space-y-8 pl-8 sm:pl-10 animate-pulse relative">
        <div className="absolute left-[19px] sm:left-[23px] top-0 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative">
            <div className="absolute left-[-40px] top-0 w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="ml-4 h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <section {...regionProps}>
        <div className="p-12 text-center rounded-[2.5rem] bg-gray-50/50 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4 opacity-50 grayscale" aria-hidden="true">📊</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">{emptyStateMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section {...regionProps} className="relative py-4">
      <h2 className="world-class-heading-2 mb-8 flex items-center gap-3">
        <span className="w-2 h-8 rounded-full bg-primary-400 block" />
        Senaste Aktivitet
      </h2>

      <div className="space-y-8 relative">
        {activities.slice(0, 8).map((activity, index) => (
          <TimelineItem
            key={activity.id}
            activity={activity}
            index={index}
          />
        ))}
      </div>

      {activities.length > 8 && (
        <div className="text-center mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
          <button className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
            Visa äldre aktiviteter
          </button>
        </div>
      )}
    </section>
  );
};
