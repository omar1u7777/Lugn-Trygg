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
      await new Promise<void>((resolve) => {
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

          announceToScreenReader('Dashboard data loaded successfully', 'polite');
          resolve();
        }, 1000);
      });

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      announceToScreenReader('Failed to load dashboard data', 'assertive');
    } finally {
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
    <Box
      sx={{
        minHeight: "100vh",
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)"
            : "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #faf5ff 100%)",
      }}
    >
      {/* Hero Section */}
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "primary.contrastText",
          py: 8,
        }}
      >
        <Box
          sx={{
            maxWidth: "1200px",
            mx: "auto",
            textAlign: "center",
            px: 2,
          }}
        >
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            Välkommen tillbaka! 👋
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9 }}>
            Hur känns det idag?
          </Typography>
        </Box>
      </Box>

      {/* Quick Actions Row */}
      <Box
        sx={{
          maxWidth: "1200px",
          mx: "auto",
          px: 2,
          py: 4,
        }}
      >
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {/* Mood Logger Card */}
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: "100%",
                cursor: "pointer",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: 6,
                  "& .emoji": {
                    transform: "scale(1.1)",
                  },
                },
              }}
            >
              <CardContent sx={{ p: 4, textAlign: "center" }}>
                <Box
                  className="emoji"
                  sx={{
                    fontSize: "4rem",
                    mb: 2,
                    transition: "transform 0.3s ease",
                  }}
                >
                  😊
                </Box>
                <Typography variant="h6" fontWeight="semibold" gutterBottom>
                  Logga Humör
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Snabbloggning med röst eller emoji
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* AI Chat Card */}
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: "100%",
                cursor: "pointer",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: 6,
                  "& .emoji": {
                    transform: "scale(1.1)",
                  },
                },
              }}
            >
              <CardContent sx={{ p: 4, textAlign: "center" }}>
                <Box
                  className="emoji"
                  sx={{
                    fontSize: "4rem",
                    mb: 2,
                    transition: "transform 0.3s ease",
                  }}
                >
                  🤖
                </Box>
                <Typography variant="h6" fontWeight="semibold" gutterBottom>
                  AI Terapeut
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prata med din personliga AI
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Daily Check-in Card */}
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: "100%",
                cursor: "pointer",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: 6,
                  "& .emoji": {
                    transform: "scale(1.1)",
                  },
                },
              }}
            >
              <CardContent sx={{ p: 4, textAlign: "center" }}>
                <Box
                  className="emoji"
                  sx={{
                    fontSize: "4rem",
                    mb: 2,
                    transition: "transform 0.3s ease",
                  }}
                >
                  📊
                </Box>
                <Typography variant="h6" fontWeight="semibold" gutterBottom>
                  Daglig Översikt
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Se dina framsteg och insikter
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Today's Insights */}
        <Grid container spacing={4}>
          {/* Mood Trend */}
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Din Humörtrend
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Favorite sx={{ color: "success.main", fontSize: 40 }} />
                  <Box>
                    <Typography variant="h5">
                      {stats.averageMood}/10
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Trend uppåt
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* AI Insights */}
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  AI Insikter
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Analytics sx={{ color: "info.main", fontSize: 40 }} />
                  <Box>
                    <Typography variant="h5">
                      {stats.totalMoods + stats.totalChats}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Totala interaktioner
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Weekly Progress */}
        <Card sx={{ mt: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Veckoprogress
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">
                  {stats.weeklyProgress} / {stats.weeklyGoal} inlägg
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round((stats.weeklyProgress / stats.weeklyGoal) * 100)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(stats.weeklyProgress / stats.weeklyGoal) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            {stats.weeklyProgress >= stats.weeklyGoal ? (
              <Alert severity="success">
                🎉 Veckomål uppnått! Fortsätt det goda arbetet.
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {stats.weeklyGoal - stats.weeklyProgress} inlägg kvar denna vecka
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;
