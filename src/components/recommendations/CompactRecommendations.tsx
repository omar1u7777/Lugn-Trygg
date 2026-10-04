import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Recommendation } from '../../types/recommendation';
import type { MoodTrendData } from '../../utils/recommendationPersonalization';

interface CompactRecommendationsProps {
  loading: boolean;
  error: string | null;
  recommendations: Recommendation[];
  moodTrendData: MoodTrendData | null;
  getCompactCtaLabel: (type: Recommendation['type']) => string;
}

export const CompactRecommendations: React.FC<CompactRecommendationsProps> = ({
  loading,
  error,
  recommendations,
  moodTrendData,
  getCompactCtaLabel,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Loading State - Compact */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-40 rounded-4xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-40 rounded-4xl bg-gray-100 dark:bg-gray-800" />
        </div>
      )}

      {/* Error State - Compact */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-4xl p-6 text-center">
          <p className="text-red-700 dark:text-red-300">{t('recommendations.error.loadFailedCompact', 'Kunde inte ladda rekommendationer')}</p>
        </div>
      )}

      {/* Featured Recommendations - Compact */}
      {!loading && !error && (
        <>
          {moodTrendData && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="text-sm">✨</span>
              {moodTrendData.trend === 'declining'
                ? t('recommendations.personalized.lowMood', 'Anpassat efter ditt humör — fokus på lättnad idag')
                : moodTrendData.trend === 'improving'
                  ? t('recommendations.personalized.improving', 'Anpassat efter ditt humör — du mår bättre, dags för tillväxt')
                  : t('recommendations.personalized.stable', 'Anpassat efter ditt humör och dina mål')}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div
                key={rec.id}
                className={`group relative overflow-hidden rounded-xl p-3 transition-all duration-300 hover:scale-[1.02] border border-transparent ${
                  (rec.categoryKey || '').includes('Stress') || (rec.categoryKey || '').includes('Avslappning') || (rec.categoryKey || '').includes('Ångest')
                    ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/10'
                    : (rec.categoryKey || '').includes('Sömn')
                      ? 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/10'
                      : 'bg-white hover:bg-gray-50 dark:bg-slate-800/50'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 pointer-events-none">
                  {rec.image}
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                      {rec.category}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {rec.duration} min
                    </span>
                  </div>

                  <h3 className="text-sm font-serif font-bold text-gray-900 dark:text-gray-100 mb-1 leading-tight truncate">
                    {rec.title}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2">
                    {rec.description}
                  </p>

                  {/* Status indicator */}
                  {(rec.completionRate !== undefined && rec.completionRate > 0 && rec.completionRate < 100) && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="font-medium">{t('recommendations.compact.inProgress', '⏸️ Påbörjad - {{rate}}%', { rate: rec.completionRate })}</span>
                    </div>
                  )}
                  {rec.completed && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium">{t('recommendations.compact.completedToday', '✓ Klar idag')}</span>
                      {rec.streak && rec.streak > 1 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-1">{t('recommendations.compact.streakDays', '🔥 {{count}} dagar', { count: rec.streak })}</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => navigate('/recommendations', { state: { autoOpenRecId: rec.id } })}
                    className="flex items-center gap-2 font-medium text-primary-600 dark:text-primary-400 hover:underline group-hover:translate-x-1 transition-transform"
                    aria-label={t('recommendations.compact.ariaCta', '{{label}} i rekommendationer', { label: getCompactCtaLabel(rec.type) })}
                  >
                    {(rec.completionRate !== undefined && rec.completionRate > 0 && rec.completionRate < 100)
                      ? t('recommendations.compact.continueExercise', 'Fortsätt övningen →')
                      : rec.completed
                        ? t('recommendations.compact.doAgain', 'Gör igen →')
                        : rec.type === 'meditation'
                          ? t('recommendations.compact.doExercise', 'Gör övningen ({{duration}} min) →', { duration: rec.duration || 5 })
                          : rec.type === 'exercise'
                            ? t('recommendations.compact.startExercise', 'Starta övningen ({{duration}} min) →', { duration: rec.duration || 10 })
                            : rec.type === 'article'
                              ? t('recommendations.compact.readArticle', 'Läs artikeln ({{duration}} min) →', { duration: rec.duration || 3 })
                              : t('recommendations.compact.explore', 'Utforska →')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State - Compact */}
      {!loading && !error && recommendations.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-500 dark:text-gray-400">
            {t('recommendations.compact.empty', 'Inga rekommendationer just nu.')}
          </p>
        </div>
      )}
    </div>
  );
};
