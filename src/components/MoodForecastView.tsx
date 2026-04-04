import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts';
import {
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  MinusIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import useAuth from '../hooks/useAuth';
import api from '../api/api';
import { logger } from '../utils/logger';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface ForecastData {
  date: string;
  predicted_valence: number;
  confidence_lower: number;
  confidence_upper: number;
  uncertainty: number;
  risk_flags: string[];
}

interface TemporalPattern {
  type: string;
  strength: number;
  description: string;
  clinical_significance?: string;
}

interface RawForecastItem {
  date: string;
  predicted_valence: number;
  confidence_interval: { lower: number; upper: number };
  uncertainty: number;
  risk_flags?: string[];
}

export const MoodForecastView: React.FC = () => {
  const { t: _t } = useTranslation();
  const { user: _user } = useAuth();
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [patterns, setPatterns] = useState<TemporalPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForecast();
  }, [days]);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/advanced-mood/forecast?days=${days}&include_patterns=true`);
      
      if (response.data?.success) {
        const data = response.data.data;
        
        // Transform forecast data
        const transformed = data.forecasts.map((f: RawForecastItem) => ({
          date: format(new Date(f.date), 'EEE d/M', { locale: sv }),
          fullDate: f.date,
          predicted_valence: f.predicted_valence,
          confidence_lower: f.confidence_interval.lower,
          confidence_upper: f.confidence_interval.upper,
          uncertainty: f.uncertainty,
          risk_flags: f.risk_flags,
          // Emoji based on valence
          emoji: f.predicted_valence > 0.3 ? '😊' : f.predicted_valence < -0.3 ? '😔' : '😐'
        }));
        
        setForecast(transformed);
        setPatterns(data.temporal_patterns || []);
      } else {
        setError('Kunde inte hämta prognos');
      }
    } catch (e: unknown) {
      logger.error('Forecast fetch failed', e);
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Prognos ej tillgänglig');
    } finally {
      setLoading(false);
    }
  };

  const getValenceColor = (valence: number) => {
    if (valence > 0.3) return '#10b981'; // emerald-500
    if (valence < -0.3) return '#f43f5e'; // rose-500
    return '#6b7280'; // gray-500
  };

  const getRiskLevel = (flags: string[]) => {
    if (flags.includes('predicted_depressive_episode')) return 'high';
    if (flags.includes('high_depression_risk') || flags.includes('high_anxiety_risk')) return 'moderate';
    if (flags.length > 0) return 'low';
    return 'none';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-800">{error}</p>
        <p className="text-sm text-yellow-600 mt-1">
          Fortsätt logga ditt humör för att aktivera AI-prognoser
        </p>
      </div>
    );
  }

  const avgValence = forecast.reduce((sum, f) => sum + f.predicted_valence, 0) / forecast.length;
  const trend = forecast[forecast.length - 1]?.predicted_valence - forecast[0]?.predicted_valence;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-indigo-600" />
            AI-prognos för ditt humör
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Baserad på Temporal Attention LSTM och din historik
          </p>
        </div>
        
        {/* Days selector */}
        <div className="flex gap-2">
          {[7, 14].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d} dagar
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Genomsnittligt humör</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl">
              {avgValence > 0.3 ? '😊' : avgValence < -0.3 ? '😔' : '😐'}
            </span>
            <span className="text-lg font-semibold" style={{ color: getValenceColor(avgValence) }}>
              {avgValence > 0 ? '+' : ''}{avgValence.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Trend</p>
          <div className="flex items-center gap-2 mt-1">
            {trend > 0.05 ? (
              <>
                <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-500" />
                <span className="text-lg font-semibold text-emerald-600">Uppåt</span>
              </>
            ) : trend < -0.05 ? (
              <>
                <ArrowTrendingDownIcon className="w-5 h-5 text-rose-500" />
                <span className="text-lg font-semibold text-rose-600">Nedåt</span>
              </>
            ) : (
              <>
                <MinusIcon className="w-5 h-5 text-gray-500" />
                <span className="text-lg font-semibold text-gray-600">Stabilt</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Prognossäkerhet</p>
          <div className="mt-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${Math.max(0, 100 - (forecast[0]?.uncertainty || 0) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(Math.max(0, 100 - (forecast[0]?.uncertainty || 0) * 100))}% säkerhet
            </p>
          </div>
        </div>
      </div>

      {/* Risk Alert */}
      {forecast.some(f => getRiskLevel(f.risk_flags) === 'high') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-rose-600 mt-0.5" />
            <div>
              <p className="font-medium text-rose-900">⚠️ Prognos indikerar svårigheter</p>
              <p className="text-sm text-rose-700 mt-1">
                AI-modellen förutser en potentiell depressiv episod. Överväg att kontakta vårdgivare.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Forecast Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Prognos kommande {days} dagar
        </h3>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast}>
              <defs>
                <linearGradient id="colorValence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                domain={[-1, 1]} 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={(v) => v.toFixed(1)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200">
                        <p className="font-medium text-gray-900 dark:text-white">{data.date}</p>
                        <p className="text-2xl mt-1">{data.emoji}</p>
                        <p className="text-sm text-gray-600">
                          Valens: {data.predicted_valence.toFixed(2)}
                        </p>
                        {data.risk_flags.length > 0 && (
                          <p className="text-xs text-rose-600 mt-1">
                            ⚠️ {data.risk_flags.join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="confidence_upper"
                stroke="transparent"
                fill="#6366f1"
                fillOpacity={0.1}
              />
              <Area
                type="monotone"
                dataKey="confidence_lower"
                stroke="transparent"
                fill="#fff"
                fillOpacity={1}
              />
              <Line
                type="monotone"
                dataKey="predicted_valence"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#4f46e5' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-indigo-600"></div>
            <span>Förutspådd valens</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-100 rounded"></div>
            <span>Konfidensintervall (95%)</span>
          </div>
        </div>
      </div>

      {/* Temporal Patterns */}
      {patterns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5 text-indigo-600" />
            Upptäckta mönster
          </h3>
          <div className="space-y-3">
            {patterns.map((pattern, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {pattern.type}
                    </span>
                    <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${pattern.strength * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(pattern.strength * 100)}% styrka
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {pattern.description}
                  </p>
                  {pattern.clinical_significance && (
                    <p className="text-xs text-indigo-600 mt-1">
                      💡 {pattern.clinical_significance}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Forecast Cards */}
      <div className="grid grid-cols-7 gap-2">
        {forecast.slice(0, 7).map((day, idx) => (
          <motion.div
            key={day.fullDate}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className={`p-3 rounded-lg text-center ${
              getRiskLevel(day.risk_flags) === 'high'
                ? 'bg-rose-50 border-rose-200'
                : getRiskLevel(day.risk_flags) === 'moderate'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-white dark:bg-gray-800'
            } border shadow-sm`}
          >
            <p className="text-xs text-gray-500">{day.date}</p>
            <p className="text-2xl my-1">{day.emoji}</p>
            <p className={`text-xs font-medium ${
              day.predicted_valence > 0 ? 'text-emerald-600' : 
              day.predicted_valence < 0 ? 'text-rose-600' : 'text-gray-600'
            }`}>
              {day.predicted_valence > 0 ? '+' : ''}{day.predicted_valence.toFixed(1)}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default MoodForecastView;
