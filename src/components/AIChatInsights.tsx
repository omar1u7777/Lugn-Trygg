import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChartBarIcon,
  SparklesIcon,
  HeartIcon,
  LightBulbIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BookOpenIcon,
  FlagIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import api from '@/api/api';
import useAuth from '@/hooks/useAuth';
import { logger } from '@/utils/logger';

interface FrameworkAnalysis {
  framework: string;
  confidence: number;
  techniques: Array<{ technique: string; count: number }>;
}

interface QualityMetrics {
  empathy_score: number;
  specificity_score: number;
  collaboration_score: number;
  structure_score: number;
  overall_quality: number;
  safety_assessment: number;
  goal_alignment: number;
}

interface ProgressData {
  status?: string;
  progress_report?: {
    summary: {
      total_sessions: number;
      overall_improvement: string;
      reliable_change: boolean;
    };
    wellbeing: {
      baseline: number;
      current: number;
      change: number;
      trend: string;
    };
    concerns: string[];
    strengths: string[];
  };
  trajectory?: {
    slope_wellbeing: number;
    clinically_significant_change: boolean;
    plateau_detected: boolean;
    deterioration_detected: boolean;
    dropout_risk: number;
  };
  recommendations?: string[];
  sessions_available?: number;
  sessions_needed?: number;
}

export const AIChatInsights: React.FC = () => {
  const { t: _t } = useTranslation();
  const { user: _user } = useAuth();
  const [framework, setFramework] = useState<FrameworkAnalysis | null>(null);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'framework' | 'quality' | 'progress'>('framework');

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      // Fetch all three types of analysis in parallel
      const [frameworkRes, qualityRes, progressRes] = await Promise.allSettled([
        api.get('/chatbot/analysis/framework'),
        api.get('/chatbot/analysis/quality'),
        api.get('/chatbot/analysis/progress')
      ]);

      if (frameworkRes.status === 'fulfilled' && frameworkRes.value.data?.success) {
        setFramework(frameworkRes.value.data.data);
      }

      if (qualityRes.status === 'fulfilled' && qualityRes.value.data?.success) {
        setMetrics(qualityRes.value.data.data.metrics);
      }

      if (progressRes.status === 'fulfilled' && progressRes.value.data?.success) {
        setProgress(progressRes.value.data.data);
      }
    } catch (e) {
      logger.error('Failed to fetch insights', e as Error);
    } finally {
      setLoading(false);
    }
  };

  const getFrameworkLabel = (fw: string): string => {
    const labels: Record<string, string> = {
      'cognitive_behavioral_therapy': 'KBT (Kognitiv Beteendeterapi)',
      'acceptance_commitment_therapy': 'ACT (Acceptans & Commitment)',
      'dialectical_behavior_therapy': 'DBT (Dialectisk Beteendeterapi)',
      'solution_focused_therapy': 'Lösningfokuserad terapi',
      'person_centered': 'Personcentrerad terapi',
      'unknown': 'Ospecificerad approach'
    };
    return labels[fw] || fw;
  };

  const getFrameworkColor = (fw: string): string => {
    const colors: Record<string, string> = {
      'cognitive_behavioral_therapy': 'bg-blue-100 text-blue-800',
      'acceptance_commitment_therapy': 'bg-green-100 text-green-800',
      'dialectical_behavior_therapy': 'bg-purple-100 text-purple-800',
      'solution_focused_therapy': 'bg-yellow-100 text-yellow-800',
      'person_centered': 'bg-pink-100 text-pink-800',
      'unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[fw] || colors.unknown;
  };

  const getTrendIcon = (trend: string): React.ReactNode => {
    switch (trend) {
      case 'improving':
        return <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />;
      case 'declining':
        return <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />;
      default:
        return <MinusIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
          <SparklesIcon className="w-6 h-6 text-indigo-600" />
          AI-samtalsinsikter
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Evidensbaserad analys av dina terapeutiska samtal
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('framework')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'framework'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <BookOpenIcon className="w-4 h-4" />
          Terapeutiskt ramverk
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'quality'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <ChartBarIcon className="w-4 h-4" />
          Kvalitetsmått
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'progress'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <ArrowTrendingUpIcon className="w-4 h-4" />
          Framsteg
        </button>
      </div>

      {/* Framework Tab */}
      {activeTab === 'framework' && framework && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Upptäckt terapeutiskt ramverk
            </h3>
            
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${getFrameworkColor(framework.framework)}`}>
              <LightBulbIcon className="w-5 h-5" />
              <span className="font-medium">{getFrameworkLabel(framework.framework)}</span>
              <span className="text-sm opacity-75">({Math.round(framework.confidence * 100)}% säkerhet)</span>
            </div>

            {framework.techniques.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Använda tekniker:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {framework.techniques.map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                    >
                      {tech.technique.replace(/_/g, ' ')} ({tech.count}x)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <LightBulbIcon className="w-4 h-4 inline mr-1" />
              Dina samtal följer principer från {getFrameworkLabel(framework.framework).split(' ')[0]}, 
              en evidensbaserad terapeutisk approach som har visat god effekt i forskning.
            </p>
          </div>
        </div>
      )}

      {/* Quality Tab */}
      {activeTab === 'quality' && metrics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <QualityCard
              title="Empati"
              score={metrics.empathy_score}
              icon={<HeartIcon className="w-5 h-5" />}
              description="Förståelse och validering"
            />
            <QualityCard
              title="Specificitet"
              score={metrics.specificity_score}
              icon={<FlagIcon className="w-5 h-5" />}
              description="Konkreta, handlingsbara råd"
            />
            <QualityCard
              title="Samarbete"
              score={metrics.collaboration_score}
              icon={<UsersIcon className="w-5 h-5" />}
              description="Gemensamt utforskande"
            />
            <QualityCard
              title="Struktur"
              score={metrics.structure_score}
              icon={<BookOpenIcon className="w-5 h-5" />}
              description="Tydlig agenda och uppföljning"
            />
            <QualityCard
              title="Säkerhet"
              score={metrics.safety_assessment}
              icon={<CheckCircleIcon className="w-5 h-5" />}
              description="Riskbedömning och säkerhet"
            />
            <QualityCard
              title="Mål-uppfyllelse"
              score={metrics.goal_alignment}
              icon={<FlagIcon className="w-5 h-5" />}
              description="Koppling till dina mål"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Övergripande kvalitet
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${metrics.overall_quality * 100}%` }}
                />
              </div>
              <span className="font-bold text-2xl text-indigo-600">
                {Math.round(metrics.overall_quality * 100)}%
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {metrics.overall_quality > 0.7 
                ? "Utmärkt samtalskvalitet med stark terapeutisk allians"
                : metrics.overall_quality > 0.5
                ? "God kvalitet med utrymme för förbättring"
                : "Kvaliteten kan förbättras - överväg att justera approach"}
            </p>
          </div>
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && progress && (
        <div className="space-y-4">
          {progress.status === 'insufficient_data' ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 text-center">
              <p className="text-yellow-800 dark:text-yellow-300">
                Fortsätt samtala med AI-assistenten för att få personliga framstegsinsikter.
                
                ({progress.sessions_available} / {progress.sessions_needed} sessioner)
              </p>
            </div>
          ) : (
            <>
              {progress.progress_report && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Sammanfattning
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-500">Antal sessioner</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {progress.progress_report.summary.total_sessions}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-500">Förbättring</p>
                      <p className="text-lg font-bold capitalize">
                        {progress.progress_report.summary.overall_improvement === 'significant' 
                          ? 'Signifikant' 
                          : progress.progress_report.summary.overall_improvement}
                      </p>
                    </div>
                  </div>

                  {progress.progress_report.wellbeing && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Mående (1-10)</span>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(progress.progress_report.wellbeing.trend)}
                          <span className="text-sm font-medium">
                            {progress.progress_report.wellbeing.baseline.toFixed(1)} → {progress.progress_report.wellbeing.current.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${(progress.progress_report.wellbeing.current / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {progress.trajectory && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Trajectory-analys
                  </h3>
                  <div className="space-y-3">
                    {progress.trajectory.clinically_significant_change && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircleIcon className="w-5 h-5" />
                        <span>Kliniskt signifikant förbättring uppnådd</span>
                      </div>
                    )}
                    {progress.trajectory.plateau_detected && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <MinusIcon className="w-5 h-5" />
                        <span>Framstegsplateau upptäckt</span>
                      </div>
                    )}
                    {progress.trajectory.deterioration_detected && (
                      <div className="flex items-center gap-2 text-red-600">
                        <ArrowTrendingDownIcon className="w-5 h-5" />
                        <span>Försämringstrend - kontakta vårdgivare</span>
                      </div>
                    )}
                    {progress.trajectory.dropout_risk > 0.6 && (
                      <div className="flex items-center gap-2 text-orange-600">
                        <ExclamationTriangleIcon className="w-5 h-5" />
                        <span>Hög risk för avbrott ({Math.round(progress.trajectory.dropout_risk * 100)}%)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {progress.recommendations && progress.recommendations.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6">
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
                    Rekommendationer
                  </h3>
                  <ul className="space-y-2">
                    {progress.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-indigo-800 dark:text-indigo-400">
                        <LightBulbIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface QualityCardProps {
  title: string;
  score: number;
  icon: React.ReactNode;
  description: string;
}

const QualityCard: React.FC<QualityCardProps> = ({ title, score, icon, description }) => {
  const getColor = (s: number) => {
    if (s > 0.7) return 'bg-green-500';
    if (s > 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-gray-600 dark:text-gray-400">{icon}</div>
        <span className="font-medium text-gray-900 dark:text-white text-sm">{title}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor(score)} transition-all`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
        <span className="text-sm font-bold">{Math.round(score * 100)}%</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
};

export default AIChatInsights;
