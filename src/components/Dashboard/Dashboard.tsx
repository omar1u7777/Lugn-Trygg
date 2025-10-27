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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-16">
        <div className="container mx-auto text-center px-4">
          <h1 className="text-4xl font-bold mb-4">Välkommen tillbaka! 👋</h1>
          <p className="text-xl opacity-90">Hur känns det idag?</p>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

          {/* Mood Logger Card */}
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">😊</div>
              <h3 className="text-xl font-semibold mb-2">Logga Humör</h3>
              <p className="text-gray-600">Snabbloggning med röst eller emoji</p>
            </CardContent>
          </Card>

          {/* AI Chat Card */}
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🤖</div>
              <h3 className="text-xl font-semibold mb-2">AI Terapeut</h3>
              <p className="text-gray-600">Prata med din personliga AI</p>
            </CardContent>
          </Card>

          {/* Daily Check-in Card */}
          <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📊</div>
              <h3 className="text-xl font-semibold mb-2">Daglig Översikt</h3>
              <p className="text-gray-600">Se dina framsteg och insikter</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Mood Trend */}
          <Card>
            <CardContent className="p-6">
              <Typography variant="h6" gutterBottom>
                Din Humörtrend
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Favorite sx={{ color: 'success.main' }} />
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

          {/* AI Insights */}
          <Card>
            <CardContent className="p-6">
              <Typography variant="h6" gutterBottom>
                AI Insikter
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Analytics sx={{ color: 'info.main' }} />
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
        </div>

        {/* Weekly Progress */}
        <Card sx={{ mt: 8 }}>
          <CardContent className="p-6">
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
      </div>
    </div>
  );
};

export default Dashboard;
