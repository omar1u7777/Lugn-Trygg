import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowPathIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

// Constants for performance thresholds
const PERFORMANCE_THRESHOLDS = {
  GOOD: 0.3, // seconds
  WARNING: 1.0, // seconds
} as const;

// Maximum duration for progress bar normalization (in seconds)
const MAX_BAR_DURATION = 5;

// Interface for endpoint statistics
interface EndpointStats {
  count: number;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  p95_duration: number;
}

// Interface for performance metrics
interface PerformanceMetrics {
  endpoints: Record<string, EndpointStats>;
  total_requests: number;
  error_counts: Record<string, number>;
  slow_requests_count: number;
}

// Sub-component for summary cards
const SummaryCard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value, color }) => (
  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
    <div className={`text-2xl font-bold ${color}`}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    <div className="text-sm text-gray-600 dark:text-gray-300">
      {title}
    </div>
  </div>
);

// Sub-component for endpoint performance cards
const EndpointCard: React.FC<{ endpoint: string; stats: EndpointStats }> = ({ endpoint, stats }) => {
  const getPerformanceClasses = (duration: number): string => {
    if (duration < PERFORMANCE_THRESHOLDS.GOOD) return 'text-green-600 dark:text-green-400';
    if (duration < PERFORMANCE_THRESHOLDS.WARNING) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getBarClasses = (duration: number): string => {
    if (duration < PERFORMANCE_THRESHOLDS.GOOD) return 'bg-green-500';
    if (duration < PERFORMANCE_THRESHOLDS.WARNING) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const barWidth = Math.min((stats.avg_duration / MAX_BAR_DURATION) * 100, 100);

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`font-medium ${getPerformanceClasses(stats.avg_duration)}`}>
          {endpoint}
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceClasses(stats.avg_duration)} bg-opacity-10`}>
          {stats.avg_duration.toFixed(2)}s
        </div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Avg: {stats.avg_duration.toFixed(3)}s |
        P95: {stats.p95_duration.toFixed(3)}s |
        Count: {stats.count.toLocaleString()}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={Math.min(stats.avg_duration, MAX_BAR_DURATION)} aria-valuemin={0} aria-valuemax={MAX_BAR_DURATION}>
        <div
          className={`h-2 rounded-full transition-all ${getBarClasses(stats.avg_duration)}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
};

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchMetrics = useCallback(async () => {
    if (!token) {
      setError('Authentication token is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/admin/performance-metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch performance metrics:', err);
      setError('Failed to load performance metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Early return for missing authentication
  if (!token) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-red-600 dark:text-red-400">
          Authentication required to view performance metrics.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ArrowTrendingUpIcon className="w-6 h-6 text-blue-600" aria-hidden="true" />
          Performance Monitor
        </h2>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={loading ? 'Refreshing metrics...' : 'Refresh metrics'}
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-6" aria-label="Loading metrics">
          <div className="h-full bg-blue-600 animate-pulse"></div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {/* Metrics display */}
      {metrics && !loading && !error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <SummaryCard
              title="Total Requests"
              value={metrics.total_requests}
              color="text-blue-600 dark:text-blue-400"
            />
            <SummaryCard
              title={`Slow Requests ({'>'} ${PERFORMANCE_THRESHOLDS.WARNING}s)`}
              value={metrics.slow_requests_count}
              color="text-yellow-600 dark:text-yellow-400"
            />
            <SummaryCard
              title="Error Types"
              value={Object.keys(metrics.error_counts).length}
              color="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Endpoint Performance */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Endpoint Performance
            </h3>
            <div className="space-y-4">
              {Object.keys(metrics.endpoints).length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">No endpoint data available.</div>
              ) : (
                Object.entries(metrics.endpoints).map(([endpoint, stats]) => (
                  <EndpointCard key={endpoint} endpoint={endpoint} stats={stats} />
                ))
              )}
            </div>
          </div>

          {/* Errors */}
          {Object.keys(metrics.error_counts).length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-red-800 dark:text-red-400 mb-3">
                Error Summary
              </h4>
              <div className="space-y-1">
                {Object.entries(metrics.error_counts).map(([errorType, count]) => (
                  <div key={errorType} className="text-sm text-red-700 dark:text-red-300">
                    • {errorType}: {count} occurrences
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" aria-hidden="true" />
              <h4 className="font-semibold text-blue-800 dark:text-blue-400">
                Optimization Recommendations
              </h4>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <div>• Enable caching for frequently accessed data</div>
              <div>• Optimize slow endpoints ({'>'} ${PERFORMANCE_THRESHOLDS.WARNING}s)</div>
              <div>• Add database indexes for common queries</div>
              <div>• Consider CDN for static assets</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceMonitor;
