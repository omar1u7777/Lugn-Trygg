import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  PlayIcon,
  BookmarkIcon,
  ShareIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import type { Recommendation } from '../../types/recommendation';
import type { RecommendationFeedback } from '../../constants/recommendationsConstants';

interface RecommendationCardProps {
  recommendation: Recommendation;
  language: string;
  feedbackByRecommendation: Record<string, RecommendationFeedback>;
  getCategoryColor: (categoryKey: string | undefined) => string;
  getDifficultyColor: (difficulty: string) => string;
  getTypeIcon: (type: string) => string;
  getRecommendationMatchReason: (rec: Recommendation) => string | null;
  onAction: (rec: Recommendation, action: 'start' | 'save' | 'share') => void;
  onFeedback: (rec: Recommendation, feedback: RecommendationFeedback) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  language,
  feedbackByRecommendation,
  getCategoryColor,
  getDifficultyColor,
  getTypeIcon,
  getRecommendationMatchReason,
  onAction,
  onFeedback,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`relative rounded-lg border p-4 sm:p-6 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-700 transition-all duration-300 group overflow-hidden ${getCategoryColor(recommendation.categoryKey)}`}
    >
      {/* Recommended for badge */}
      {recommendation.primaryGoal && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-xs px-3 py-1.5 text-center font-medium">
          ✨ {t('recommendations.recommendedFor', 'Rekommenderas för')} {recommendation.primaryGoal}
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between mb-4 ${recommendation.primaryGoal ? 'mt-6' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="text-2xl sm:text-3xl">
            {recommendation.image || getTypeIcon(recommendation.type)}
          </div>
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 mb-1">
              {recommendation.category}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {recommendation.type}
            </p>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => onAction(recommendation, 'save')}
            className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center ${recommendation.saved
              ? 'text-yellow-600 dark:text-yellow-500'
              : 'text-gray-400 dark:text-gray-500'
              }`}
            aria-label="Save recommendation"
          >
            {recommendation.saved ? (
              <BookmarkIconSolid className="w-5 h-5" aria-hidden="true" />
            ) : (
              <BookmarkIcon className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={() => onAction(recommendation, 'share')}
            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Share recommendation"
          >
            <ShareIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        {/* Progress bar for completion rate */}
        {(recommendation.completionRate !== undefined && recommendation.completionRate > 0 && recommendation.completionRate < 100) && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                ⏳ {t('recommendations.inProgress', 'Påbörjad')} - {recommendation.completionRate}% {t('recommendations.complete', 'klart')}
              </span>
              <span className="text-gray-400">
                {recommendation.lastAccessedAt && `${t('recommendations.lastAccessed', 'Senast')}: ${new Date(recommendation.lastAccessedAt).toLocaleDateString(language)}`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
                style={{ width: `${recommendation.completionRate}%` }}
              />
            </div>
            <button
              onClick={() => onAction(recommendation, 'start')}
              className="mt-2 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline font-medium"
            >
              {t('recommendations.cta.continueWhereLeft', 'Fortsätt där du slutade →')}
            </button>
          </div>
        )}

        {/* Completion status badge */}
        {recommendation.completed && (
          <div className="flex items-center gap-1.5 mb-2 text-emerald-600 dark:text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium">{t('recommendations.completedToday', 'Klar idag ✓')}</span>
            {recommendation.streak && recommendation.streak > 1 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                🔥 {t('recommendations.streakDays', '{{count}} dagar i rad', { count: recommendation.streak })}
              </span>
            )}
          </div>
        )}

        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {recommendation.title}
        </h3>
        {getRecommendationMatchReason(recommendation) && (
          <p className="inline-flex items-center mb-2 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {getRecommendationMatchReason(recommendation)}
          </p>
        )}
        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
          {recommendation.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {recommendation.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs sm:text-sm mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(recommendation.difficulty) === 'success'
                ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                : getDifficultyColor(recommendation.difficulty) === 'warning'
                  ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                  : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300'
                } `}
            >
              {recommendation.difficulty}
            </span>
            {recommendation.duration && (
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {recommendation.duration} min
              </span>
            )}
          </div>

          {recommendation.rating && (
            <div className="flex items-center gap-1">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={`w-3 h-3 sm:w-4 sm:h-4 ${star <= (recommendation.rating || 0)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300 dark:text-gray-600'
                      } `}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                ({recommendation.rating})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="relative">
        <button
          onClick={() => onAction(recommendation, 'start')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all duration-200 group-hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
        >
          <PlayIcon className="w-5 h-5" aria-hidden="true" />
          <span>
            {recommendation.completionRate && recommendation.completionRate > 0 && recommendation.completionRate < 100
              ? t('recommendations.cta.continueExercise', 'Fortsätt övningen →')
              : recommendation.type === 'meditation'
                ? t('recommendations.cta.doNow', 'Gör övningen nu ({{duration}} min) →', { duration: recommendation.duration || 5 })
                : recommendation.type === 'exercise'
                  ? t('recommendations.cta.startTraining', 'Starta träningen nu →')
                  : recommendation.type === 'article'
                    ? t('recommendations.cta.readArticle', 'Läs artikeln (3 min) →')
                    : recommendation.type === 'challenge'
                      ? t('recommendations.cta.startChallenge', 'Påbörja utmaningen →')
                      : t('recommendations.cta.exploreNow', 'Utforska nu →')}
          </span>
        </button>

        {/* Quick start button (appears on hover) */}
        {recommendation.type === 'meditation' && (
          <button
            onClick={() => onAction(recommendation, 'start')}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full p-2 hover:scale-110 z-10"
            title={t('recommendations.cta.quickStart', 'Starta direkt')}
            aria-label={t('recommendations.cta.quickStartAria', 'Starta övning direkt')}
          >
            <span className="text-lg">▶️</span>
          </button>
        )}
      </div>

      {/* Social proof - people doing this now */}
      {recommendation.peopleDoingThisNow && recommendation.peopleDoingThisNow > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2 flex items-center justify-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          🔥 {t('recommendations.peopleDoingNow', '{{count}} personer gör detta just nu', { count: recommendation.peopleDoingThisNow })}
        </p>
      )}

      {/* Social proof - users who completed today */}
      {recommendation.dailyCompletions && recommendation.dailyCompletions > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          {recommendation.dailyCompletions.toLocaleString(language)} {t('recommendations.peopleDoingToday', 'personer har gjort detta idag')}
        </p>
      )}

      {/* Bottom progress bar (visual only) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
          style={{ width: `${recommendation.completionRate || (recommendation.completed ? 100 : 0)}%` }}
        />
      </div>

      {/* Feedback */}
      <div className="flex justify-center gap-2 mt-3">
        {(() => {
          const selectedFeedback = feedbackByRecommendation[recommendation.id];
          return (
            <>
              <button
                onClick={() => onFeedback(recommendation, 'helpful')}
                aria-pressed={selectedFeedback === 'helpful'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2 ${selectedFeedback === 'helpful'
                  ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                  : 'text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20'
                  }`}
              >
                <HandThumbUpIcon className="w-4 h-4" aria-hidden="true" />
                <span>{selectedFeedback === 'helpful' ? t('recommendations.feedback.thanks', 'Tack för svar') : t('recommendations.feedback.helpful', 'Hjälpsam')}</span>
              </button>
              <button
                onClick={() => onFeedback(recommendation, 'not_relevant')}
                aria-pressed={selectedFeedback === 'not_relevant'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 ${selectedFeedback === 'not_relevant'
                  ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300'
                  : 'text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20'
                  }`}
              >
                <HandThumbDownIcon className="w-4 h-4" aria-hidden="true" />
                <span>{selectedFeedback === 'not_relevant' ? t('recommendations.feedback.marked', 'Markerad') : t('recommendations.feedback.notRelevant', 'Inte relevant')}</span>
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
};
