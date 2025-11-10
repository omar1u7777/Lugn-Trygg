import React, { useEffect, useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Button,
  Grid
} from '@mui/material';

import {
  Speed,
  Error as ErrorIcon,
  Refresh,
  TrendingUp
} from '@mui/icons-material';
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

interface PerformanceMetrics {
  endpoints: Record<string, {
    count: number;
    avg_duration: number;
    min_duration: number;
    max_duration: number;
    p95_duration: number;
  }>;
  total_requests: number;
  error_counts: Record<string, number>;
  slow_requests_count: number;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/performance-metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMetrics(data);
    } catch (e) {
      console.error('Failed to fetch performance metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPerformanceColor = (duration: number) => {
    if (duration < 0.3) return 'success';
    if (duration < 1.0) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ maxWidth: 1000, margin: '16px auto' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.lg }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <Speed color="primary" />
            Performance Monitor
          </Typography>
          <Button startIcon={<Refresh />} onClick={fetchMetrics} disabled={loading}>
            Refresh
          </Button>
        </Box>

        {loading && <LinearProgress sx={{ mb: spacing.md }} />}

        {metrics && !loading && (
          <>
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: spacing.lg }}>
              <Grid xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h4" color="primary">
                      {metrics.total_requests}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Requests
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h4" color="warning.main">
                      {metrics.slow_requests_count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Slow Requests (&gt;1s)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h4" color="error">
                      {Object.keys(metrics.error_counts).length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Error Types
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Endpoint Performance */}
            <Typography variant="h6" gutterBottom>
              Endpoint Performance
            </Typography>
            <List>
              {Object.entries(metrics.endpoints).map(([endpoint, stats]) => (
                <ListItem key={endpoint} divider>
                  <ListItemIcon>
                    <Speed color={getPerformanceColor(stats.avg_duration)} />
                  </ListItemIcon>
                  <ListItemText
                    primary={endpoint}
                    secondary={
                      <Box>
                        <Typography variant="caption">
                          Avg: {stats.avg_duration.toFixed(3)}s | 
                          P95: {stats.p95_duration.toFixed(3)}s | 
                          Count: {stats.count}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((stats.avg_duration / 2) * 100, 100)}
                          color={getPerformanceColor(stats.avg_duration)}
                          sx={{ mt: spacing.sm }}
                        />
                      </Box>
                    }
                  />
                  <Chip
                    label={`${stats.avg_duration.toFixed(2)}s`}
                    color={getPerformanceColor(stats.avg_duration)}
                    size="small"
                  />
                </ListItem>
              ))}
            </List>

            {/* Errors */}
            {Object.keys(metrics.error_counts).length > 0 && (
              <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: spacing.lg }}>
                <Typography variant="subtitle2" gutterBottom>
                  Error Summary
                </Typography>
                {Object.entries(metrics.error_counts).map(([error, count]) => (
                  <Typography key={error} variant="body2">
                    • {error}: {count} occurrences
                  </Typography>
                ))}
              </Alert>
            )}

            {/* Recommendations */}
            <Alert severity="info" icon={<TrendingUp />} sx={{ mt: spacing.md }}>
              <Typography variant="subtitle2" gutterBottom>
                Optimization Recommendations
              </Typography>
              <Typography variant="body2">
                • Enable caching for frequently accessed data<br />
                • Optimize slow endpoints (&gt;1s)<br />
                • Add database indexes for common queries<br />
                • Consider CDN for static assets
              </Typography>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;
