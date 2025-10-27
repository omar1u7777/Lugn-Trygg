import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Error,
  CheckCircle,
  Warning,
  Info,
  Refresh,
  Analytics,
  Security,
  Speed,
} from '@mui/icons-material';
import { analytics } from '../services/analytics';

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
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 99.9,
    responseTime: 245,
    errorRate: 0.1,
    activeUsers: 1247,
    performanceScore: 92,
    securityIncidents: 0,
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: '1',
      type: 'warning',
      title: 'High Response Time',
      message: 'API response time exceeded 300ms threshold',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      resolved: false,
    },
    {
      id: '2',
      type: 'info',
      title: 'New Feature Deployed',
      message: 'Mood tracking enhancement deployed successfully',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      resolved: true,
    },
  ]);

  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    analytics.page('Monitoring Dashboard', {
      component: 'MonitoringDashboard',
    });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    analytics.track('Monitoring Data Refreshed', {
      component: 'MonitoringDashboard',
    });

    // Simulate API call
    setTimeout(() => {
      setMetrics(prev => ({
        ...prev,
        responseTime: Math.random() * 100 + 200, // Random between 200-300ms
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 20 - 10),
      }));
      setRefreshing(false);
    }, 1000);
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'success';
    if (value >= thresholds.warning) return 'warning';
    return 'error';
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'error': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
      case 'info': return <Info color="info" />;
      default: return <Info />;
    }
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
    status?: 'success' | 'warning' | 'error';
    icon: React.ReactNode;
  }> = ({ title, value, unit, trend, status = 'success', icon }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {icon}
            <Typography variant="h6" color="text.secondary">
              {title}
            </Typography>
          </Box>
          {trend && (
            trend === 'up' ? <TrendingUp color="success" /> :
            trend === 'down' ? <TrendingDown color="error" /> :
            <Box sx={{ width: 20, height: 20 }} />
          )}
        </Box>

        <Typography variant="h4" component="div" gutterBottom>
          {value}{unit}
        </Typography>

        <Chip
          label={status === 'success' ? 'Good' : status === 'warning' ? 'Warning' : 'Critical'}
          color={status}
          size="small"
        />
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            System Monitoring
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time health metrics and system status
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

      {/* Metrics Grid */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="System Uptime"
            value={metrics.uptime}
            unit="%"
            status={getStatusColor(metrics.uptime, { good: 99.5, warning: 99 })}
            icon={<CheckCircle />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Response Time"
            value={metrics.responseTime}
            unit="ms"
            trend={metrics.responseTime < 250 ? 'up' : 'down'}
            status={getStatusColor(300 - metrics.responseTime, { good: 50, warning: 20 })}
            icon={<Speed />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Error Rate"
            value={metrics.errorRate}
            unit="%"
            status={getStatusColor(1 - metrics.errorRate, { good: 0.95, warning: 0.98 })}
            icon={<Error />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Active Users"
            value={metrics.activeUsers.toLocaleString()}
            trend="up"
            status="success"
            icon={<Analytics />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Performance Score"
            value={metrics.performanceScore}
            unit="/100"
            status={getStatusColor(metrics.performanceScore, { good: 90, warning: 80 })}
            icon={<TrendingUp />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Security Incidents"
            value={metrics.securityIncidents}
            status={metrics.securityIncidents === 0 ? 'success' : 'error'}
            icon={<Security />}
          />
        </Grid>
      </Grid>

      {/* Performance Score Visualization */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Performance Score Breakdown
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Lighthouse Score</Typography>
              <Typography variant="body2">{metrics.performanceScore}/100</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={metrics.performanceScore}
              color={metrics.performanceScore >= 90 ? 'success' : metrics.performanceScore >= 80 ? 'warning' : 'error'}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              System Alerts
            </Typography>
            <Chip
              label={`${alerts.filter(a => !a.resolved).length} Active`}
              color={alerts.filter(a => !a.resolved).length > 0 ? 'warning' : 'success'}
              size="small"
            />
          </Box>

          <List>
            {alerts.map((alert, index) => (
              <React.Fragment key={alert.id}>
                <ListItem
                  button
                  onClick={() => setSelectedAlert(alert)}
                  sx={{
                    bgcolor: alert.resolved ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                  }}
                >
                  <ListItemIcon>
                    {getStatusIcon(alert.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={alert.title}
                    secondary={`${alert.message} • ${alert.timestamp.toLocaleString()}`}
                  />
                  <Chip
                    label={alert.resolved ? 'Resolved' : 'Active'}
                    color={alert.resolved ? 'success' : 'warning'}
                    size="small"
                  />
                </ListItem>
                {index < alerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedAlert?.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            {selectedAlert?.message}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Timestamp: {selectedAlert?.timestamp.toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Status: {selectedAlert?.resolved ? 'Resolved' : 'Active'}
          </Typography>
        </DialogContent>
        <DialogActions>
          {!selectedAlert?.resolved && (
            <Button
              onClick={() => {
                if (selectedAlert) {
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
                }
              }}
              color="primary"
            >
              Mark as Resolved
            </Button>
          )}
          <Button onClick={() => setSelectedAlert(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonitoringDashboard;