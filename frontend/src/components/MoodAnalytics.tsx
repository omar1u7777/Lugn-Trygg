import React, { useState, useEffect } from 'react';
import { analyzeMoodPatterns } from '../api/api';
import useAuth from '../hooks/useAuth';

interface PatternAnalysis {
  pattern_analysis: string;
  predictions: string;
  confidence: number;
  trend_direction?: string;
  volatility?: number;
  trend_strength?: number;
}

interface AnalyticsData {
  pattern_analysis: PatternAnalysis;
  data_points_analyzed: number;
  analysis_timestamp: string;
}

const MoodAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    if (!user?.user_id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await analyzeMoodPatterns(user.user_id);
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Kunde inte ladda analys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const getTrendColor = (direction?: string) => {
    switch (direction) {
      case 'improving': return 'text-green-600 bg-green-100';
      case 'declining': return 'text-red-600 bg-red-100';
      case 'stable': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (direction?: string) => {
    switch (direction) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-red-600">
          <p className="mb-4">⚠️ {error}</p>
          <button
            onClick={loadAnalytics}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-gray-500">
          <p className="mb-4">Ingen data tillgänglig för analys</p>
          <p className="text-sm">Logga ditt humör några dagar för att se mönster och trender</p>
        </div>
      </div>
    );
  }

  const { pattern_analysis, data_points_analyzed } = analyticsData;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Humöranalys</h3>
        <button
          onClick={loadAnalytics}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Uppdatera
        </button>
      </div>

      {/* Trend Direction */}
      {pattern_analysis.trend_direction && (
        <div className="mb-6">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTrendColor(pattern_analysis.trend_direction)}`}>
            <span className="mr-2">{getTrendIcon(pattern_analysis.trend_direction)}</span>
            {pattern_analysis.trend_direction === 'improving' && 'Förbättring'}
            {pattern_analysis.trend_direction === 'declining' && 'Försämring'}
            {pattern_analysis.trend_direction === 'stable' && 'Stabil'}
          </div>
        </div>
      )}

      {/* Pattern Analysis */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-2">Mönster och insikter</h4>
        <p className="text-gray-700 text-sm leading-relaxed">
          {pattern_analysis.pattern_analysis}
        </p>
      </div>

      {/* Predictions */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-2">Framtida trender</h4>
        <p className="text-gray-700 text-sm leading-relaxed">
          {pattern_analysis.predictions}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {data_points_analyzed}
          </div>
          <div className="text-sm text-gray-600">
            Datapunkter analyserade
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className={`text-2xl font-bold ${getConfidenceColor(pattern_analysis.confidence)}`}>
            {Math.round(pattern_analysis.confidence * 100)}%
          </div>
          <div className="text-sm text-gray-600">
            Konfidensnivå
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      {(pattern_analysis.volatility !== undefined || pattern_analysis.trend_strength !== undefined) && (
        <div className="space-y-3">
          {pattern_analysis.volatility !== undefined && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Humörstabilitet</span>
                <span className="font-medium">
                  {pattern_analysis.volatility < 0.2 ? 'Hög' :
                   pattern_analysis.volatility < 0.5 ? 'Medium' : 'Låg'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.max(10, 100 - (pattern_analysis.volatility * 100))}%` }}
                ></div>
              </div>
            </div>
          )}

          {pattern_analysis.trend_strength !== undefined && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Trendstyrka</span>
                <span className="font-medium">
                  {pattern_analysis.trend_strength < 0.05 ? 'Svag' :
                   pattern_analysis.trend_strength < 0.1 ? 'Medium' : 'Stark'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min(100, pattern_analysis.trend_strength * 500)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Analys baserad på dina senaste {data_points_analyzed} humörloggar
        </p>
      </div>
    </div>
  );
};

export default MoodAnalytics;