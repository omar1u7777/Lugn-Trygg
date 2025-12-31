import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import oauthHealthService from '../../services/oauthHealthService';

interface IntegrationWidgetProps {
  userId: string;
}

interface DeviceStatus {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSync?: string | undefined;
}

const IntegrationWidget: React.FC<IntegrationWidgetProps> = ({ userId }) => {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [healthScore, setHealthScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadDeviceStatuses();
  }, [userId]);

  const loadDeviceStatuses = async () => {
    try {
      setLoading(true);
      // CRITICAL FIX: oauthHealthService is a singleton instance, methods are called directly
      const providers = oauthHealthService.getSupportedProviders();
      const statuses = await oauthHealthService.checkAllStatuses();

      // CRITICAL FIX: Better null/undefined handling
      const deviceList: DeviceStatus[] = providers.map(provider => {
        const status = statuses.get(provider.id);
        return {
          id: provider.id,
          name: provider.name,
          icon: provider.icon,
          connected: (status?.connected === true && status?.is_expired !== true) || false,
          lastSync: status?.last_sync_time || status?.last_sync || undefined,
        };
      });

      setDevices(deviceList);

      // Calculate health score based on connected devices and recent syncs
      // CRITICAL FIX: Handle division by zero
      const connectedCount = deviceList.filter(d => d.connected).length;
      const score = providers.length > 0 
        ? Math.min(100, (connectedCount / providers.length) * 100)
        : 0;
      setHealthScore(score);
    } catch (error) {
      console.error('Failed to load device statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const connectedDevices = devices.filter(d => d.connected);
      for (const device of connectedDevices) {
        try {
          await oauthHealthService.syncHealthData(device.id, 7);
        } catch (error) {
          console.error(`Failed to sync ${device.name}:`, error);
        }
      }
      await loadDeviceStatuses();
    } catch (error) {
      console.error('Quick sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // CRITICAL FIX: Better null safety
  const connectedCount = devices.filter(d => d.connected === true).length;
  const mostRecentSync = devices
    .filter(d => d.lastSync && d.lastSync !== undefined)
    .sort((a, b) => {
      if (!a.lastSync || !b.lastSync) return 0;
      const dateA = new Date(a.lastSync).getTime();
      const dateB = new Date(b.lastSync).getTime();
      return dateB - dateA;
    })[0]?.lastSync;

  const getTimeAgo = (dateString?: string): string => {
    // CRITICAL FIX: Better null/undefined handling
    if (!dateString || dateString === undefined) return 'Aldrig';
    
    try {
      const date = new Date(dateString);
      // CRITICAL FIX: Check if date is valid
      if (isNaN(date.getTime())) return 'Ogiltigt datum';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Nyss';
      if (diffMins < 60) return `${diffMins} min sedan`;
      if (diffHours < 24) return `${diffHours} tim sedan`;
      return `${diffDays} dagar sedan`;
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return 'Ogiltigt datum';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-soft animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3"></div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-700 shadow-soft"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
          <span>❤️</span>
          Hälsointegrationer
        </h3>
        <button
          onClick={() => {
            // CRITICAL FIX: Use navigate instead of window.location.href for better UX
            if (typeof window !== 'undefined') {
              window.location.href = '/integrations';
            }
          }}
          className="text-sm text-red-600 dark:text-red-400 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
          aria-label="Gå till integrationssidan"
        >
          Visa alla →
        </button>
      </div>

      {/* Connected Devices Count */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-red-900 dark:text-red-100">
            {connectedCount}
          </span>
          <span className="text-sm text-red-700 dark:text-red-300">
            av {devices.length} anslutna
          </span>
        </div>
        
        {/* Device Icons */}
        <div className="flex gap-2 mt-3">
          {devices.map(device => (
            <div
              key={device.id}
              className={`text-2xl ${
                device.connected
                  ? 'opacity-100 scale-100'
                  : 'opacity-30 scale-90 grayscale'
              } transition-all`}
              title={device.name}
            >
              {device.icon}
            </div>
          ))}
        </div>
      </div>

      {/* Last Sync */}
      <div className="mb-4 bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
        <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
          Senaste synkronisering
        </p>
        <p className="text-sm font-semibold text-red-900 dark:text-red-100">
          {getTimeAgo(mostRecentSync)}
        </p>
      </div>

      {/* Health Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-red-700 dark:text-red-300">
            Integrationsnivå
          </span>
          <span className="text-sm font-bold text-red-900 dark:text-red-100">
            {healthScore.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-red-200 dark:bg-red-900/30 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-red-500 to-pink-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${healthScore}%` }}
          ></div>
        </div>
      </div>

      {/* Quick Sync Button */}
      {connectedCount > 0 && (
        <button
          onClick={handleQuickSync}
          disabled={syncing}
          className="w-full py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-red-400 disabled:to-pink-400 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
        >
          {syncing ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              Synkroniserar...
            </>
          ) : (
            <>
              <span className="mr-2">🔄</span>
              Synkronisera nu
            </>
          )}
        </button>
      )}

      {/* No Devices Connected */}
      {connectedCount === 0 && (
        <button
          onClick={() => {
            // CRITICAL FIX: Use navigate instead of window.location.href for better UX
            if (typeof window !== 'undefined') {
              window.location.href = '/integrations';
            }
          }}
          className="w-full py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          aria-label="Gå till integrationssidan för att ansluta enheter"
        >
          <span className="mr-2">➕</span>
          Anslut enheter
        </button>
      )}
    </motion.div>
  );
};

export default IntegrationWidget;
