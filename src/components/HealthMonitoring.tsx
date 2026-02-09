import React, { useState, useEffect, useCallback } from 'react'
import { analytics } from '../services/analytics';
import { getAdminStats, getSystemHealth } from '../api/admin';
import { logger } from '../utils/logger';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon, 
  HeartIcon, 
  InformationCircleIcon, 
  LightBulbIcon,
  FlagIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface CrisisIndicator {
  id: string;
  type: 'mood' | 'behavior' | 'communication' | 'physical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  userId: string;
  resolved: boolean;
  actions: string[];
}

interface HealthMetrics {
  totalUsers: number;
  activeMonitoring: number;
  crisisAlerts: number;
  safetyChecks: number;
  averageMood: number;
  riskLevel: 'low' | 'medium' | 'high';
}

const HealthMonitoring: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    totalUsers: 0,
    activeMonitoring: 0,
    crisisAlerts: 0,
    safetyChecks: 0,
    averageMood: 0,
    riskLevel: 'low',
  });

  const [crisisIndicators, setCrisisIndicators] = useState<CrisisIndicator[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIndicator, setSelectedIndicator] = useState<CrisisIndicator | null>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');

  const loadRealMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const [statsResult, healthResult] = await Promise.allSettled([
        getAdminStats(),
        getSystemHealth(),
      ]);

      const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
      const health = healthResult.status === 'fulfilled' ? healthResult.value : null;

      const totalUsers = stats?.users?.total ?? 0;
      const activeUsers = stats?.users?.active7d ?? 0;
      const totalMoods = stats?.moods?.total ?? 0;
      const errorRate = health?.errorRate ?? 0;
      const systemStatus = health?.status ?? 'unknown';

      // Calculate average mood from backend data if available
      const avgMood = stats?.moods?.averageMood ?? 0;

      // Determine risk level from system health
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (systemStatus === 'degraded' || errorRate > 5) riskLevel = 'medium';
      if (systemStatus === 'unhealthy' || errorRate > 15) riskLevel = 'high';

      setMetrics({
        totalUsers,
        activeMonitoring: activeUsers,
        crisisAlerts: 0, // Real crisis detection would come from a dedicated backend endpoint
        safetyChecks: totalMoods,
        averageMood: avgMood,
        riskLevel,
      });

      // Generate alerts from real data
      const alerts: CrisisIndicator[] = [];
      if (systemStatus === 'degraded' || systemStatus === 'unhealthy') {
        alerts.push({
          id: 'sys-health',
          type: 'behavior',
          severity: systemStatus === 'unhealthy' ? 'critical' : 'medium',
          description: `System status: ${systemStatus} — backend may affect user experience`,
          detectedAt: new Date(),
          userId: 'system',
          resolved: false,
          actions: ['Check backend logs', 'Review error rate', 'Contact DevOps'],
        });
      }
      if (errorRate > 10) {
        alerts.push({
          id: 'error-rate',
          type: 'communication',
          severity: errorRate > 20 ? 'high' : 'medium',
          description: `High backend error rate: ${errorRate.toFixed(1)}%`,
          detectedAt: new Date(),
          userId: 'system',
          resolved: false,
          actions: ['Check server logs', 'Review recent deployments', 'Monitor trends'],
        });
      }
      setCrisisIndicators(alerts);

      logger.info('HealthMonitoring: loaded real metrics', { totalUsers, activeUsers, avgMood, systemStatus });
    } catch (err) {
      logger.error('HealthMonitoring: failed to load metrics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    analytics.page('Health Monitoring Dashboard', {
      component: 'HealthMonitoring',
    });
    loadRealMetrics();
  }, [loadRealMetrics]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high': return <ExclamationCircleIcon className="w-5 h-5 text-error-500" />;
      case 'medium': return <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />;
      case 'low': return <InformationCircleIcon className="w-5 h-5 text-info-500" />;
      default: return <InformationCircleIcon className="w-5 h-5" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mood': return <LightBulbIcon className="w-5 h-5" />;
      case 'behavior': return <FlagIcon className="w-5 h-5" />;
      case 'communication': return <ExclamationTriangleIcon className="w-5 h-5" />;
      case 'physical': return <HeartIcon className="w-5 h-5" />;
      default: return <InformationCircleIcon className="w-5 h-5" />;
    }
  };

  const handleResolveIndicator = (indicator: CrisisIndicator) => {
    setCrisisIndicators(prev =>
      prev.map(item =>
        item.id === indicator.id ? { ...item, resolved: true } : item
      )
    );

    analytics.health.crisisDetected(
      [indicator.description],
      {
        severity: indicator.severity,
        resolved: true,
        component: 'HealthMonitoring',
      }
    );

    // Update metrics
    setMetrics(prev => ({
      ...prev,
      crisisAlerts: Math.max(0, prev.crisisAlerts - 1),
    }));
  };

  const handleTakeAction = (indicator: CrisisIndicator, action: string) => {
    setSelectedIndicator(indicator);
    setSelectedAction(action);
    setActionDialog(true);

    analytics.track('Health Action Taken', {
      indicatorId: indicator.id,
      action,
      severity: indicator.severity,
      component: 'HealthMonitoring',
    });
  };

  // Static color map to avoid dynamic Tailwind classes that get purged by JIT
  const colorClasses: Record<string, string> = {
    primary: 'text-primary-600 dark:text-primary-400',
    secondary: 'text-secondary-600 dark:text-secondary-400',
    success: 'text-success-600 dark:text-success-400',
    error: 'text-error-600 dark:text-error-400',
    warning: 'text-warning-600 dark:text-warning-400',
    info: 'text-info-600 dark:text-info-400',
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color?: string;
  }> = ({ title, value, subtitle, icon, color = 'primary' }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {loading ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={colorClasses[color] ?? colorClasses.primary}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Admin Dashboard Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <h3 className="font-bold text-lg">Admin Dashboard</h3>
            <p className="text-purple-100 text-sm">
              Endast för administratörer. Realtidsdata från backend.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Health & Safety Monitoring
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Real-time monitoring of user mental health and safety indicators
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
            onClick={() => {
              analytics.track('Health Check Initiated', {
                component: 'HealthMonitoring',
              });
            }}
          >
            <HeartIcon className="w-5 h-5" aria-hidden="true" />
            Run Health Check
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-error-600 hover:bg-error-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 min-h-[44px]"
            onClick={() => {
              analytics.track('Emergency Protocol Activated', {
                component: 'HealthMonitoring',
              });
            }}
          >
            <ExclamationTriangleIcon className="w-5 h-5" aria-hidden="true" />
            Emergency Protocol
          </button>
        </div>
      </div>

      {/* Critical Alert */}
      {metrics.crisisAlerts > 0 && (
        <div className="bg-error-50 dark:bg-error-900/20 border-l-4 border-error-500 p-4 rounded-lg">
          <h3 className="text-lg font-bold text-error-900 dark:text-error-100 mb-1">
            🚨 {metrics.crisisAlerts} Active Crisis Alert{metrics.crisisAlerts > 1 ? 's' : ''}
          </h3>
          <p className="text-sm text-error-800 dark:text-error-200">
            Immediate attention required for users showing critical mental health indicators.
          </p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Monitoring"
          value={metrics.activeMonitoring}
          subtitle="Users under active health monitoring"
          icon={<LightBulbIcon className="w-10 h-10" />}
          color="primary"
        />

        <MetricCard
          title="Crisis Alerts"
          value={metrics.crisisAlerts}
          subtitle="Require immediate attention"
          icon={<ExclamationCircleIcon className="w-10 h-10" />}
          color="error"
        />

        <MetricCard
          title="Safety Checks"
          value={metrics.safetyChecks}
          subtitle="Completed this week"
          icon={<CheckCircleIcon className="w-10 h-10" />}
          color="success"
        />

        <MetricCard
          title="Average Mood"
          value={`${metrics.averageMood}/10`}
          subtitle="Community mood score"
          icon={<HeartIcon className="w-10 h-10" />}
          color="secondary"
        />
      </div>

      {/* Risk Level Indicator */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Community Risk Level
          </h3>
          <span className={`px-4 py-2 rounded-full text-sm font-bold ${
            metrics.riskLevel === 'low' 
              ? 'bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-300' 
              : metrics.riskLevel === 'medium' 
              ? 'bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300' 
              : 'bg-error-100 dark:bg-error-900/20 text-error-700 dark:text-error-300'
          }`}>
            {metrics.riskLevel.toUpperCase()}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              metrics.riskLevel === 'low' 
                ? 'bg-success-600' 
                : metrics.riskLevel === 'medium' 
                ? 'bg-warning-600' 
                : 'bg-error-600'
            }`}
            style={{ width: `${metrics.riskLevel === 'low' ? 25 : metrics.riskLevel === 'medium' ? 60 : 90}%` }}
            role="progressbar"
            aria-valuenow={metrics.riskLevel === 'low' ? 25 : metrics.riskLevel === 'medium' ? 60 : 90}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Based on crisis indicators, mood trends, and user engagement patterns
        </p>
      </div>

      {/* Crisis Indicators */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Active Crisis Indicators
          </h3>
          <span className="px-3 py-1 bg-error-100 dark:bg-error-900/20 text-error-700 dark:text-error-300 text-sm font-medium rounded-full">
            {crisisIndicators.filter(i => !i.resolved).length} Active
          </span>
        </div>

        <div className="space-y-4">
          {crisisIndicators.map((indicator) => (
            <div key={indicator.id} className={`p-4 rounded-lg border ${
              indicator.resolved 
                ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60' 
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}>
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2">
                  {getTypeIcon(indicator.type)}
                  {getSeverityIcon(indicator.severity)}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {indicator.description}
                      </p>
                      <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                        indicator.severity === 'critical' || indicator.severity === 'high'
                          ? 'bg-error-100 dark:bg-error-900/20 text-error-700 dark:text-error-300'
                          : indicator.severity === 'medium'
                          ? 'bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300'
                          : 'bg-info-100 dark:bg-info-900/20 text-info-700 dark:text-info-300'
                      }`}>
                        {indicator.severity.toUpperCase()}
                      </span>
                    </div>

                    {!indicator.resolved && (
                      <button
                        className="px-4 py-2 bg-success-700 hover:bg-success-800 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-success-600 min-h-[40px]"
                        onClick={() => handleResolveIndicator(indicator)}
                      >
                        Resolve
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Detected: {indicator.detectedAt.toLocaleString()} • User: {indicator.userId}
                  </p>

                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Recommended Actions:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {indicator.actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm rounded-lg border border-gray-300 dark:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          onClick={() => handleTakeAction(indicator, action)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Dialog */}
      {actionDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setActionDialog(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Take Action: {selectedAction}
              </h2>
              <button
                onClick={() => setActionDialog(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Close dialog"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
              You are about to take the following action for user {selectedIndicator?.userId}:
            </p>

            <p className="text-xl font-semibold text-primary-600 dark:text-primary-400 mb-4">
              {selectedAction}
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Indicator: {selectedIndicator?.description}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Action Notes
                </label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="Add any additional notes or context for this action..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority Level
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  defaultValue="high"
                >
                  <option value="critical">Critical - Immediate Action Required</option>
                  <option value="high">High - Action Within 1 Hour</option>
                  <option value="medium">Medium - Action Within 24 Hours</option>
                  <option value="low">Low - Monitor and Follow Up</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setActionDialog(false)}
                className="px-6 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                onClick={() => {
                  analytics.track('Health Action Executed', {
                    action: selectedAction,
                    indicatorId: selectedIndicator?.id,
                    component: 'HealthMonitoring',
                  });
                  setActionDialog(false);
                }}
              >
                Execute Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy & Compliance Notice */}
      <div className="bg-info-50 dark:bg-info-900/20 border-l-4 border-info-500 p-4 rounded-lg">
        <p className="text-sm text-info-900 dark:text-info-100">
          <strong>Privacy & Compliance:</strong> All health monitoring data is processed in strict compliance with
          GDPR, HIPAA, and Swedish patient data regulations. User data is encrypted, anonymized, and only accessible
          to authorized healthcare professionals. Crisis detection algorithms are designed to prioritize user safety
          while respecting privacy rights.
        </p>
      </div>
    </div>
  );
};

export default HealthMonitoring;




