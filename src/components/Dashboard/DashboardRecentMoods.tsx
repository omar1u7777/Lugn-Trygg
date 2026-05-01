import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoodLabel, getMoodEmoji } from '../../features/mood/utils';
import { Card } from '../ui/tailwind/Card';
import { getDashboardRegionProps } from '../../constants/accessibility';

interface MoodActivity {
  id: string;
  timestamp: Date;
  description: string;
  type: 'mood' | 'chat' | 'meditation' | 'achievement' | 'journal';
}

interface DashboardRecentMoodsProps {
  activities: MoodActivity[];
  isLoading?: boolean;
  maxHeight?: string;
}

const MOOD_LABEL_SCORES: Record<string, number> = {
  ledsen: 2,
  orolig: 3,
  neutral: 5,
  bra: 7,
  glad: 8,
  super: 10,
};

const extractMoodScore = (description: string): number | null => {
  // Match decimal scores like 8.5/10, 8.55/10, or integer scores like 8/10
  const explicitScoreMatch = description.match(/(\d{1,2}(?:\.\d+)?)\s*\/\s*10/);
  if (explicitScoreMatch) {
    const parsed = Number(explicitScoreMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
      return parsed;
    }
  }

  const normalized = description.toLowerCase();
  const matchedLabel = Object.keys(MOOD_LABEL_SCORES).find((label) =>
    normalized.includes(label)
  );
  if (matchedLabel && matchedLabel in MOOD_LABEL_SCORES) {
    return MOOD_LABEL_SCORES[matchedLabel];
  }

  return null;
};

const getScoreTailwindColor = (score: number | null): string => {
  if (score === null) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  if (score >= 9) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (score >= 7) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (score >= 5) return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  if (score >= 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
};

const getScoreBorderColor = (score: number | null): string => {
  if (score === null) return 'border-l-gray-300 dark:border-l-gray-600';
  if (score >= 9) return 'border-l-emerald-400 dark:border-l-emerald-500';
  if (score >= 7) return 'border-l-green-400 dark:border-l-green-500';
  if (score >= 5) return 'border-l-slate-400 dark:border-l-slate-500';
  if (score >= 3) return 'border-l-amber-400 dark:border-l-amber-500';
  return 'border-l-rose-400 dark:border-l-rose-500';
};

interface GroupedMoods {
  dateKey: string;
  dateLabel: string;
  items: {
    id: string;
    time: string;
    score: number | null;
    label: string;
    emoji: string;
    note: string;
  }[];
}

const groupMoodsByDate = (moodActivities: MoodActivity[]): GroupedMoods[] => {
  const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const groups = new Map<string, GroupedMoods>();

  for (const activity of moodActivities) {
    // Validate activity has required fields
    if (!activity.id || !activity.timestamp || !activity.description) {
      console.error('Invalid activity data:', activity);
      continue;
    }
    const date = new Date(activity.timestamp);
    // Validate timestamp - skip invalid dates
    if (isNaN(date.getTime())) {
      console.error('Invalid timestamp:', activity.timestamp);
      continue;
    }
    // Use local date for grouping to match locale display
    const dateKey = date.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const score = extractMoodScore(activity.description);
    const resolvedScore = score ?? 5;

    let group = groups.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        dateLabel: dateFormatter.format(date),
        items: [],
      };
      groups.set(dateKey, group);
    }

    group.items.push({
      id: activity.id,
      time: timeFormatter.format(date),
      score,
      label: getMoodLabel(resolvedScore),
      emoji: getMoodEmoji(resolvedScore),
      note: activity.description,
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey)
  );
};

export const DashboardRecentMoods: React.FC<DashboardRecentMoodsProps> = ({
  activities,
  isLoading = false,
  maxHeight = 'max-h-[420px]',
}) => {
  const { t } = useTranslation();
  const regionProps = getDashboardRegionProps('recentMoods');

  const groupedMoods = useMemo(() => {
    // Validate activities is an array
    if (!Array.isArray(activities)) {
      console.error('Activities is not an array:', activities);
      return [];
    }
    const moodActivities = activities.filter((a) => a.type === 'mood');
    return groupMoodsByDate(moodActivities);
  }, [activities]);

  if (isLoading) {
    return (
      <Card className="mb-6" aria-busy="true">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
              <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (groupedMoods.length === 0) {
    return (
      <Card className="mb-6">
        <div className="p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">📝</span>
            {t('worldDashboard.latestMoods', 'Dina Senaste Humör')}
          </h3>
          <div className="text-center py-8">
            <span className="text-4xl mb-2 block opacity-50" aria-hidden="true">📭</span>
            <p className="text-gray-500 dark:text-gray-400">
              {t('worldDashboard.noMoodsYet', 'Inga humör loggade än. Börja logga ditt humör idag!')}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <section className="mb-6" {...regionProps}>
      <Card>
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">📝</span>
              {t('worldDashboard.latestMoods', 'Dina Senaste Humör')}
            </h3>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
              {groupedMoods.reduce((sum, g) => sum + g.items.length, 0)}{' '}
              {t('dashboard.moodLogs', 'Humörloggar')}
            </span>
          </div>

          <div className={`${maxHeight} overflow-y-auto pr-1 space-y-6`}>
            {groupedMoods.map((group) => (
              <div key={group.dateKey}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm py-1 z-10">
                  {group.dateLabel}
                </h4>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`relative rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 p-3 sm:p-4 border-l-4 ${getScoreBorderColor(item.score)} hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span
                            className="text-xl sm:text-2xl flex-shrink-0"
                            aria-hidden="true"
                          >
                            {item.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {item.label}
                              </span>
                              {item.score !== null && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${getScoreTailwindColor(item.score)}`}
                                >
                                  {item.score}/10
                                </span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                                {item.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <time className="text-xs font-medium text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">
                          {item.time}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
};
