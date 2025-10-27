import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getWeeklyAnalysis } from "../api/api";
import useAuth from "../hooks/useAuth";
import MoodAnalytics from "./MoodAnalytics";
import { debounce } from "lodash";

interface WeeklyAnalysisProps {
  refreshTrigger?: number;
}

const WeeklyAnalysis: React.FC<WeeklyAnalysisProps> = ({ refreshTrigger = 0 }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const data = await getWeeklyAnalysis(user.user_id);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const debouncedFetchAnalysis = useCallback(debounce(fetchAnalysis, 500), [fetchAnalysis]);

  useEffect(() => {
    debouncedFetchAnalysis();
    return () => {
      debouncedFetchAnalysis.cancel();
    };
  }, [debouncedFetchAnalysis, refreshTrigger]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">{t('dashboard.loadingAnalysis')}</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <div className="flex items-center gap-3">
        <span className="text-red-500 text-xl">⚠️</span>
        <div>
          <h3 className="text-red-800 dark:text-red-300 font-semibold">Fel vid laddning</h3>
          <p className="text-red-700 dark:text-red-400 text-sm mt-1">
            {t('dashboard.analysisError', { error })}
          </p>
        </div>
      </div>
    </div>
  );

  if (!analysis) return (
    <div className="text-center py-12">
      <span className="text-4xl mb-4 block">📊</span>
      <p className="text-slate-600 dark:text-slate-400">{t('dashboard.noDataAvailable')}</p>
    </div>
  );

  const getMoodColor = (mood: string) => {
    const colors: { [key: string]: string } = {
      glad: '#4caf50',
      lycklig: '#8bc34a',
      nöjd: '#cddc39',
      tacksam: '#ffeb3b',
      positiv: '#ffc107',
      ledsen: '#ff9800',
      arg: '#f44336',
      stressad: '#e91e63',
      deppig: '#9c27b0',
      frustrerad: '#673ab7',
      irriterad: '#3f51b5',
      orolig: '#2196f3'
    };
    return colors[mood] || '#9e9e9e';
  };

  const maxCount = analysis.mood_counts && Object.keys(analysis.mood_counts).length > 0
    ? Math.max(...(Object.values(analysis.mood_counts) as number[]))
    : 1;

  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
        <span className="text-primary-500 text-lg">📈</span>
        {t('dashboard.weeklyMoodAnalysis')}
      </h3>

      {/* AI-Powered Mood Analytics */}
      <div className="mb-8">
        <MoodAnalytics />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-4">
            <div className="text-3xl">📊</div>
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{analysis.total_moods || 0}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">{t('dashboard.moodLogs')}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-4">
            <div className="text-3xl">📈</div>
            <div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {analysis.average_score ? analysis.average_score.toFixed(1) : '0.0'}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">{t('dashboard.average')}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🎵</div>
            <div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{analysis.memories_count || 0}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300">{t('dashboard.memories')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-soft border border-slate-200 dark:border-slate-700 mb-6">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="text-primary-500">📊</span>
          {t('dashboard.moodDistribution')}
        </h4>
        <div className="space-y-3">
          {analysis.mood_counts && Object.entries(analysis.mood_counts).map(([mood, count]) => (
            <div key={mood} className="flex items-center gap-3">
              <div className="w-20 text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                {mood}
              </div>
              <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(count as number / maxCount) * 100}%`,
                    backgroundColor: getMoodColor(mood)
                  }}
                ></div>
              </div>
              <div className="w-8 text-sm font-semibold text-slate-900 dark:text-slate-100 text-right">
                {count as number}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-6 border border-primary-200 dark:border-primary-800 mb-6">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="text-primary-500">🤖</span>
          {t('dashboard.aiGeneratedInsights')}
        </h4>

        <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-4 mb-4 border border-primary-200 dark:border-primary-700">
          <div className="flex items-start gap-3">
            <div className="text-primary-500 text-xl mt-1">
              <i className="fas fa-brain"></i>
            </div>
            <div className="flex-1">
              <p className="text-slate-700 dark:text-slate-300 text-sm">
                {t('dashboard.aiAnalysisNotice')}
              </p>
            </div>
          </div>
        </div>

        <p className="text-slate-800 dark:text-slate-200 leading-relaxed mb-4">
          {analysis.insights || t('dashboard.noInsightsAvailable')}
        </p>

        {analysis.ai_confidence && (
          <div className="pt-4 border-t border-primary-200 dark:border-primary-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {t('dashboard.aiConfidence')}
              </span>
              <span className={`font-bold text-lg ${
                analysis.ai_confidence > 0.8
                  ? 'text-green-600 dark:text-green-400'
                  : analysis.ai_confidence > 0.6
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {Math.round(analysis.ai_confidence * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {analysis.recent_memories && analysis.recent_memories.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-soft border border-slate-200 dark:border-slate-700">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span className="text-primary-500">🕒</span>
            {t('dashboard.recentMemories')}
          </h4>
          <div className="space-y-3">
            {analysis.recent_memories.slice(0, 3).map((mem: any) => {
              let dateString = t('dashboard.invalidDate');
              try {
                const timestamp = mem.timestamp;
                const memoryDate = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
                if (!isNaN(memoryDate.getTime())) {
                  dateString = memoryDate.toLocaleDateString();
                }
              } catch {
                // Keep default invalid date
              }
              return (
                <div key={mem.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="text-primary-500 text-lg">
                    <i className="fas fa-microphone"></i>
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {dateString}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyAnalysis;