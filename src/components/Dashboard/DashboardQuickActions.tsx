import React from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { QUICK_ACTIONS } from '../../config/appFeatures';
import { getDashboardRegionProps } from '../../constants/accessibility';

// 🎨 Constant color objects - moved outside component for performance
const BG_COLORS = {
  primary: 'bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30',
  secondary: 'bg-secondary-50 hover:bg-secondary-100 dark:bg-secondary-900/20 dark:hover:bg-secondary-900/30',
  accent: 'bg-accent-50 hover:bg-accent-100 dark:bg-accent-900/20 dark:hover:bg-accent-900/30',
  neutral: 'bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700'
} as const;

const ICON_COLORS = {
  primary: 'text-primary-600 dark:text-primary-400',
  secondary: 'text-secondary-600 dark:text-secondary-400',
  accent: 'text-accent-600 dark:text-accent-400',
  neutral: 'text-gray-600 dark:text-gray-400'
} as const;

interface DashboardQuickActionsProps {
  onActionClick: (actionId: string) => void;
  isLoading?: boolean;
}

/**
 * Quick Action Button Component 
 * Tactile, "Squircle" shape, interactive.
 */
const QuickActionButton: React.FC<{
  action: typeof QUICK_ACTIONS[0];
  onClick: () => void;
  description: string;
  isLocked: boolean;
  isDisabled?: boolean;
  index: number;
}> = ({ action, onClick, description, isLocked, isDisabled = false, index }) => {
  const getActionColor = (id: string): 'primary' | 'secondary' | 'accent' | 'neutral' => {
    if (id === 'mood') return 'secondary';
    if (id === 'chat') return 'primary';
    if (id === 'meditation') return 'accent';
    return 'neutral';
  };

  const colorKey = getActionColor(action.id);

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`group relative flex flex-col items-center justify-center p-4 sm:p-6 rounded-[2rem] transition-all border border-transparent 
        ${isDisabled
          ? 'opacity-60 cursor-not-allowed'
          : `hover:scale-[1.03] active:scale-95 hover:border-black/5 dark:hover:border-white/10 ${BG_COLORS[colorKey]} motion-safe:duration-300`
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
      aria-label={action.ariaLabel}
      aria-disabled={isDisabled}
    >
      {isLocked && (
        <span className="absolute top-3 right-3 sm:top-4 sm:right-4 text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          PRO
        </span>
      )}

      <div className={`mb-3 sm:mb-4 text-3xl sm:text-4xl transform transition-transform group-hover:scale-110 group-hover:rotate-3 motion-reduce:transform-none ${ICON_COLORS[colorKey]}`}>
        {action.icon}
      </div>

      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm sm:text-base">
        {action.title}
      </h3>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400 leading-tight">
        {description}
      </p>

      {/* Tactile shine effect */}
      <div className="absolute inset-0 rounded-[2rem] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity motion-reduce:transition-none duration-500 bg-gradient-to-tr from-white/20 to-transparent" />
    </button>
  );
};

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onActionClick,
  isLoading = false,
}) => {
  const { isPremium, getRemainingMoodLogs, getRemainingMessages, hasFeature } = useSubscription();
  const regionProps = getDashboardRegionProps('quickActions');

  const rawMoodLogsRemaining = getRemainingMoodLogs();
  const rawMessagesRemaining = getRemainingMessages();
  const isUnlimitedMoodLogs = rawMoodLogsRemaining === -1;
  const isUnlimitedMessages = rawMessagesRemaining === -1;
  const remainingMoodLogs = isUnlimitedMoodLogs ? 0 : Math.max(0, rawMoodLogsRemaining);
  const remainingMessages = isUnlimitedMessages ? 0 : Math.max(0, rawMessagesRemaining);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-40 rounded-[2rem] bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <section className="mb-12" {...regionProps}>
      <h2 className="world-class-heading-2 mb-6 text-center">
        Hur vill du ta hand om dig?
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {QUICK_ACTIONS.map((action, index) => {
          let description = action.defaultDescription;
          let isQuotaReached = false;

          if (action.id === 'mood') {
            const hasUnlimitedMood = isPremium || isUnlimitedMoodLogs;
            description = hasUnlimitedMood ? 'Obegränsat idag' : `${remainingMoodLogs} kvar idag`;
            isQuotaReached = !hasUnlimitedMood && remainingMoodLogs <= 0;
          } else if (action.id === 'chat') {
            const hasUnlimitedChat = isPremium || isUnlimitedMessages;
            description = hasUnlimitedChat ? 'Alltid redo' : `${remainingMessages} meddelanden`;
            isQuotaReached = !hasUnlimitedChat && remainingMessages <= 0;
          }

          if (isQuotaReached) {
            description = 'Vila eller uppgradera 🌙';
          }

          return (
            <QuickActionButton
              key={action.id}
              action={action}
              index={index}
              onClick={() => onActionClick(action.id)}
              description={description}
              isLocked={action.feature ? !hasFeature(action.feature) : false}
              isDisabled={isQuotaReached}
            />
          );
        })}
      </div>
    </section>
  );
};
