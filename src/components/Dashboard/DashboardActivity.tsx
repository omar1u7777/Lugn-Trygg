import React, { useEffect, useMemo, useRef, useState } from 'react';
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

interface ActivityGroup {
  key: 'today' | 'yesterday' | 'earlier-this-year' | 'older';
  label: string;
  items: ActivityItem[];
}

const MAX_VISIBLE_ACTIVITIES = 12; 
const LOAD_MORE_BATCH_SIZE = 12;

const getActivityGroupKey = (timestamp: Date): ActivityGroup['key'] => {
  // Validate timestamp - if invalid, default to 'older'
  if (isNaN(timestamp.getTime())) {
    return 'older';
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (timestamp >= todayStart) {
    return 'today';
  }

  if (timestamp >= yesterdayStart) {
    return 'yesterday';
  }

  if (timestamp.getFullYear() === now.getFullYear()) {
    return 'earlier-this-year';
  }

  return 'older';
};

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

      {/* Timeline Dot/Icon - uses activity.type for reliable color matching */}
      <div
        className={`absolute left-0 top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center z-10 
          transform transition-transform duration-300 group-hover:scale-110 shadow-sm motion-reduce:transform-none
          ${activity.type === 'mood' ? 'bg-pink-50 text-pink-500 dark:bg-pink-900/20 dark:text-pink-300' :
            activity.type === 'chat' ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-300' :
              activity.type === 'meditation' ? 'bg-teal-50 text-teal-500 dark:bg-teal-900/20 dark:text-teal-300' :
                activity.type === 'journal' ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-300' :
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
  const [visibleCount, setVisibleCount] = useState(MAX_VISIBLE_ACTIVITIES);
  const prevActivityCountRef = useRef(0);

  useEffect(() => {
    const newNonMoodCount = activities.filter((a) => a.type !== 'mood').length;
    const prevNonMoodCount = prevActivityCountRef.current;

    // Only reset visibleCount if activities actually changed significantly
    // This preserves user's scroll position/load-more state on parent re-renders
    if (Math.abs(newNonMoodCount - prevNonMoodCount) > 5) {
      setVisibleCount(MAX_VISIBLE_ACTIVITIES);
    }

    prevActivityCountRef.current = newNonMoodCount;
  }, [activities]);

  const visibleActivities = useMemo(
    () => activities
      .filter((a) => a.type !== 'mood')
      .filter((a) => !isNaN(a.timestamp.getTime())) // Skip invalid timestamps
      .slice(0, visibleCount),
    [activities, visibleCount]
  );

  const nonMoodActivities = useMemo(
    () => activities.filter((a) => a.type !== 'mood').filter((a) => !isNaN(a.timestamp.getTime())),
    [activities]
  );

  const remainingActivities = Math.max(nonMoodActivities.length - visibleCount, 0);

  const groupedActivities = useMemo(() => {
    const groups: ActivityGroup[] = [
      { key: 'today', label: 'Idag', items: [] },
      { key: 'yesterday', label: 'Igår', items: [] },
      { key: 'earlier-this-year', label: 'Tidigare i år', items: [] },
      { key: 'older', label: 'Äldre', items: [] },
    ];

    visibleActivities.forEach((activity) => {
      const groupKey = getActivityGroupKey(activity.timestamp);
      const targetGroup = groups.find((group) => group.key === groupKey);
      if (targetGroup) {
        targetGroup.items.push(activity);
      }
    });

    return groups.filter((group) => group.items.length > 0);
  }, [visibleActivities]);

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

  if (nonMoodActivities.length === 0) {
    return (
      <section {...regionProps}>
        <div className="p-12 text-center rounded-[2.5rem] bg-gray-50/50 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4 opacity-50 grayscale" aria-hidden="true">📊</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {emptyStateMessage || 'Ingen aktivitet än. Börja chatta med AI-terapeuten eller prova en meditation!'}
          </p>
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

      <div className="space-y-10 relative">
        {groupedActivities.map((group) => (
          <div key={group.key}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {group.label}
            </h3>
            <div className="space-y-8">
              {group.items.map((activity, index) => (
                <TimelineItem
                  key={activity.id}
                  activity={activity}
                  index={index}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {remainingActivities > 0 && (
        <div className="text-center mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
          <button 
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            onClick={() => {
              setVisibleCount((prev) => Math.min(prev + LOAD_MORE_BATCH_SIZE, nonMoodActivities.length));
            }}
          >
            Visa äldre aktiviteter ({remainingActivities} till)
          </button>
        </div>
      )}
    </section>
  );
};
