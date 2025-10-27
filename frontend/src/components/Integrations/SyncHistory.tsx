import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncHistoryEntry {
  id: string;
  provider: string;
  providerName: string;
  providerIcon: string;
  timestamp: string;
  status: 'success' | 'failed' | 'partial';
  dataTypes: string[];
  recordCount?: number;
  duration?: number;
  error?: string;
}

interface SyncHistoryProps {
  userId: string;
  providerFilter?: string;
}

const SyncHistory: React.FC<SyncHistoryProps> = ({ userId, providerFilter }) => {
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string>(providerFilter || 'all');
  const [dateRange, setDateRange] = useState<'7days' | '30days' | '90days'>('7days');

  useEffect(() => {
    loadSyncHistory();
  }, [userId, selectedProvider, dateRange]);

  const loadSyncHistory = async () => {
    try {
      setLoading(true);
      
      // Load from Firebase (mock data for now - replace with actual Firebase query)
      // dateRange will be used in future Firebase query: where('timestamp', '>', Date.now() - days * 86400000)
      const mockHistory: SyncHistoryEntry[] = [
        {
          id: '1',
          provider: 'google_fit',
          providerName: 'Google Fit',
          providerIcon: '🏃',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'success',
          dataTypes: ['steps', 'heart_rate', 'sleep'],
          recordCount: 156,
          duration: 2.3,
        },
        {
          id: '2',
          provider: 'fitbit',
          providerName: 'Fitbit',
          providerIcon: '⌚',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          status: 'success',
          dataTypes: ['steps', 'calories', 'distance'],
          recordCount: 89,
          duration: 1.8,
        },
        {
          id: '3',
          provider: 'samsung_health',
          providerName: 'Samsung Health',
          providerIcon: '💪',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'failed',
          dataTypes: ['steps'],
          error: 'Token expired',
        },
        {
          id: '4',
          provider: 'google_fit',
          providerName: 'Google Fit',
          providerIcon: '🏃',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'partial',
          dataTypes: ['steps', 'heart_rate'],
          recordCount: 42,
          duration: 3.1,
        },
      ];

      // Filter by provider if selected
      const filtered = selectedProvider === 'all' 
        ? mockHistory 
        : mockHistory.filter(h => h.provider === selectedProvider);

      setHistory(filtered);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200';
      case 'partial':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'partial':
        return '⚠️';
      default:
        return '⏺️';
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Nyss';
    if (diffMins < 60) return `${diffMins} min sedan`;
    if (diffHours < 24) return `${diffHours} tim sedan`;
    if (diffDays === 1) return 'Igår';
    return `${diffDays} dagar sedan`;
  };

  const formatTimestamp = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Provider Filter */}
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-red-500"
        >
          <option value="all">Alla enheter</option>
          <option value="google_fit">🏃 Google Fit</option>
          <option value="fitbit">⌚ Fitbit</option>
          <option value="samsung_health">💪 Samsung Health</option>
          <option value="withings">🩺 Withings</option>
        </select>

        {/* Date Range Filter */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as '7days' | '30days' | '90days')}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-red-500"
        >
          <option value="7days">Senaste 7 dagarna</option>
          <option value="30days">Senaste 30 dagarna</option>
          <option value="90days">Senaste 90 dagarna</option>
        </select>
      </div>

      {/* History Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

        <AnimatePresence>
          {history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                🌱 Ingen synkroniseringshistorik hittades
              </p>
            </motion.div>
          ) : (
            history.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="relative pl-16 pb-6 last:pb-0"
              >
                {/* Timeline Dot */}
                <div className={`absolute left-3 w-6 h-6 rounded-full flex items-center justify-center text-xs ${getStatusColor(entry.status)} border-2`}>
                  {getStatusIcon(entry.status)}
                </div>

                {/* Card */}
                <div className={`rounded-lg p-4 border ${getStatusColor(entry.status)}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        <span className="text-xl">{entry.providerIcon}</span>
                        {entry.providerName}
                      </h4>
                      <p className="text-xs opacity-75 mt-1">
                        {formatTimestamp(entry.timestamp)}
                        <span className="ml-2">({getTimeAgo(entry.timestamp)})</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium uppercase">
                        {entry.status === 'success' ? 'Lyckades' : entry.status === 'failed' ? 'Misslyckades' : 'Delvis'}
                      </div>
                    </div>
                  </div>

                  {/* Data Types */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {entry.dataTypes.map(type => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-white/50 dark:bg-slate-900/30 rounded text-xs font-medium"
                      >
                        {type === 'steps' && '👣 Steg'}
                        {type === 'heart_rate' && '❤️ Puls'}
                        {type === 'sleep' && '😴 Sömn'}
                        {type === 'calories' && '🔥 Kalorier'}
                        {type === 'distance' && '📏 Distans'}
                      </span>
                    ))}
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-4 text-xs opacity-75">
                    {entry.recordCount && (
                      <span>📊 {entry.recordCount} poster</span>
                    )}
                    {entry.duration && (
                      <span>⏱️ {entry.duration.toFixed(1)}s</span>
                    )}
                    {entry.error && (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        ⚠️ {entry.error}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SyncHistory;
