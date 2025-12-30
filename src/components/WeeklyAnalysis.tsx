import React, { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next";
import { getWeeklyAnalysis } from "../api/api";
import useAuth from "../hooks/useAuth";
import MoodAnalytics from "./MoodAnalytics";
import { debounce } from "lodash";
import { MicrophoneIcon } from "@heroicons/react/24/outline";

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis generation failed');
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

  // HONEST: Always show weekly analysis - MoodAnalytics provides the data, we provide AI insights (or fallback)
  // Only show "no data" if there's a critical error preventing any display


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            📊
          </span>
          {t('dashboard.weeklyMoodAnalysis')}
        </h3>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30">
          AI Powered
        </span>
      </div>

      {/* HONEST: MoodAnalytics provides real mood data, WeeklyAnalysis adds AI insights */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-2 shadow-sm border border-slate-100 dark:border-slate-700">
        <MoodAnalytics />
      </div>

      {/* AI Insights Section - Always show, with honest messaging about AI status */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white p-8 shadow-xl">
        {/* Abstract Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl -ml-10 -mb-10" />

        <div className="relative z-10">
          <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="text-indigo-300">🤖</span>
            AI-genererade insikter
          </h4>

          <div className="mb-6">
            {analysis?.fallback ? (
              <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-amber-400 text-xl">⚠️</span>
                  <div>
                    <p className="text-amber-200 font-medium mb-1">
                      Begränsad analys
                    </p>
                    <p className="text-amber-100/70 text-sm">
                      AI-tjänsten är tillfälligt begränsad. Visar grundläggande trender baserat på din data.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-indigo-300 text-xl">✨</span>
                  <div>
                    <p className="text-indigo-100 font-medium mb-1">
                      Personlig Analys
                    </p>
                    <p className="text-indigo-200/70 text-sm">
                      En djupdykning i dina mönster genererad av AI.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-lg text-indigo-50 leading-relaxed font-light">
              {analysis?.insights || 'Inga insikter tillgängliga för tillfället.'}
            </p>
          </div>

          {analysis?.confidence && !analysis?.fallback && (
            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <span className="text-indigo-300/80 text-sm font-medium uppercase tracking-wider">
                Analysens Träffsäkerhet
              </span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${analysis.confidence > 0.8 ? 'bg-emerald-400' : analysis.confidence > 0.6 ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                  style={{ width: `${analysis.confidence * 100}%` }}
                />
              </div>
              <span className="text-white font-bold">
                {Math.round(analysis.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {analysis.recent_memories && analysis.recent_memories.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-lg border border-slate-100 dark:border-slate-700">
          <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
            <span className="text-amber-500 text-xl">🕒</span>
            {t('dashboard.recentMemories')}
          </h4>
          <div className="space-y-4">
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
                <div key={mem.id} className="group flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                    <MicrophoneIcon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      {dateString}
                    </span>
                    <span className="block text-slate-700 dark:text-slate-300 font-medium">
                      Röstanteckning
                    </span>
                  </div>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                    ➡️
                  </div>
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
