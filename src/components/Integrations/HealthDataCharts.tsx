import React, { useEffect, useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface HealthDataChartsProps {
  userId: string;
  provider?: string;
}

interface ChartData {
  date: string;
  steps?: number;
  heartRate?: number;
  sleep?: number;
  calories?: number;
}

const HealthDataCharts: React.FC<HealthDataChartsProps> = ({ userId, provider }) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'steps' | 'heart' | 'sleep' | 'calories'>('all');

  useEffect(() => {
    loadHealthData();
  }, [userId, provider]);

  const loadHealthData = async () => {
    try {
      setLoading(true);

      // Mock data - replace with actual Firebase query
      const mockData: ChartData[] = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        mockData.push({
          date: date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
          steps: Math.floor(Math.random() * 5000) + 5000,
          heartRate: Math.floor(Math.random() * 20) + 65,
          sleep: Math.random() * 3 + 6,
          calories: Math.floor(Math.random() * 800) + 1600,
        });
      }

      setData(mockData);
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedMetric('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedMetric === 'all'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          📊 Alla mätvärden
        </button>
        <button
          onClick={() => setSelectedMetric('steps')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedMetric === 'steps'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          👣 Steg
        </button>
        <button
          onClick={() => setSelectedMetric('heart')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedMetric === 'heart'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          ❤️ Puls
        </button>
        <button
          onClick={() => setSelectedMetric('sleep')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedMetric === 'sleep'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          😴 Sömn
        </button>
        <button
          onClick={() => setSelectedMetric('calories')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedMetric === 'calories'
              ? 'bg-orange-600 text-white shadow-lg'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          🔥 Kalorier
        </button>
      </div>

      {/* Steps Chart */}
      {(selectedMetric === 'all' || selectedMetric === 'steps') && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>👣</span>
            Steg per dag
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Bar
                dataKey="steps"
                name="Steg"
                fill="colors.mood.anxious"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heart Rate Chart */}
      {(selectedMetric === 'all' || selectedMetric === 'heart') && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>❤️</span>
            Genomsnittlig vilopuls
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                domain={[50, 90]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="heartRate"
                name="Puls (bpm)"
                stroke="colors.mood.depressed"
                strokeWidth={3}
                dot={{ fill: 'colors.mood.depressed', r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sleep Chart */}
      {(selectedMetric === 'all' || selectedMetric === 'sleep') && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>😴</span>
            Sömn per natt
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                domain={[0, 10]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="sleep"
                name="Sömn (timmar)"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#sleepGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calories Chart */}
      {(selectedMetric === 'all' || selectedMetric === 'calories') && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🔥</span>
            Förbrända kalorier
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="caloriesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="calories"
                name="Kalorier"
                stroke="#f97316"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#caloriesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default HealthDataCharts;
