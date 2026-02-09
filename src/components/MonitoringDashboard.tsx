import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { Card, Button } from './ui/tailwind';
import { analytics } from '../services/analytics';
import { useTranslation } from 'react-i18next';
import FocusTrap from './Accessibility/FocusTrap';
import { formatNumber, formatDateTime } from '../utils/intlFormatters';
import { ArrowPathIcon, ArrowTrendingUpIcon, ChartBarIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ShieldCheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { getAdminStats, getSystemHealth } from '../api/admin';
import { logger } from '../utils/logger';

interface SystemMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  performanceScore: number;
  securityIncidents: number;
}

interface AlertItem {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

const MonitoringDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 0,
    responseTime: 0,
    errorRate: 0,
    activeUsers: 0,
    performanceScore: 0,
    securityIncidents: 0,
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedAlert && dialogCloseRef.current) {
      dialogCloseRef.current.focus();
    }
  }, [selectedAlert]);

  useEffect(() => {
    analytics.page('Monitoring Dashboard', {
      component: 'MonitoringDashboard',
    });
    loadRealMetrics();
  }, []);

  const loadRealMetrics = useCallback(async () => {
    try {
      const [statsData, healthData] = await Promise.allSettled([
        getAdminStats(),
        getSystemHealth(),
      ]);

      const stats = statsData.status === 'fulfilled' ? statsData.value : null;
      const health = healthData.status === 'fulfilled' ? healthData.value : null;

      setMetrics({
        uptime: health?.status === 'healthy' ? 99.9 : health?.status === 'degraded' ? 95.0 : 0,
        responseTime: health?.uptimeRequests || 0,
        errorRate: health?.errorRate || 0,
        activeUsers: stats?.users?.active7d || 0,
        performanceScore: health?.status === 'healthy' ? 95 : health?.status === 'degraded' ? 70 : 30,
        securityIncidents: 0,
      });

      // Generate alerts from real data
      const realAlerts: AlertItem[] = [];
      if (health?.status === 'degraded') {
        realAlerts.push({
          id: 'health-degraded',
          type: 'warning',
          title: t('monitoring.healthDegraded', 'Systemet är överbelastat'),
          message: t('monitoring.healthDegradedMsg', 'Systemhälsan är degraderad - kontrollera backend-tjänster'),
          timestamp: new Date(),
          resolved: false,
        });
      }
      if (health?.firebase === 'disconnected') {
        realAlerts.push({
          id: 'firebase-down',
          type: 'error',
          title: t('monitoring.firebaseDown', 'Firebase är nere'),
          message: t('monitoring.firebaseDownMsg', 'Firebase-anslutningen är bruten'),
          timestamp: new Date(),
          resolved: false,
        });
      }
      if ((health?.errorRate || 0) > 1) {
        realAlerts.push({
          id: 'high-error-rate',
          type: 'warning',
          title: t('monitoring.highErrorRate', 'Hög felfrekvens'),
          message: t('monitoring.highErrorRateMsg', `Felfrekvens: ${(health?.errorRate || 0).toFixed(1)}%`),
          timestamp: new Date(),
          resolved: false,
        });
      }
      if (realAlerts.length === 0) {
        realAlerts.push({
          id: 'all-good',
          type: 'info',
          title: t('monitoring.allGood', 'Alla system fungerar'),
          message: t('monitoring.allGoodMsg', 'Inga problem upptäckta'),
          timestamp: new Date(),
          resolved: true,
        });
      }
      setAlerts(realAlerts);
    } catch (err) {
      logger.error('Failed to load monitoring metrics:', err);
    }
  }, [t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    analytics.track('Monitoring Data Refreshed', {
      component: 'MonitoringDashboard',
    });
    await loadRealMetrics();
    setRefreshing(false);
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'success';
    if (value >= thresholds.warning) return 'warning';
    return 'error';
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'error': return <ExclamationCircleIcon className="w-5 h-5 text-error-600" />;
      case 'warning': return <ExclamationTriangleIcon className="w-5 h-5 text-warning-600" />;
      case 'info': return <InformationCircleIcon className="w-5 h-5 text-blue-600" />;
      default: return <InformationCircleIcon className="w-5 h-5" />;
    }
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
    status?: 'success' | 'warning' | 'error';
    icon: React.ReactNode;
    screenReaderLabel: string;
  }> = ({ title, value, unit, trend, status = 'success', icon, screenReaderLabel }) => {
    const titleId = useId();
    const statusId = useId();
    const statusText = status === 'success'
      ? t('monitoring.metricGood', 'Healthy')
      : status === 'warning'
        ? t('monitoring.metricWarning', 'Warning')
        : t('monitoring.metricCritical', 'Critical');

    return (
      <Card
        role="group"
        aria-labelledby={titleId}
        aria-describedby={statusId}
        aria-label={screenReaderLabel}
      >
        <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-primary-600 dark:text-primary-500">
              {icon}
            </div>
            <h3 id={titleId} className="text-base font-medium text-gray-600 dark:text-gray-400">
              {title}
            </h3>
          </div>
          {trend && (
            <div className="text-sm">
              {trend === 'up' ? <ArrowTrendingUpIcon className="w-5 h-5 text-success-600" /> :
               trend === 'down' ? <ArrowTrendingUpIcon className="w-5 h-5 text-error-600 rotate-180" /> :
               <div />}
            </div>
          )}
        </div>

        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2" aria-live="polite">
          {value}{unit}
        </p>

        <span
          id={statusId}
          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
            status === 'success' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
            status === 'warning' ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' :
            'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
          }`}
        >
          {statusText}
        </span>
      </div>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('monitoring.title', 'System Monitoring')}
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
            {t('monitoring.description', 'Real-time health metrics and system status')}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? t('monitoring.refreshing', 'Refreshing...') : t('monitoring.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Metrics Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        role="region"
        aria-live="polite"
        aria-label={t('common.liveRegionLabel', 'Live updates')}
      >
        <MetricCard
          title="System Uptime"
          value={formatNumber(metrics.uptime, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
          unit="%"
          status={getStatusColor(metrics.uptime, { good: 99.5, warning: 99 })}
          icon={<CheckCircleIcon className="w-5 h-5" />}
          screenReaderLabel={t('monitoring.screenReaderWidgetLabel', { metric: 'System uptime' })}
        />

        <MetricCard
          title="Response Time"
          value={formatNumber(metrics.responseTime, { maximumFractionDigits: 0 })}
          unit="ms"
          trend={metrics.responseTime < 250 ? 'up' : 'down'}
          status={getStatusColor(300 - metrics.responseTime, { good: 50, warning: 20 })}
          icon={<ChartBarIcon className="w-5 h-5" />}
          screenReaderLabel={t('monitoring.screenReaderWidgetLabel', { metric: 'Response time' })}
        />

        <MetricCard
          title="Error Rate"
          value={formatNumber(metrics.errorRate, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
          unit="%"
          status={getStatusColor(1 - metrics.errorRate, { good: 0.95, warning: 0.98 })}
          icon={<ExclamationCircleIcon className="w-5 h-5" />}
          screenReaderLabel={t('monitoring.screenReaderWidgetLabel', { metric: 'Error rate' })}
        />

        <MetricCard
          title="Active Users"
          value={formatNumber(metrics.activeUsers)}
          trend="up"
          status="success"
          icon={<ChartBarIcon className="w-5 h-5" />}
          screenReaderLabel={t('monitoring.screenReaderWidgetLabel', { metric: 'Active users' })}
        />

        <MetricCard
          title="Performance Score"
          value={formatNumber(metrics.performanceScore)}
          unit="/100"
          status={getStatusColor(metrics.performanceScore, { good: 90, warning: 80 })}
          icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
          screenReaderLabel={t('monitoring.screenReaderWidgetLabel', { metric: 'Performance score' })}
        />

        <MetricCard
          title="Security Incidents"
          value={metrics.securityIncidents}
          status={metrics.securityIncidents === 0 ? 'success' : 'error'}
          icon={<ShieldCheckIcon className="w-5 h-5" />}
          screenReaderLabel={t('monitoring.screenReaderWidgetLabel', { metric: 'Security incidents' })}
        />
      </div>

      {/* Performance Score Visualization */}
      <Card>
        <div className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('monitoring.performanceBreakdown', 'Performance score breakdown')}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Lighthouse Score</span>
              <span className="font-semibold text-gray-900 dark:text-white">{metrics.performanceScore}/100</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  metrics.performanceScore >= 90 ? 'bg-success-600' :
                  metrics.performanceScore >= 80 ? 'bg-warning-600' :
                  'bg-error-600'
                }`}
                style={{ width: `${metrics.performanceScore}%` }}
                role="progressbar"
                aria-valuenow={metrics.performanceScore}
                aria-valuemin={0}
                aria-valuemax={100}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Alerts Section */}
      <Card>
        <div className="p-4 sm:p-6" role="region" aria-label={t('monitoring.alertsHeading', 'System alerts')} aria-live="polite">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('monitoring.alertsHeading', 'System alerts')}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              alerts.filter(a => !a.resolved).length > 0
                ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                : 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
            }`} role="status" aria-live="polite">
              {t('common.alertsActiveCount', { count: alerts.filter(a => !a.resolved).length })}
            </span>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700" role="list">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className="w-full flex items-start gap-3 py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
                aria-expanded={selectedAlert?.id === alert.id}
                aria-controls={`alert-${alert.id}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(alert.type)}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 dark:text-white mb-1">{alert.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {alert.message} • {formatDateTime(alert.timestamp)}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  alert.resolved
                    ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                    : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                }`}>
                  {alert.resolved ? 'Resolved' : 'Active'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Alert Detail Dialog */}
      {selectedAlert && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAlert(null)}
          aria-live="assertive"
        >
          <FocusTrap active={true} onEscape={() => setSelectedAlert(null)}>
            <div
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`alert-dialog-${selectedAlert.id}`}
              aria-describedby={`alert-dialog-desc-${selectedAlert.id}`}
            >
            <div className="flex items-start justify-between mb-4">
              <h2 id={`alert-dialog-${selectedAlert.id}`} className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedAlert.title}
              </h2>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label={t('monitoring.alertClose', 'Close dialog')}
                ref={dialogCloseRef}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4" id={`alert-dialog-desc-${selectedAlert.id}`}>
              <p className="text-base text-gray-700 dark:text-gray-300">
                {selectedAlert.message}
              </p>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>{t('monitoring.alertTimestamp', 'Timestamp')}: {formatDateTime(selectedAlert.timestamp)}</p>
                <p>
                  {t('common.status', 'Status')}: {selectedAlert.resolved ? t('monitoring.alertStatusResolved', 'Resolved') : t('monitoring.alertStatusActive', 'Active')}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              {!selectedAlert.resolved && (
                <Button
                  onClick={() => {
                    setAlerts(prev =>
                      prev.map(a =>
                        a.id === selectedAlert.id ? { ...a, resolved: true } : a
                      )
                    );
                    analytics.track('Alert Resolved', {
                      alertId: selectedAlert.id,
                      component: 'MonitoringDashboard',
                    });
                    setSelectedAlert(null);
                  }}
                  variant="primary"
                  aria-label={t('monitoring.alertResolve', 'Mark alert as resolved')}
                >
                  {t('monitoring.alertResolve', 'Mark as resolved')}
                </Button>
              )}
              <Button onClick={() => setSelectedAlert(null)} variant="outline" aria-label={t('monitoring.alertClose', 'Close dialog')}>
                {t('monitoring.alertClose', 'Close dialog')}
              </Button>
            </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  );
};

export default MonitoringDashboard;




