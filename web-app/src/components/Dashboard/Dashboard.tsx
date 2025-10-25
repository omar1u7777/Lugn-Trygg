import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Mood,
  Chat,
  TrendingUp,
  AccessTime,
  Psychology,
  Favorite,
  Analytics,
  Refresh,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../../hooks/useAccessibility';
import { analytics } from '../../services/analytics';
import { LoadingSpinner } from '../LoadingStates';
import ErrorBoundary from '../ErrorBoundary';

// Lazy load heavy components
const MoodChart = lazy(() => import('./MoodChart'));
const MemoryChart = lazy(() => import('./MemoryChart'));
const AnalyticsWidget = lazy(() => import('./AnalyticsWidget'));

interface DashboardProps {
  userId?: string;
}

interface DashboardStats {
  totalMoods: number;
  totalChats: number;
  averageMood: number;
  streakDays: number;
  weeklyGoal: number;
  weeklyProgress: number;
  recentActivity: Array<{
    id: string;
    type: 'mood' | 'chat' | 'meditation';
    timestamp: Date;
    description: string;
  }>;
}

const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const [stats, setStats] = useState<DashboardStats>({
    totalMoods: 0,
    totalChats: 0,
    averageMood: 0,
    streakDays: 0,
    weeklyGoal: 7,
    weeklyProgress: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    analytics.page('Dashboard', {
      component: 'Dashboard',
      userId,
    });

    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Simulate API call - replace with actual API calls
      setTimeout(() => {
        setStats({
          totalMoods: 45,
          totalChats: 23,
          averageMood: 7.2,
          streakDays: 5,
          weeklyGoal: 7,
          weeklyProgress: 5,
          recentActivity: [
            {
              id: '1',
              type: 'mood',
              timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
              description: 'Logged mood: Glad (8/10)',
            },
            {
              id: '2',
              type: 'chat',
              timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
              description: 'Chat session with AI therapist',
            },
            {
              id: '3',
              type: 'meditation',
              timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
              description: 'Completed 10-minute meditation',
            },
          ],
        });

        setLoading(false);
        announceToScreenReader('Dashboard data loaded successfully', 'polite');
      }, 1000);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      announceToScreenReader('Failed to load dashboard data', 'assertive');
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    analytics.track('Dashboard Refreshed', {
      component: 'Dashboard',
      userId,
    });
    loadDashboardData();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    announceToScreenReader(`Switched to ${newValue === 0 ? 'Overview' : 'Activity'} tab`, 'polite');
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
    ariaLabel?: string;
  }> = ({ title, value, icon, color = 'primary', ariaLabel }) => (
    <Card
      sx={{ height: '100%' }}
      role="region"
      aria-labelledby={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography
              id={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
              variant="h6"
              color="text.secondary"
              gutterBottom
            >
              {title}
            </Typography>
            <Typography
              variant="h4"
              component="div"
              aria-label={ariaLabel || `${title}: ${value}`}
            >
              {value}
            </Typography>
          </Box>
          <Box sx={{ color: `${color}.main`, fontSize: 40 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Loading dashboard...
        </Typography>
        <LinearProgress aria-label="Loading dashboard data" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Skip Links */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-500 text-white px-4 py-2 rounded z-50"
      >
        {t('accessibility.skipToMain', 'Skip to main content')}
      </a>

      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        role="banner"
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {t('dashboard.title', 'Your Mental Health Dashboard')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.subtitle', 'Track your progress and maintain your well-being')}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          aria-label={t('dashboard.refresh', 'Refresh dashboard data')}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} mb={4} id="main-content" role="main" aria-labelledby="stats-heading">
        <Typography id="stats-heading" variant="h2" className="sr-only">
          {t('dashboard.stats', 'Dashboard Statistics')}
        </Typography>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalMoods', 'Total Moods')}
            value={stats.totalMoods}
            icon={<Mood />}
            color="primary"
            ariaLabel={`${stats.totalMoods} mood entries logged`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalChats', 'AI Conversations')}
            value={stats.totalChats}
            icon={<Chat />}
            color="secondary"
            ariaLabel={`${stats.totalChats} conversations with AI therapist`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.averageMood', 'Average Mood')}
            value={`${stats.averageMood}/10`}
            icon={<Psychology />}
            color="success"
            ariaLabel={`Average mood score of ${stats.averageMood} out of 10`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.streak', 'Current Streak')}
            value={`${stats.streakDays} ${t('common.days', 'days')}`}
            icon={<TrendingUp />}
            color="warning"
            ariaLabel={`${stats.streakDays} consecutive days of activity`}
          />
        </Grid>
      </Grid>

      {/* Weekly Progress */}
      <Card sx={{ mb: 4 }} role="region" aria-labelledby="weekly-progress-title">
        <CardContent>
          <Typography
            id="weekly-progress-title"
            variant="h6"
            gutterBottom
          >
            {t('dashboard.weeklyProgress', 'Weekly Progress')}
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">
                {stats.weeklyProgress} / {stats.weeklyGoal} {t('dashboard.entries', 'entries')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.round((stats.weeklyProgress / stats.weeklyGoal) * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(stats.weeklyProgress / stats.weeklyGoal) * 100}
              sx={{ height: 8, borderRadius: 4 }}
              aria-label={`${stats.weeklyProgress} of ${stats.weeklyGoal} weekly entries completed`}
              aria-valuenow={stats.weeklyProgress}
              aria-valuemin={0}
              aria-valuemax={stats.weeklyGoal}
            />
          </Box>

          {stats.weeklyProgress >= stats.weeklyGoal ? (
            <Alert severity="success" aria-live="polite">
              <span aria-hidden="true">🎉</span> {t('dashboard.goalAchieved', 'Weekly goal achieved! Keep up the great work.')}
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {stats.weeklyGoal - stats.weeklyProgress} {t('dashboard.entriesLeft', 'entries left this week')}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label={t('dashboard.tabs', 'Dashboard sections')}
          >
            <Tab
              label={t('dashboard.overview', 'Overview')}
              aria-controls="dashboard-overview-panel"
              id="dashboard-overview-tab"
            />
            <Tab
              label={t('dashboard.activity', 'Recent Activity')}
              aria-controls="dashboard-activity-panel"
              id="dashboard-activity-tab"
            />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <Box
          role="tabpanel"
          id="dashboard-overview-panel"
          aria-labelledby="dashboard-overview-tab"
          hidden={activeTab !== 0}
          sx={{ p: 3 }}
        >
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner isLoading={true} message="Laddar diagram..." />}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card role="region" aria-labelledby="mood-trend-title">
                    <CardContent>
                      <Typography id="mood-trend-title" variant="h6" gutterBottom>
                        {t('dashboard.moodTrend', 'Mood Trend')}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Favorite sx={{ color: 'success.main' }} aria-hidden="true" />
                        <Box>
                          <Typography variant="h5" aria-label={`Current mood score: ${stats.averageMood} out of 10`}>
                            {stats.averageMood}/10
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('dashboard.trendingUp', 'Trending upward')}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card role="region" aria-labelledby="engagement-title">
                    <CardContent>
                      <Typography id="engagement-title" variant="h6" gutterBottom>
                        {t('dashboard.engagement', 'Engagement')}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Analytics sx={{ color: 'info.main' }} aria-hidden="true" />
                        <Box>
                          <Typography variant="h5" aria-label={`Total interactions: ${stats.totalMoods + stats.totalChats}`}>
                            {stats.totalMoods + stats.totalChats}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('dashboard.totalInteractions', 'Total interactions')}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Lazy loaded charts */}
                <Grid item xs={12} md={6}>
                  <MoodChart />
                </Grid>

                <Grid item xs={12} md={6}>
                  <MemoryChart />
                </Grid>

                {/* Analytics Widget */}
                {userId && (
                  <Grid item xs={12}>
                    <AnalyticsWidget userId={userId} />
                  </Grid>
                )}
              </Grid>
            </Suspense>
          </ErrorBoundary>
        </Box>

        {/* Activity Tab */}
        <Box
          role="tabpanel"
          id="dashboard-activity-panel"
          aria-labelledby="dashboard-activity-tab"
          hidden={activeTab !== 1}
          sx={{ p: 3 }}
        >
          <Typography variant="h6" gutterBottom>
            {t('dashboard.recentActivity', 'Recent Activity')}
          </Typography>

          {stats.recentActivity.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.noActivity', 'No recent activity')}
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} role="list" aria-label={t('dashboard.recentActivity', 'Recent Activity')}>
              {stats.recentActivity.map((activity) => (
                <Box
                  key={activity.id}
                  component="li"
                  sx={{
                    py: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 0 },
                  }}
                  role="listitem"
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box sx={{ minWidth: 40 }}>
                      {activity.type === 'mood' && <Mood sx={{ color: 'primary.main' }} aria-hidden="true" />}
                      {activity.type === 'chat' && <Chat sx={{ color: 'secondary.main' }} aria-hidden="true" />}
                      {activity.type === 'meditation' && <Psychology sx={{ color: 'success.main' }} aria-hidden="true" />}
                    </Box>

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1">
                        {activity.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" aria-label={`Activity timestamp: ${activity.timestamp.toLocaleString()}`}>
                        {activity.timestamp.toLocaleString()}
                      </Typography>
                    </Box>

                    <Chip
                      label={activity.type}
                      size="small"
                      color={
                        activity.type === 'mood' ? 'primary' :
                        activity.type === 'chat' ? 'secondary' : 'success'
                      }
                      aria-label={`${activity.type} activity`}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Card>
    </Box>
  );
};

export default Dashboard;
