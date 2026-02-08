import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui/tailwind';
import { useTranslation } from 'react-i18next';
import {
  getKeyRotationStatus,
  getTamperEvents,
  getSecurityMetrics,
  type ApiKeyRotationStatus,
  type TamperEvent,
  type SecurityMetrics
} from '../../api/security';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';

/**
 * SecurityMonitor - Admin-only component for security monitoring
 * Displays API key rotation status, tamper detection events, and security metrics
 */
const SecurityMonitor: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [keyRotationStatus, setKeyRotationStatus] = useState<ApiKeyRotationStatus | null>(null);
  const [tamperEvents, setTamperEvents] = useState<TamperEvent[]>([]);
  const [tamperSummary, setTamperSummary] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<TamperEvent[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);

  const loadSecurityData = async () => {
    try {
      setError(null);
      
      const [keyStatus, tamperData, metrics] = await Promise.all([
        getKeyRotationStatus().catch(() => null),
        getTamperEvents(50).catch(() => ({ events: [], summary: null, activeAlerts: [] })),
        getSecurityMetrics().catch(() => null)
      ]);

      setKeyRotationStatus(keyStatus);
      setTamperEvents(tamperData.events || []);
      setTamperSummary(tamperData.summary);
      setActiveAlerts(tamperData.activeAlerts || []);
      setSecurityMetrics(metrics);

      logger.info('Security data loaded successfully');
    } catch (err: any) {
      logger.error('Failed to load security data:', err);
      setError(err.message || 'Kunde inte ladda säkerhetsdata');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSecurityData();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('security.title', 'Säkerhetsövervakning')}
            </h1>
            <p className="text-sm text-gray-500">
              {t('security.subtitle', 'Admin säkerhetsdashboard')}
            </p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Uppdatera')}
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-800">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {/* Security Metrics Overview */}
      {securityMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Auth Failures</p>
                <p className="text-2xl font-bold text-gray-900">
                  {securityMetrics.authFailures || 0}
                </p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Suspicious Activity</p>
                <p className="text-2xl font-bold text-gray-900">
                  {securityMetrics.suspiciousActivity || 0}
                </p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Blocked Requests</p>
                <p className="text-2xl font-bold text-gray-900">
                  {securityMetrics.blockedRequests || 0}
                </p>
              </div>
              <ShieldCheckIcon className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Threats</p>
                <p className="text-2xl font-bold text-gray-900">
                  {securityMetrics.activeThreats || 0}
                </p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            </div>
          </Card>
        </div>
      )}

      {/* API Key Rotation Status */}
      {keyRotationStatus && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold">
              {t('security.keyRotation', 'API Key Rotation')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Service</p>
              <p className="font-medium">{keyRotationStatus.service}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{keyRotationStatus.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Keys</p>
              <p className="font-medium">{keyRotationStatus.keysActive}</p>
            </div>
            {keyRotationStatus.lastRotation && (
              <div>
                <p className="text-sm text-gray-500">Last Rotation</p>
                <p className="font-medium">
                  {new Date(keyRotationStatus.lastRotation).toLocaleString()}
                </p>
              </div>
            )}
            {keyRotationStatus.nextRotation && (
              <div>
                <p className="text-sm text-gray-500">Next Rotation</p>
                <p className="font-medium">
                  {new Date(keyRotationStatus.nextRotation).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="p-6 border-red-300 bg-red-50">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900">
              {t('security.activeAlerts', 'Active Alerts')} ({activeAlerts.length})
            </h2>
          </div>
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{alert.type}</p>
                    <p className="text-sm opacity-75">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded uppercase">
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tamper Detection Events */}
      {tamperSummary && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold">
              {t('security.tamperDetection', 'Tamper Detection')}
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{tamperSummary.totalEvents}</p>
              <p className="text-sm text-gray-500">Total Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{tamperSummary.activeAlerts}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{tamperSummary.resolvedEvents}</p>
              <p className="text-sm text-gray-500">Resolved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{tamperSummary.criticalEvents}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
          </div>

          {tamperEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold mb-2">Recent Events</h3>
              {tamperEvents.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(event.severity)}`}>
                          {event.severity}
                        </span>
                        <span className="font-medium">{event.type}</span>
                        {event.resolved && (
                          <span className="text-xs text-green-600">✓ Resolved</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        <ClockIcon className="h-4 w-4 inline mr-1" />
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        <ClockIcon className="h-4 w-4 inline mr-1" />
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default SecurityMonitor;
