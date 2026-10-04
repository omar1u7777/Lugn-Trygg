/**
 * UsageLimitBanner - Visar återstående användning för gratisanvändare
 * 
 * Visar en banner med hur många humörloggningar eller chattmeddelanden
 * som återstår för dagen. Blir varning när det är få kvar.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/outline';

// Typ för limit-type
export type LimitType = 'moodLogs' | 'chatMessages' | 'all';

interface UsageLimitBannerProps {
  /** Vilken gräns som ska visas. 'all' visar båda */
  limitType?: LimitType;
  /** Om bannern ska visas kompakt */
  compact?: boolean;
  /** Alternativ till compact (för bakåtkompatibilitet) */
  variant?: 'default' | 'compact';
}

/** Svenska namn för gränstyperna */
const LIMIT_NAMES: Record<Exclude<LimitType, 'all'>, string> = {
  moodLogs: 'humörloggningar',
  chatMessages: 'chattmeddelanden',
};

const isUnlimited = (value: number) => value === -1;
const formatValue = (value: number) => (isUnlimited(value) ? '∞' : value);

export const UsageLimitBanner: React.FC<UsageLimitBannerProps> = ({
  limitType = 'all',
  compact = false,
  variant,
}) => {
  const { plan, getRemainingMoodLogs, getRemainingMessages } = useSubscription();
  
  // Stöd för variant prop (bakåtkompatibilitet)
  const isCompact = compact || variant === 'compact';
  
  const moodLimit = plan.limits.moodLogsPerDay;
  const messageLimit = plan.limits.chatMessagesPerDay;
  const hasUnlimitedAccess = isUnlimited(moodLimit) && isUnlimited(messageLimit);

  // Visa inte för användare utan begränsningar
  if (hasUnlimitedAccess) {
    return null;
  }

  // Hämta värden
  const remainingMoods = getRemainingMoodLogs();
  const remainingMessages = getRemainingMessages();

  // Om 'all', visa båda typerna
  if (limitType === 'all') {
    const moodWarning = remainingMoods !== -1 && remainingMoods <= 1;
    const messageWarning = remainingMessages !== -1 && remainingMessages <= 3;
    const isWarning = moodWarning || messageWarning;
    const moodCritical = remainingMoods === 0 && !isUnlimited(moodLimit);
    const messageCritical = remainingMessages === 0 && !isUnlimited(messageLimit);
    const isCritical = moodCritical || messageCritical;

    if (isCompact) {
      return (
        <div className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
          isCritical 
            ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
            : isWarning
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
              : 'bg-gray-50 border border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
        }`}>
          <span>😊 {formatValue(remainingMoods)}/{formatValue(moodLimit)}</span>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <span>💬 {formatValue(remainingMessages)}/{formatValue(messageLimit)}</span>
          <Link 
            to="/upgrade" 
            className="ml-auto text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium text-xs"
          >
            Uppgradera – obegränsat
          </Link>
        </div>
      );
    }

    return (
      <div className={`rounded-lg p-4 ${
        isCritical 
          ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
          : isWarning
            ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            : 'bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                😊 Humör: {formatValue(remainingMoods)}/{formatValue(moodLimit)} kvar
              </p>
            </div>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                💬 Chatt: {formatValue(remainingMessages)}/{formatValue(messageLimit)} kvar
              </p>
            </div>
          </div>
          <Link
            to="/upgrade"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-linear-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-md transition-all"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Uppgradera – obegränsat</span>
          </Link>
        </div>
      </div>
    );
  }

  // Enskild limit-typ
  const remaining = limitType === 'moodLogs' 
    ? remainingMoods 
    : remainingMessages;
  
  const limit = limitType === 'moodLogs'
    ? moodLimit
    : messageLimit;
  
  const limitName = LIMIT_NAMES[limitType];
  const limitIsUnlimited = isUnlimited(limit);
  
  // Bestäm färg baserat på hur många som är kvar
  const isWarning = !limitIsUnlimited && remaining <= Math.ceil(limit * 0.3); // 30% eller mindre
  const isCritical = !limitIsUnlimited && remaining === 0;

  if (isCompact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        isCritical 
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : isWarning
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      }`}>
        {isCritical ? (
          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
        ) : null}
        <span>{formatValue(remaining)}/{formatValue(limit)} kvar</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 ${
      isCritical 
        ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
        : isWarning
          ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
          : 'bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(isCritical || isWarning) && (
            <ExclamationTriangleIcon className={`w-5 h-5 ${
              isCritical ? 'text-red-500' : 'text-yellow-500'
            }`} />
          )}
          <div>
            <p className={`text-sm font-medium ${
              isCritical 
                ? 'text-red-700 dark:text-red-400'
                : isWarning
                  ? 'text-yellow-700 dark:text-yellow-400'
                  : 'text-gray-700 dark:text-gray-300'
            }`}>
              {isCritical 
                ? `Du har använt alla dina ${limitName} idag`
                : `${formatValue(remaining)} ${limitName} kvar idag`
              }
            </p>
            {!isCritical && !limitIsUnlimited && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Gratis plan: {formatValue(limit)} {limitName} per dag
              </p>
            )}
          </div>
        </div>

        <Link
          to="/upgrade"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isCritical || isWarning
              ? 'bg-linear-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-md'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200'
          }`}
        >
          <SparklesIcon className="w-4 h-4" />
          <span>Uppgradera – obegränsat</span>
        </Link>
      </div>
    </div>
  );
};

/**
 * UsageLimitIndicator - Minimal indikator för användning
 * 
 * Används i komponenter där vi vill visa användning utan stor banner.
 */
export const UsageLimitIndicator: React.FC<{ limitType: LimitType }> = ({ limitType }) => {
  const { plan, getRemainingMoodLogs, getRemainingMessages } = useSubscription();
  
  if (plan.limits.moodLogsPerDay === -1 && plan.limits.chatMessagesPerDay === -1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
        <SparklesIcon className="w-3 h-3" />
        Obegränsat
      </span>
    );
  }

  const remaining = limitType === 'moodLogs' 
    ? getRemainingMoodLogs() 
    : getRemainingMessages();
    
  const limit = limitType === 'moodLogs'
    ? plan.limits.moodLogsPerDay
    : plan.limits.chatMessagesPerDay;

  return (
    <span className={`text-xs ${
      remaining === 0 
        ? 'text-red-500 font-medium' 
        : remaining <= 1 
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-gray-500 dark:text-gray-400'
    }`}>
      {remaining === -1 ? '∞' : remaining}/{limit === -1 ? '∞' : limit} kvar
    </span>
  );
};

export default UsageLimitBanner;
