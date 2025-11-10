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
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Psychology,
  Chat,
  Analytics,
  Download,
  Refresh,
  DateRange,
} from '@mui/icons-material';
import { analytics } from '../services/analytics';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  moodLogs: number;
  chatbotInteractions: number;
  averageMood: number;
  retentionRate: number;
  topFeatures: Array<{ name: string; usage: number }>;
  userGrowth: Array<{ date: string; users: number }>;
  moodTrends: Array<{ date: string; average: number }>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: spacing.lg }}>{children}</Box>}
  </div>
);

const AnalyticsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<AnalyticsData>({
    totalUsers: 15420,
    activeUsers: 3240,
    moodLogs: 8750,
    chatbotInteractions: 12450,
    averageMood: 6.8,
    retentionRate: 78.5,
    topFeatures: [
      { name: 'Mood Logging', usage: 8750 },
      { name: 'Chatbot', usage: 12450 },
      { name: 'Memory Recording', usage: 3420 },
      { name: 'Meditation', usage: 2890 },
      { name: 'Analytics', usage: 2150 },
    ],
    userGrowth: [
      { date: '2024-01-01', users: 12000 },
      { date: '2024-01-08', users: 12800 },
      { date: '2024-01-15', users: 13500 },
      { date: '2024-01-22', users: 14200 },
      { date: '2024-01-29', users: 15420 },
    ],
    moodTrends: [
      { date: '2024-01-01', average: 6.2 },
      { date: '2024-01-08', average: 6.5 },
      { date: '2024-01-15', average: 6.7 },
      { date: '2024-01-22', average: 6.8 },
      { date: '2024-01-29', average: 6.8 },
    ],
  });

  useEffect(() => {
    analytics.page('Analytics Dashboard', {
      component: 'AnalyticsDashboard',
      tab: tabValue,
      timeRange,
    });
  }, [tabValue, timeRange]);

  const handleRefresh = async () => {
    setLoading(true);
    analytics.track('Analytics Data Refreshed', {
      component: 'AnalyticsDashboard',
      timeRange,
    });

    // Simulate API call
    setTimeout(() => {
      setData(prev => ({
        ...prev,
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 100 - 50),
        moodLogs: prev.moodLogs + Math.floor(Math.random() * 50),
        chatbotInteractions: prev.chatbotInteractions + Math.floor(Math.random() * 80),
      }));
      setLoading(false);
    }, 1500);
  };

  const handleExport = () => {
    analytics.track('Analytics Data Exported', {
      component: 'AnalyticsDashboard',
      timeRange,
      format: 'csv',
    });

    // Simulate export
    const csvContent = `Date,Users,Mood Average\n${data.userGrowth.map(row =>
      `${row.date},${row.users},-`
    ).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    change?: number;
    icon: React.ReactNode;
    color?: string;
  }> = ({ title, value, change, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            {change !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUp
                  sx={{
                    color: change >= 0 ? 'success.main' : 'error.main',
                    mr: 0.5,
                    fontSize: 16
                  }}
                />
                <Typography
                  variant="body2"
                  color={change >= 0 ? 'success.main' : 'error.main'}
                >
                  {change >= 0 ? '+' : ''}{change}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: `${color}.main`, fontSize: 40 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: spacing.lg, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Analytics Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive insights into user behavior and app performance
          </Typography>
        </Box>

        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="1d">Last 24h</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExport}
          >
            Export
          </Button>

          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Users"
            value={data.totalUsers}
            change={12.5}
            icon={<People />}
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Users"
            value={data.activeUsers}
            change={8.2}
            icon={<Analytics />}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Mood Logs"
            value={data.moodLogs}
            change={15.3}
            icon={<Psychology />}
            color="secondary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Chatbot Interactions"
            value={data.chatbotInteractions}
            change={22.1}
            icon={<Chat />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Secondary Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Mood Score
              </Typography>
              <Typography variant="h3" color="primary" gutterBottom>
                {data.averageMood}/10
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(data.averageMood / 10) * 100}
                sx={{ height: 8, borderRadius: borderRadius.xl, mb: spacing.sm }}
              />
              <Typography variant="body2" color="text.secondary">
                +2.1% from last period
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                User Retention
              </Typography>
              <Typography variant="h3" color="success.main" gutterBottom>
                {data.retentionRate}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={data.retentionRate}
                color="success"
                sx={{ height: 8, borderRadius: borderRadius.xl, mb: spacing.sm }}
              />
              <Typography variant="body2" color="text.secondary">
                7-day retention rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Feature Usage
              </Typography>
              <Box sx={{ mt: spacing.md }}>
                {data.topFeatures.slice(0, 3).map((feature, index) => (
                  <Box key={feature.name} sx={{ mb: spacing.sm }}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2">{feature.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.usage.toLocaleString()}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(feature.usage / data.topFeatures[0].usage) * 100}
                      sx={{ height: 4, borderRadius: borderRadius.md }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="User Growth" />
            <Tab label="Mood Trends" />
            <Tab label="Feature Usage" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Total Users</TableCell>
                  <TableCell align="right">Growth</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.userGrowth.map((row, index) => {
                  const prevUsers = index > 0 ? data.userGrowth[index - 1].users : row.users;
                  const growth = ((row.users - prevUsers) / prevUsers * 100).toFixed(1);
                  return (
                    <TableRow key={row.date}>
                      <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                      <TableCell align="right">{row.users.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${growth}%`}
                          color={parseFloat(growth) > 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Average Mood</TableCell>
                  <TableCell align="right">Trend</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.moodTrends.map((row, index) => {
                  const prevMood = index > 0 ? data.moodTrends[index - 1].average : row.average;
                  const trend = row.average - prevMood;
                  return (
                    <TableRow key={row.date}>
                      <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                      <TableCell align="right">{row.average.toFixed(1)}/10</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1)}
                          color={trend > 0 ? 'success' : trend < 0 ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Feature</TableCell>
                  <TableCell align="right">Usage Count</TableCell>
                  <TableCell align="right">Percentage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.topFeatures.map((feature) => {
                  const percentage = ((feature.usage / data.topFeatures.reduce((sum, f) => sum + f.usage, 0)) * 100).toFixed(1);
                  return (
                    <TableRow key={feature.name}>
                      <TableCell>{feature.name}</TableCell>
                      <TableCell align="right">{feature.usage.toLocaleString()}</TableCell>
                      <TableCell align="right">{percentage}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Card>

      {/* Privacy Notice */}
      <Alert severity="info" sx={{ mt: spacing.lg }}>
        <Typography variant="body2">
          All analytics data is collected and processed in compliance with GDPR and Swedish privacy regulations.
          User data is anonymized and aggregated for privacy protection.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AnalyticsDashboard;