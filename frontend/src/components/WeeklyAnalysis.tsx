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

  if (loading) return <p className="loading-message">{t('dashboard.loadingAnalysis')}</p>;
  if (error) return <div className="error-message">{t('dashboard.analysisError', { error })}</div>;
  if (!analysis) return <p className="info-message">📊 {t('dashboard.noDataAvailable')}</p>;

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
    <div className="weekly-analysis">
      <h3 className="analysis-title">
        <i className="fas fa-chart-line"></i> {t('dashboard.weeklyMoodAnalysis')}
      </h3>

      {/* AI-Powered Mood Analytics */}
      <div className="mb-8">
        <MoodAnalytics />
      </div>

      <div className="analysis-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-number">{analysis.total_moods || 0}</div>
            <div className="stat-label">{t('dashboard.moodLogs')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-number">{analysis.average_score ? analysis.average_score.toFixed(1) : '0.0'}</div>
            <div className="stat-label">{t('dashboard.average')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎵</div>
          <div className="stat-content">
            <div className="stat-number">{analysis.memories_count || 0}</div>
            <div className="stat-label">{t('dashboard.memories')}</div>
          </div>
        </div>
      </div>

      <div className="mood-distribution">
        <h4>{t('dashboard.moodDistribution')}</h4>
        <div className="mood-bars">
          {analysis.mood_counts && Object.entries(analysis.mood_counts).map(([mood, count]) => (
            <div key={mood} className="mood-bar">
              <div className="mood-label">{mood}</div>
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    width: `${(count as number / maxCount) * 100}%`,
                    backgroundColor: getMoodColor(mood)
                  }}
                ></div>
              </div>
              <div className="mood-count">{count as number}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="insights-card">
        <h4><i className="fas fa-robot"></i> {t('dashboard.aiGeneratedInsights')}</h4>
        <div className="ai-insight-notice">
          <div className="ai-insight-content">
            <div className="ai-insight-icon">
              <i className="fas fa-brain"></i>
            </div>
            <div className="ai-insight-text">
              <p>
                {t('dashboard.aiAnalysisNotice')}
              </p>
            </div>
          </div>
        </div>
        <p className="insights-text">{analysis.insights || t('dashboard.noInsightsAvailable')}</p>

        {analysis.ai_confidence && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t('dashboard.aiConfidence')}</span>
              <span className={`font-medium ${analysis.ai_confidence > 0.8 ? 'text-green-600' : analysis.ai_confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                {Math.round(analysis.ai_confidence * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {analysis.recent_memories && analysis.recent_memories.length > 0 && (
        <div className="recent-memories">
          <h4><i className="fas fa-clock"></i> {t('dashboard.recentMemories')}</h4>
          <div className="memories-list">
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
                <div key={mem.id} className="memory-item-small">
                  <i className="fas fa-microphone"></i>
                  <span>{dateString}</span>
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