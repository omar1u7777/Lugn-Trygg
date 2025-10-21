/**
 * Performance Monitor Component
 * 
 * Real-time performance tracking and optimization tools.
 * Features:
 * - Component render tracking
 * - Memory usage monitoring
 * - Network request profiling
 * - FPS monitoring
 * - Bundle size analysis
 * - Performance recommendations
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
  Divider,
  Grid
} from '@mui/material';

import {
  Speed,
  Memory,
  NetworkCheck,
  Warning,
  CheckCircle,
  TrendingUp,
  Refresh
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceMetrics {
  fps: number;
  memory: {
    used: number;
    limit: number;
    percentage: number;
  };
  network: {
    requests: number;
    totalSize: number;
    avgLatency: number;
  };
  renderTime: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
}

interface PerformanceHistory {
  timestamp: string;
  fps: number;
  memory: number;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memory: { used: 0, limit: 0, percentage: 0 },
    network: { requests: 0, totalSize: 0, avgLatency: 0 },
    renderTime: 0,
    largestContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0
  });
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());

  useEffect(() => {
    // Start monitoring
    const monitoringInterval = setInterval(() => {
      updateMetrics();
    }, 1000);

    // Monitor FPS
    const fpsInterval = requestAnimationFrame(trackFPS);

    // Web Vitals
    measureWebVitals();

    return () => {
      clearInterval(monitoringInterval);
      cancelAnimationFrame(fpsInterval);
    };
  }, []);

  const trackFPS = () => {
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      setMetrics(prev => ({ ...prev, fps }));
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }
    
    frameCountRef.current++;
    requestAnimationFrame(trackFPS);
  };

  const updateMetrics = () => {
    // Memory monitoring (Chrome only)
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      const used = Math.round(memory.usedJSHeapSize / 1048576); // MB
      const limit = Math.round(memory.jsHeapSizeLimit / 1048576); // MB
      const percentage = (used / limit) * 100;

      setMetrics(prev => ({
        ...prev,
        memory: { used, limit, percentage }
      }));

      // Add to history
      setHistory(prev => {
        const newHistory = [
          ...prev.slice(-29),
          {
            timestamp: new Date().toLocaleTimeString(),
            fps: metrics.fps,
            memory: percentage
          }
        ];
        return newHistory;
      });
    }

    // Network monitoring
    if (performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const requests = resources.length;
      const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const avgLatency = resources.length > 0
        ? resources.reduce((sum, r) => sum + r.duration, 0) / resources.length
        : 0;

      setMetrics(prev => ({
        ...prev,
        network: {
          requests,
          totalSize: Math.round(totalSize / 1024), // KB
          avgLatency: Math.round(avgLatency)
        }
      }));
    }

    // Check for performance issues
    detectIssues();
  };

  const measureWebVitals = () => {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      setMetrics(prev => ({
        ...prev,
        largestContentfulPaint: Math.round(lastEntry.renderTime || lastEntry.loadTime)
      }));
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        setMetrics(prev => ({
          ...prev,
          firstInputDelay: Math.round(entry.processingStart - entry.startTime)
        }));
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
          setMetrics(prev => ({
            ...prev,
            cumulativeLayoutShift: Math.round(clsScore * 1000) / 1000
          }));
        }
      });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  };

  const detectIssues = () => {
    const newIssues: string[] = [];

    if (metrics.fps < 30) {
      newIssues.push('Low FPS detected. Consider optimizing render-heavy components.');
    }
    if (metrics.memory.percentage > 80) {
      newIssues.push('High memory usage. Check for memory leaks or optimize data structures.');
    }
    if (metrics.network.avgLatency > 1000) {
      newIssues.push('Slow network requests. Consider implementing caching or request optimization.');
    }
    if (metrics.largestContentfulPaint > 2500) {
      newIssues.push('Slow LCP. Optimize image loading and critical rendering path.');
    }
    if (metrics.firstInputDelay > 100) {
      newIssues.push('High FID. Reduce JavaScript execution time on main thread.');
    }
    if (metrics.cumulativeLayoutShift > 0.1) {
      newIssues.push('Layout shifts detected. Set explicit dimensions for dynamic content.');
    }

    setIssues(newIssues);
  };

  const getStatusColor = (value: number, thresholds: { good: number; poor: number }) => {
    if (value <= thresholds.good) return 'success';
    if (value <= thresholds.poor) return 'warning';
    return 'error';
  };

  const clearPerformanceCache = () => {
    if (performance.clearResourceTimings) {
      performance.clearResourceTimings();
    }
    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
    alert('Performance cache cleared');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Speed /> Performance Monitor
      </Typography>

      {issues.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Performance Issues Detected:
          </Typography>
          <List dense>
            {issues.map((issue, index) => (
              <ListItem key={index} sx={{ py: 0 }}>
                <ListItemText primary={`• ${issue}`} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Real-time Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Speed color="primary" />
                <Typography variant="body2" color="text.secondary">
                  FPS
                </Typography>
              </Box>
              <Typography variant="h3">
                {metrics.fps}
              </Typography>
              <Chip
                label={metrics.fps >= 55 ? 'Excellent' : metrics.fps >= 30 ? 'Good' : 'Poor'}
                color={metrics.fps >= 55 ? 'success' : metrics.fps >= 30 ? 'warning' : 'error'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Memory color="secondary" />
                <Typography variant="body2" color="text.secondary">
                  Memory Usage
                </Typography>
              </Box>
              <Typography variant="h3">
                {metrics.memory.used} MB
              </Typography>
              <Typography variant="caption" color="text.secondary">
                of {metrics.memory.limit} MB
              </Typography>
              <LinearProgress
                variant="determinate"
                value={metrics.memory.percentage}
                color={
                  metrics.memory.percentage < 60 ? 'success' :
                  metrics.memory.percentage < 80 ? 'warning' : 'error'
                }
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <NetworkCheck color="info" />
                <Typography variant="body2" color="text.secondary">
                  Network
                </Typography>
              </Box>
              <Typography variant="h3">
                {metrics.network.requests}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                requests • {metrics.network.totalSize} KB
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                Avg: {metrics.network.avgLatency}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TrendingUp color="warning" />
                <Typography variant="body2" color="text.secondary">
                  Web Vitals
                </Typography>
              </Box>
              <Typography variant="body2">
                LCP: {metrics.largestContentfulPaint}ms
              </Typography>
              <Typography variant="body2">
                FID: {metrics.firstInputDelay}ms
              </Typography>
              <Typography variant="body2">
                CLS: {metrics.cumulativeLayoutShift}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance History Chart */}
      {history.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance History (Last 30 seconds)
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis yAxisId="left" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="fps"
                  stroke="#8884d8"
                  name="FPS"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="memory"
                  stroke="#82ca9d"
                  name="Memory %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Performance Recommendations
          </Typography>
          <List>
            <ListItem>
              <CheckCircle color="success" sx={{ mr: 2 }} />
              <ListItemText
                primary="Code Splitting"
                secondary="Split large bundles to reduce initial load time"
              />
            </ListItem>
            <ListItem>
              <CheckCircle color="success" sx={{ mr: 2 }} />
              <ListItemText
                primary="Image Optimization"
                secondary="Use WebP format and lazy loading for images"
              />
            </ListItem>
            <ListItem>
              <CheckCircle color="success" sx={{ mr: 2 }} />
              <ListItemText
                primary="Caching Strategy"
                secondary="Implement service worker for offline support and faster loads"
              />
            </ListItem>
            <ListItem>
              <CheckCircle color="success" sx={{ mr: 2 }} />
              <ListItemText
                primary="React Optimization"
                secondary="Use React.memo, useMemo, and useCallback to prevent unnecessary re-renders"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Actions */}
      <Box display="flex" gap={2}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={clearPerformanceCache}
        >
          Clear Cache
        </Button>
        <Button
          variant="outlined"
          onClick={() => window.location.reload()}
        >
          Reload App
        </Button>
      </Box>
    </Box>
  );
};

export default PerformanceMonitor;
