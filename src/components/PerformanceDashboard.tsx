import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Speed,
  Memory,
  NetworkCheck,
  Timer,
  Warning,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Refresh,
  Analytics,
} from '@mui/icons-material';
import { analytics } from '../services/analytics';
import { initializePerformanceMonitoring, performanceMonitor } from '../services/performanceMonitor';

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

  useEffect(() => {
    analytics.page('Performance Dashboard', {
      component: 'PerformanceDashboard',
    });

    // Initialize performance monitoring
    initializePerformanceMonitoring();

    // Load initial metrics
    loadPerformanceMetrics();
  }, []);

  const loadPerformanceMetrics = async () => {
    try {
      // Get budgets status
      const budgets = performanceMonitor.getBudgetsStatus();

      // Mock real-time metrics (in production, these would come from actual measurements)
      const mockMetrics: PerformanceMetrics = {
        coreWebVitals: {
          cls: Math.random() * 0.2,
          fid: Math.random() * 150,
          fcp: spacing.sm500 + Math.random() * 1000,
          lcp: spacing.md000 + Math.random() * 1500,
          ttfb: 200 + Math.random() * 300,
        },
        budgets,
        memoryUsage: 25 + Math.random() * 25,
        navigationTiming: {
          loadTime: 1500 + Math.random() * 1000,
          dnsLookup: 50 + Math.random() * 100,
          tcpConnection: 100 + Math.random() * 200,
        },
        resourceMetrics: {
          slowResources: Math.floor(Math.random() * 10),
          largeResources: Math.floor(Math.random() * 5),
          totalSize: 300 + Math.random() * 200,
        },
      };

      setMetrics(mockMetrics);
      analyzePerformanceIssues(mockMetrics);
    } catch (error) {
      console.error('Failed to load performance metrics:', error);
    }
  };

  const analyzePerformanceIssues = (metrics: PerformanceMetrics) => {
    const newIssues: PerformanceIssue[] = [];

    // Check Core Web Vitals
    if (metrics.coreWebVitals.cls > 0.1) {
      newIssues.push({
        id: 'cls-high',
        type: 'vital',
        severity: 'high',
        title: 'High Cumulative Layout Shift',
        description: 'Layout shifts are causing poor user experience',
        value: metrics.coreWebVitals.cls,
        threshold: 0.1,
        timestamp: new Date(),
      });
    }

    if (metrics.coreWebVitals.fid > 100) {
      newIssues.push({
        id: 'fid-high',
        type: 'vital',
        severity: 'medium',
        title: 'Slow First Input Delay',
        description: 'User interactions are delayed',
        value: metrics.coreWebVitals.fid,
        threshold: 100,
        timestamp: new Date(),
      });
    }

    if (metrics.coreWebVitals.lcp > 2500) {
      newIssues.push({
        id: 'lcp-high',
        type: 'vital',
        severity: 'high',
        title: 'Slow Largest Contentful Paint',
        description: 'Main content loads too slowly',
        value: metrics.coreWebVitals.lcp,
        threshold: 2500,
        timestamp: new Date(),
      });
    }

    // Check budgets
    metrics.budgets.forEach(budget => {
      if (budget.exceeded) {
        newIssues.push({
          id: `budget-${budget.resource}`,
          type: 'budget',
          severity: budget.resource.includes('layout-shift') || budget.resource.includes('paint') ? 'high' : 'medium',
          title: `Budget Exceeded: ${budget.resource}`,
          description: `${budget.resource} exceeds budget (${budget.current}${budget.unit} > ${budget.budget}${budget.unit})`,
          value: budget.current,
          threshold: budget.budget,
          timestamp: new Date(),
        });
      }
    });

    // Check memory usage
    if (metrics.memoryUsage > 50) {
      newIssues.push({
        id: 'memory-high',
        type: 'memory',
        severity: 'medium',
        title: 'High Memory Usage',
        description: 'Application is using excessive memory',
        value: metrics.memoryUsage,
        threshold: 50,
        timestamp: new Date(),
      });
    }

    setIssues(newIssues);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    analytics.track('Performance Data Refreshed', {
      component: 'PerformanceDashboard',
    });

    await loadPerformanceMetrics();
    setRefreshing(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      default: return 'info';
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'budget': return <Warning />;
      case 'vital': return <Speed />;
      case 'resource': return <NetworkCheck />;
      case 'memory': return <Memory />;
      default: return <Analytics />;
    }
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    unit?: string;
    status?: 'good' | 'warning' | 'error';
    icon: React.ReactNode;
    subtitle?: string;
  }> = ({ title, value, unit, status = 'good', icon, subtitle }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {icon}
            <Typography variant="h6" color="text.secondary">
              {title}
            </Typography>
          </Box>
          <Chip
            label={status === 'good' ? 'Good' : status === 'warning' ? 'Warning' : 'Poor'}
            color={status}
            size="small"
          />
        </Box>

        <Typography variant="h4" component="div" gutterBottom>
          {typeof value === 'number' ? value.toFixed(1) : value}{unit}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const WebVitalsSection = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          title="First Contentful Paint"
          value={metrics.coreWebVitals.fcp}
          unit="ms"
          status={metrics.coreWebVitals.fcp < 1800 ? 'good' : metrics.coreWebVitals.fcp < 3000 ? 'warning' : 'error'}
          icon={<Timer />}
          subtitle="Time to first content"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          title="Largest Contentful Paint"
          value={metrics.coreWebVitals.lcp}
          unit="ms"
          status={metrics.coreWebVitals.lcp < 2500 ? 'good' : metrics.coreWebVitals.lcp < 4000 ? 'warning' : 'error'}
          icon={<Speed />}
          subtitle="Time to largest content"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          title="First Input Delay"
          value={metrics.coreWebVitals.fid}
          unit="ms"
          status={metrics.coreWebVitals.fid < 100 ? 'good' : metrics.coreWebVitals.fid < 300 ? 'warning' : 'error'}
          icon={<TrendingUp />}
          subtitle="Input responsiveness"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          title="Cumulative Layout Shift"
          value={metrics.coreWebVitals.cls}
          status={metrics.coreWebVitals.cls < 0.1 ? 'good' : metrics.coreWebVitals.cls < 0.25 ? 'warning' : 'error'}
          icon={<Analytics />}
          subtitle="Visual stability"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          title="Time to First Byte"
          value={metrics.coreWebVitals.ttfb}
          unit="ms"
          status={metrics.coreWebVitals.ttfb < 800 ? 'good' : metrics.coreWebVitals.ttfb < 1800 ? 'warning' : 'error'}
          icon={<NetworkCheck />}
          subtitle="Server response time"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          title="Memory Usage"
          value={metrics.memoryUsage}
          unit="MB"
          status={metrics.memoryUsage < 50 ? 'good' : metrics.memoryUsage < 100 ? 'warning' : 'error'}
          icon={<Memory />}
          subtitle="JavaScript heap"
        />
      </Grid>
    </Grid>
  );

  const BudgetsSection = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Performance Budgets
      </Typography>
      <Grid container spacing={2}>
        {metrics.budgets.map((budget) => (
          <Grid item xs={12} sm={6} md={4} key={budget.resource}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">
                    {budget.resource.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Chip
                    label={budget.exceeded ? 'Exceeded' : 'OK'}
                    color={budget.exceeded ? 'error' : 'success'}
                    size="small"
                  />
                </Box>
                <Typography variant="h6" gutterBottom>
                  {budget.current.toFixed(1)}{budget.unit} / {budget.budget}{budget.unit}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((budget.current / budget.budget) * 100, 100)}
                  color={budget.exceeded ? 'error' : 'success'}
                  sx={{ height: 8, borderRadius: borderRadius.xl }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const IssuesSection = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Performance Issues
        </Typography>
        <Chip
          label={`${issues.length} Issues`}
          color={issues.length > 0 ? 'warning' : 'success'}
          size="small"
        />
      </Box>

      {issues.length === 0 ? (
        <Alert severity="success">
          <Typography>No performance issues detected! 🎉</Typography>
        </Alert>
      ) : (
        <List>
          {issues.map((issue, index) => (
            <React.Fragment key={issue.id}>
              <ListItem sx={{ borderRadius: 1, mb: spacing.sm, bgcolor: 'background.paper' }}>
                <ListItemIcon>
                  {getSeverityIcon(issue.type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">{issue.title}</Typography>
                      <Chip
                        label={issue.severity}
                        color={getSeverityColor(issue.severity)}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {issue.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Value: {issue.value.toFixed(2)} (Threshold: {issue.threshold})
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < issues.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <Box sx={{ p: spacing.lg, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Performance Monitoring
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time Core Web Vitals and performance metrics
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: spacing.lg }}>
        <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
          <Tab label="Core Web Vitals" />
          <Tab label="Performance Budgets" />
          <Tab label="Issues & Alerts" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ mt: spacing.lg }}>
        {selectedTab === 0 && <WebVitalsSection />}
        {selectedTab === 1 && <BudgetsSection />}
        {selectedTab === 2 && <IssuesSection />}
      </Box>
    </Box>
  );
};

export default PerformanceDashboard;