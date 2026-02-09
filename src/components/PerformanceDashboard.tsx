import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Typography, Chip, Alert, Button } from './ui/tailwind';
import { analytics } from '../services/analytics';
import { initializePerformanceMonitoring, performanceMonitor } from '../services/performanceMonitor';
import { ArrowPathIcon, ArrowTrendingUpIcon, ChartBarIcon, ClockIcon, ExclamationTriangleIcon, CpuChipIcon, ServerIcon, SignalIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

interface PerformanceMetrics {
  coreWebVitals: {
    cls: number;
    fid: number;
    fcp: number;
    lcp: number;
    ttfb: number;
  };
  budgets: Array<{
    resource: string;
    budget: number;
    unit: string;
    current: number;
    exceeded: boolean;
  }>;
  memoryUsage: number;
  navigationTiming: {
    loadTime: number;
    dnsLookup: number;
    tcpConnection: number;
  };
  resourceMetrics: {
    slowResources: number;
    largeResources: number;
    totalSize: number;
  };
}

interface PerformanceIssue {
  id: string;
  type: 'budget' | 'vital' | 'resource' | 'memory';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

/** Read real Web Vitals from the browser Performance API */
const getRealWebVitals = () => {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const paint = performance.getEntriesByType('paint');
  const fcpEntry = paint.find(e => e.name === 'first-contentful-paint');

  return {
    fcp: fcpEntry ? fcpEntry.startTime : 0,
    lcp: 0,
    ttfb: nav ? nav.responseStart - nav.requestStart : 0,
    cls: 0,
    fid: 0,
  };
};

/** Get real memory usage if available */
const getRealMemory = (): number => {
  const perf = performance as any;
  if (perf.memory) {
    return Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
  }
  return 0;
};

const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    coreWebVitals: { cls: 0, fid: 0, fcp: 0, lcp: 0, ttfb: 0 },
    budgets: [],
    memoryUsage: 0,
    navigationTiming: { loadTime: 0, dnsLookup: 0, tcpConnection: 0 },
    resourceMetrics: { slowResources: 0, largeResources: 0, totalSize: 0 },
  });

  const [issues, setIssues] = useState<PerformanceIssue[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const analyzePerformanceIssues = useCallback((m: PerformanceMetrics) => {
    const newIssues: PerformanceIssue[] = [];

    if (m.coreWebVitals.cls > 0.1) {
      newIssues.push({
        id: 'cls-high', type: 'vital', severity: 'high',
        title: 'Hög Cumulative Layout Shift',
        description: 'Layoutskiftningar påverkar användarupplevelsen negativt',
        value: m.coreWebVitals.cls, threshold: 0.1, timestamp: new Date(),
      });
    }
    if (m.coreWebVitals.fid > 100) {
      newIssues.push({
        id: 'fid-high', type: 'vital', severity: 'medium',
        title: 'Långsam First Input Delay',
        description: 'Användarinteraktioner fördröjs',
        value: m.coreWebVitals.fid, threshold: 100, timestamp: new Date(),
      });
    }
    if (m.coreWebVitals.lcp > 2500) {
      newIssues.push({
        id: 'lcp-high', type: 'vital', severity: 'high',
        title: 'Långsam Largest Contentful Paint',
        description: 'Huvudinnehållet laddas för långsamt',
        value: m.coreWebVitals.lcp, threshold: 2500, timestamp: new Date(),
      });
    }
    m.budgets.forEach(budget => {
      if (budget.exceeded) {
        newIssues.push({
          id: `budget-${budget.resource}`, type: 'budget',
          severity: budget.resource.includes('layout-shift') || budget.resource.includes('paint') ? 'high' : 'medium',
          title: `Budget överskriden: ${budget.resource}`,
          description: `${budget.resource} överskrider budget (${budget.current}${budget.unit} > ${budget.budget}${budget.unit})`,
          value: budget.current, threshold: budget.budget, timestamp: new Date(),
        });
      }
    });
    if (m.memoryUsage > 100) {
      newIssues.push({
        id: 'memory-high', type: 'memory', severity: 'medium',
        title: 'Hög minnesanvändning',
        description: 'Applikationen använder mycket minne',
        value: m.memoryUsage, threshold: 100, timestamp: new Date(),
      });
    }
    setIssues(newIssues);
  }, []);

  const loadPerformanceMetrics = useCallback(async () => {
    try {
      const budgets = performanceMonitor.getBudgetsStatus();
      const realVitals = getRealWebVitals();
      const memoryMB = getRealMemory();
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const slowResources = resources.filter(r => r.duration > 1000).length;
      const largeResources = resources.filter(r => r.transferSize > 100_000).length;
      const totalSize = Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024);

      const realMetrics: PerformanceMetrics = {
        coreWebVitals: {
          cls: realVitals.cls,
          fid: realVitals.fid,
          fcp: Math.round(realVitals.fcp),
          lcp: Math.round(realVitals.lcp),
          ttfb: Math.round(realVitals.ttfb),
        },
        budgets,
        memoryUsage: memoryMB,
        navigationTiming: {
          loadTime: nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0,
          dnsLookup: nav ? Math.round(nav.domainLookupEnd - nav.domainLookupStart) : 0,
          tcpConnection: nav ? Math.round(nav.connectEnd - nav.connectStart) : 0,
        },
        resourceMetrics: { slowResources, largeResources, totalSize },
      };

      setMetrics(realMetrics);
      analyzePerformanceIssues(realMetrics);
    } catch (error) {
      logger.error('Failed to load performance metrics:', error);
    }
  }, [analyzePerformanceIssues]);

  useEffect(() => {
    analytics.page('Performance Dashboard', { component: 'PerformanceDashboard' });
    initializePerformanceMonitoring();
    loadPerformanceMetrics();
  }, [loadPerformanceMetrics]);

  // Observe LCP and CLS with PerformanceObserver
  useEffect(() => {
    const observers: PerformanceObserver[] = [];
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (last) {
          setMetrics(prev => ({
            ...prev,
            coreWebVitals: { ...prev.coreWebVitals, lcp: Math.round(last.startTime) },
          }));
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObserver);
    } catch { /* not supported */ }

    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        if (clsValue > 0) {
          setMetrics(prev => ({
            ...prev,
            coreWebVitals: { ...prev.coreWebVitals, cls: Math.round(clsValue * 1000) / 1000 },
          }));
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      observers.push(clsObserver);
    } catch { /* not supported */ }

    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as any;
        if (entry) {
          setMetrics(prev => ({
            ...prev,
            coreWebVitals: { ...prev.coreWebVitals, fid: Math.round(entry.processingStart - entry.startTime) },
          }));
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      observers.push(fidObserver);
    } catch { /* not supported */ }

    return () => { observers.forEach(o => o.disconnect()); };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    analytics.track('Performance Data Refreshed', { component: 'PerformanceDashboard' });
    await loadPerformanceMetrics();
    setRefreshing(false);
  };

  const getStatusClasses = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good': return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Bra' };
      case 'warning': return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Varning' };
      case 'error': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Dålig' };
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'budget': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'vital': return <ClockIcon className="w-5 h-5 text-red-500" />;
      case 'resource': return <SignalIcon className="w-5 h-5 text-blue-500" />;
      case 'memory': return <CpuChipIcon className="w-5 h-5 text-purple-500" />;
      default: return <ChartBarIcon className="w-5 h-5 text-slate-500" />;
    }
  };

  const MetricCard: React.FC<{
    title: string; value: string | number; unit?: string;
    status?: 'good' | 'warning' | 'error'; icon: React.ReactNode; subtitle?: string;
  }> = ({ title, value, unit, status = 'good', icon, subtitle }) => {
    const s = getStatusClasses(status);
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {icon}
              <Typography variant="body2" color="text.secondary">{title}</Typography>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>
          </div>
          <Typography variant="h4" component="div">
            {typeof value === 'number' ? value.toFixed(value < 1 ? 3 : 0) : value}
            {unit && <span className="text-base text-slate-400 ml-1">{unit}</span>}
          </Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" className="mt-1">{subtitle}</Typography>}
        </CardContent>
      </Card>
    );
  };

  const TabButton: React.FC<{ index: number; label: string }> = ({ index, label }) => (
    <button
      onClick={() => setSelectedTab(index)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        selectedTab === index
          ? 'bg-primary-500 text-white'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );

  const WebVitalsSection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        title="First Contentful Paint" value={metrics.coreWebVitals.fcp} unit="ms"
        status={metrics.coreWebVitals.fcp < 1800 ? 'good' : metrics.coreWebVitals.fcp < 3000 ? 'warning' : 'error'}
        icon={<ClockIcon className="w-5 h-5 text-blue-500" />} subtitle="Tid till första innehåll"
      />
      <MetricCard
        title="Largest Contentful Paint" value={metrics.coreWebVitals.lcp} unit="ms"
        status={metrics.coreWebVitals.lcp < 2500 ? 'good' : metrics.coreWebVitals.lcp < 4000 ? 'warning' : 'error'}
        icon={<ClockIcon className="w-5 h-5 text-indigo-500" />} subtitle="Tid till största innehåll"
      />
      <MetricCard
        title="First Input Delay" value={metrics.coreWebVitals.fid} unit="ms"
        status={metrics.coreWebVitals.fid < 100 ? 'good' : metrics.coreWebVitals.fid < 300 ? 'warning' : 'error'}
        icon={<ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />} subtitle="Interaktionsrespons"
      />
      <MetricCard
        title="Cumulative Layout Shift" value={metrics.coreWebVitals.cls}
        status={metrics.coreWebVitals.cls < 0.1 ? 'good' : metrics.coreWebVitals.cls < 0.25 ? 'warning' : 'error'}
        icon={<ChartBarIcon className="w-5 h-5 text-orange-500" />} subtitle="Visuell stabilitet"
      />
      <MetricCard
        title="Time to First Byte" value={metrics.coreWebVitals.ttfb} unit="ms"
        status={metrics.coreWebVitals.ttfb < 800 ? 'good' : metrics.coreWebVitals.ttfb < 1800 ? 'warning' : 'error'}
        icon={<ServerIcon className="w-5 h-5 text-cyan-500" />} subtitle="Serverresponstid"
      />
      <MetricCard
        title="Minnesanvändning" value={metrics.memoryUsage} unit="MB"
        status={metrics.memoryUsage < 50 ? 'good' : metrics.memoryUsage < 100 ? 'warning' : 'error'}
        icon={<CpuChipIcon className="w-5 h-5 text-purple-500" />} subtitle="JavaScript heap"
      />
    </div>
  );

  const BudgetsSection = () => (
    <div className="space-y-4">
      <Typography variant="h6">Prestandabudgetar</Typography>
      {metrics.budgets.length === 0 ? (
        <Alert severity="info"><Typography>Inga prestandabudgetar konfigurerade.</Typography></Alert>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.budgets.map((budget) => {
            const pct = Math.min((budget.current / budget.budget) * 100, 100);
            return (
              <Card key={budget.resource}>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <Typography variant="body1">
                      {budget.resource.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <Chip label={budget.exceeded ? 'Överskriden' : 'OK'} color={budget.exceeded ? 'error' : 'success'} size="small" />
                  </div>
                  <Typography variant="body2" color="text.secondary" className="mb-2">
                    {budget.current.toFixed(1)}{budget.unit} / {budget.budget}{budget.unit}
                  </Typography>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${budget.exceeded ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const IssuesSection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Typography variant="h6">Prestandaproblem</Typography>
        <Chip label={`${issues.length} problem`} color={issues.length > 0 ? 'warning' : 'success'} size="small" />
      </div>
      {issues.length === 0 ? (
        <Alert severity="success"><Typography>Inga prestandaproblem upptäckta!</Typography></Alert>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Card key={issue.id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getSeverityIcon(issue.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Typography variant="body1" className="font-medium">{issue.title}</Typography>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        issue.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>{issue.severity}</span>
                    </div>
                    <Typography variant="body2" color="text.secondary">{issue.description}</Typography>
                    <Typography variant="body2" color="text.secondary" className="mt-1">
                      Värde: {issue.value.toFixed(2)} (Gräns: {issue.threshold})
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography variant="h4" component="h1">Prestandaövervakning</Typography>
          <Typography variant="body1" color="text.secondary">Realtidsdata från Core Web Vitals och prestanda-API:er</Typography>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <ArrowPathIcon className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Uppdaterar...' : 'Uppdatera'}
        </Button>
      </div>

      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        <TabButton index={0} label="Core Web Vitals" />
        <TabButton index={1} label="Prestandabudgetar" />
        <TabButton index={2} label="Problem & Varningar" />
      </div>

      {selectedTab === 0 && <WebVitalsSection />}
      {selectedTab === 1 && <BudgetsSection />}
      {selectedTab === 2 && <IssuesSection />}
    </div>
  );
};

export default PerformanceDashboard;




