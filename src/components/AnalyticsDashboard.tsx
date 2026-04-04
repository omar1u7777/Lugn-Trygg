import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';
import {
  getAdminStats,
  getPerformanceMetrics,
  getSystemHealth,
  type AdminStats,
  type PerformanceMetrics,
  type SystemHealth,
} from '../api/admin';
import { logger } from '../utils/logger';

interface StatCardProps {
  label: string;
  value: string;
  accentClass: string;
}

function StatCard({ label, value, accentClass }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accentClass}`}>{value}</p>
    </div>
  );
}

const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const [statsResult, perfResult, healthResult] = await Promise.allSettled([
      getAdminStats(),
      getPerformanceMetrics(),
      getSystemHealth(),
    ]);

    let hasSuccess = false;

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value);
      hasSuccess = true;
    } else {
      logger.error('Failed to load admin stats', statsResult.reason);
    }

    if (perfResult.status === 'fulfilled') {
      setPerformanceMetrics(perfResult.value);
      hasSuccess = true;
    } else {
      logger.error('Failed to load performance metrics', perfResult.reason);
    }

    if (healthResult.status === 'fulfilled') {
      setSystemHealth(healthResult.value);
      hasSuccess = true;
    } else {
      logger.error('Failed to load system health', healthResult.reason);
    }

    if (!hasSuccess) {
      setError('Kunde inte ladda admin analytics-data just nu. Försök igen.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const usersChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Totalt', value: stats.users.total },
      { name: 'Aktiva 7d', value: stats.users.active7d },
      { name: 'Nya 30d', value: stats.users.new30d },
      { name: 'Premium', value: stats.users.premium },
    ];
  }, [stats]);

  const contentChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Moods', value: stats.moods.total },
      { name: 'Journals', value: stats.content.journals },
      { name: 'Memories', value: stats.content.memories },
      { name: 'Chat', value: stats.content.chatSessions },
    ];
  }, [stats]);

  const endpointChartData = useMemo(() => {
    if (!performanceMetrics) return [];
    return Object.entries(performanceMetrics.endpoints)
      .map(([endpoint, metric]) => ({
        name: endpoint.length > 18 ? `${endpoint.slice(0, 18)}...` : endpoint,
        avg: Math.round(metric.avgDuration),
        p95: Math.round(metric.p95Duration),
        count: metric.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [performanceMetrics]);

  const healthPillClass = useMemo(() => {
    if (!systemHealth) {
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
    if (systemHealth.status === 'healthy') {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    }
    if (systemHealth.status === 'degraded') {
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }, [systemHealth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-10 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Tillbaka</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Admin Analytics Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Live-data för användning, innehåll, prestanda och systemhälsa.</p>
          </div>

          <button
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Uppdaterar...' : 'Uppdatera'}</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Totala användare" value={stats ? stats.users.total.toLocaleString('sv-SE') : '-'} accentClass="text-slate-900 dark:text-slate-100" />
          <StatCard label="Aktiva (7 dagar)" value={stats ? stats.users.active7d.toLocaleString('sv-SE') : '-'} accentClass="text-blue-600 dark:text-blue-400" />
          <StatCard label="Humörinlägg idag" value={stats ? stats.moods.today.toLocaleString('sv-SE') : '-'} accentClass="text-emerald-600 dark:text-emerald-400" />
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Systemstatus</p>
            <div className="mt-2 inline-flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${healthPillClass}`}>
                {systemHealth ? systemHealth.status : 'okänd'}
              </span>
              {systemHealth?.status === 'healthy' && <ShieldCheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Användaröversikt</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usersChartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Innehållsvolym</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contentChartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Topp-endpoints: svarstid (ms)</h3>
          {endpointChartData.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Ingen endpoint-data tillgänglig.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={endpointChartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Avg" />
                  <Line type="monotone" dataKey="p95" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
