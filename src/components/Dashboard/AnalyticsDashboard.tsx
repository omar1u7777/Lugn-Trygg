/**
 * Analytics Dashboard Component
 * Real-time analytics visualization and monitoring
 * Shows Mixpanel, Amplitude, and Firebase Analytics data
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  Event,
  Error as ErrorIcon,
  Speed,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { analytics } from '../../services/analytics';
import { colors, spacing } from '../../theme/tokens';

interface AnalyticsMetric {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

interface EventData {
  name: string;
  count: number;
  timestamp: string;
  properties?: Record<string, any>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: spacing.lg }}>{children}</Box>}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [recentEvents, setRecentEvents] = useState<EventData[]>([]);
  const [analyticsStatus, setAnalyticsStatus] = useState<{
    amplitude: 'connected' | 'error' | 'disabled';
    firebase: 'connected' | 'error' | 'disabled';
    sentry: 'connected' | 'error' | 'disabled';
  }>({
    amplitude: 'disabled',
    firebase: 'disabled',
    sentry: 'disabled',
  });

  useEffect(() => {
    loadAnalyticsDashboard();
  }, []);

  const loadAnalyticsDashboard = async () => {
    try {
      setLoading(true);

      // Simulate loading analytics data
      // In production, this would fetch from Mixpanel/Amplitude APIs
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock metrics data
      const mockMetrics: AnalyticsMetric[] = [
        {
          label: 'Total Events Today',
          value: 1247,
          change: 12.5,
          trend: 'up',
          icon: <Event />,
          color: colors.primary.main,
        },
        {
          label: 'Active Users',
          value: 342,
          change: -3.2,
          trend: 'down',
          icon: <People />,
          color: colors.mood.happy,
        },
        {
          label: 'Mood Logs',
          value: 89,
          change: 8.1,
          trend: 'up',
          icon: <TrendingUp />,
          color: colors.mood.content,
        },
        {
          label: 'Avg Response Time',
          value: '234ms',
          change: -15.3,
          trend: 'up',
          icon: <Speed />,
          color: colors.mood.ecstatic,
        },
        {
          label: 'Error Rate',
          value: '0.3%',
          change: -45.2,
          trend: 'up',
          icon: <CheckCircle />,
          color: colors.success.main,
        },
        {
          label: 'Critical Alerts',
          value: 0,
          change: -100,
          trend: 'up',
          icon: <Warning />,
          color: colors.warning.main,
        },
      ];

      // Mock recent events
      const mockEvents: EventData[] = [
        {
          name: 'Mood Logged',
          count: 89,
          timestamp: new Date().toISOString(),
          properties: { mood_category: 'positive' },
        },
        {
          name: 'Page Viewed',
          count: 234,
          timestamp: new Date().toISOString(),
          properties: { page: 'Dashboard' },
        },
        {
          name: 'Chatbot Interaction',
          count: 45,
          timestamp: new Date().toISOString(),
          properties: { success: true },
        },
        {
          name: 'Feature Used',
          count: 67,
          timestamp: new Date().toISOString(),
          properties: { feature: 'weekly_analysis' },
        },
        {
          name: 'API Call',
          count: 456,
          timestamp: new Date().toISOString(),
          properties: { status: 200, avg_duration: 234 },
        },
      ];

      setMetrics(mockMetrics);
      setRecentEvents(mockEvents);

      // Check analytics status
      setAnalyticsStatus({
        amplitude: 'disabled', // Would check actual connection
        firebase: 'disabled',
        sentry: 'disabled',
      });

      // Track dashboard view
      analytics.page('Analytics Dashboard', {
        timestamp: new Date().toISOString(),
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to load analytics dashboard:', error);
      setLoading(false);
    }
  };

  const testAnalyticsTracking = () => {
    // Test all analytics functions
    analytics.track('Test Event', {
      test_id: Date.now(),
      source: 'analytics_dashboard',
    });

    analytics.business.moodLogged(8, {
      test: true,
      timestamp: new Date().toISOString(),
    });

    analytics.performance({
      name: 'Dashboard Load Test',
      value: 123,
      unit: 'ms',
      category: 'test',
    });

    alert('✅ Test events sent! Check browser console for tracking logs.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return colors.success.main;
      case 'error':
        return colors.error.main;
      default:
        return colors.mood.neutral;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      default:
        return 'Disabled';
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: spacing.xl }}>
      {/* Header */}
      <Box sx={{ mb: spacing.xl }}>
        <Typography variant="h4" sx={{ mb: spacing.md, fontWeight: 600 }}>
          📊 Analytics Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: spacing.lg }}>
          Real-time analytics monitoring and event tracking
        </Typography>

        {/* Analytics Status */}
        <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.lg }}>
          <Chip
            label={`Amplitude: ${getStatusLabel(analyticsStatus.amplitude)}`}
            size="small"
            sx={{
              bgcolor: getStatusColor(analyticsStatus.amplitude),
              color: colors.text.inverse,
            }}
          />
          <Chip
            label={`Firebase: ${getStatusLabel(analyticsStatus.firebase)}`}
            size="small"
            sx={{
              bgcolor: getStatusColor(analyticsStatus.firebase),
              color: colors.text.inverse,
            }}
          />
          <Chip
            label={`Sentry: ${getStatusLabel(analyticsStatus.sentry)}`}
            size="small"
            sx={{
              bgcolor: getStatusColor(analyticsStatus.sentry),
              color: colors.text.inverse,
            }}
          />
        </Box>

        <Alert severity="info" sx={{ mb: spacing.lg }}>
          ℹ️ Analytics providers are currently disabled in development. Configure API
          keys in .env to enable tracking.
        </Alert>

        <Button
          variant="contained"
          onClick={testAnalyticsTracking}
          sx={{ mb: spacing.lg }}
        >
          🧪 Test Analytics Tracking
        </Button>
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: spacing.xl }}>
        {metrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: spacing.md,
                  }}
                >
                  <Box
                    sx={{
                      color: metric.color,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {metric.icon}
                  </Box>
                  {metric.change !== undefined && (
                    <Chip
                      label={`${metric.change > 0 ? '+' : ''}${metric.change}%`}
                      size="small"
                      color={metric.trend === 'up' ? 'success' : 'error'}
                      icon={
                        metric.trend === 'up' ? <TrendingUp /> : <TrendingDown />
                      }
                    />
                  )}
                </Box>
                <Typography variant="h4" sx={{ mb: spacing.sm, fontWeight: 700 }}>
                  {metric.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metric.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            aria-label="analytics tabs"
          >
            <Tab label="Recent Events" />
            <Tab label="Performance" />
            <Tab label="Errors" />
            <Tab label="Configuration" />
          </Tabs>
        </Box>

        {/* Recent Events Tab */}
        <TabPanel value={currentTab} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Event Name</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Properties</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentEvents.map((event, index) => (
                  <TableRow key={index}>
                    <TableCell>{event.name}</TableCell>
                    <TableCell align="right">{event.count}</TableCell>
                    <TableCell>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <code style={{ fontSize: '0.8em' }}>
                        {JSON.stringify(event.properties)}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value={currentTab} index={1}>
          <Typography variant="h6" sx={{ mb: spacing.lg }}>
            Performance Metrics
          </Typography>
          <Box sx={{ mb: spacing.lg }}>
            <Typography variant="body2" sx={{ mb: spacing.sm }}>
              Page Load Time
            </Typography>
            <LinearProgress
              variant="determinate"
              value={75}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              1.2s (Target: &lt;3s)
            </Typography>
          </Box>
          <Box sx={{ mb: spacing.lg }}>
            <Typography variant="body2" sx={{ mb: spacing.sm }}>
              API Response Time
            </Typography>
            <LinearProgress
              variant="determinate"
              value={90}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              234ms (Target: &lt;500ms)
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ mb: spacing.sm }}>
              First Contentful Paint (FCP)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={85}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              0.8s (Target: &lt;1.8s)
            </Typography>
          </Box>
        </TabPanel>

        {/* Errors Tab */}
        <TabPanel value={currentTab} index={2}>
          <Alert severity="success" icon={<CheckCircle />}>
            ✅ No critical errors detected in the last 24 hours
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mt: spacing.lg }}>
            Error tracking is monitored through Sentry. Configure Sentry DSN in .env
            to enable real-time error monitoring.
          </Typography>
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={currentTab} index={3}>
          <Typography variant="h6" sx={{ mb: spacing.lg }}>
            Analytics Configuration
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Provider</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Configuration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>Amplitude</strong>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(analyticsStatus.amplitude)}
                      size="small"
                      color={
                        analyticsStatus.amplitude === 'connected'
                          ? 'success'
                          : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <code>VITE_AMPLITUDE_API_KEY</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Firebase Analytics</strong>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(analyticsStatus.firebase)}
                      size="small"
                      color={
                        analyticsStatus.firebase === 'connected'
                          ? 'success'
                          : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <code>VITE_FIREBASE_MEASUREMENT_ID</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Sentry</strong>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(analyticsStatus.sentry)}
                      size="small"
                      color={
                        analyticsStatus.sentry === 'connected' ? 'success' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <code>VITE_SENTRY_DSN</code>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="warning" sx={{ mt: spacing.lg }}>
            <Typography variant="body2" sx={{ mb: spacing.sm }}>
              <strong>Setup Instructions:</strong>
            </Typography>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Create accounts on Amplitude, Firebase, and Sentry</li>
              <li>Get API keys/tokens from each platform</li>
              <li>Add keys to .env file</li>
              <li>Restart development server</li>
              <li>Verify connection in this dashboard</li>
            </ol>
          </Alert>
        </TabPanel>
      </Card>
    </Box>
  );
}
