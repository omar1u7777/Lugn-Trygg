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
import { getMoods, getWeeklyAnalysis, getChatHistory } from '../../api/api';
import useAuth from '../../hooks/useAuth';
import MoodLogger from '../MoodLogger';
import MemoryRecorder from '../MemoryRecorder';
import MemoryList from '../MemoryList';

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
  const { user } = useAuth();
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
  const [showMoodLogger, setShowMoodLogger] = useState(false);
  const [showMemoryRecorder, setShowMemoryRecorder] = useState(false);
  const [showMemoryList, setShowMemoryList] = useState(false);

  useEffect(() => {
    analytics.page('Dashboard', {
      component: 'Dashboard',
      userId,
    });

    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load real data from backend APIs
      const [moodsData, weeklyAnalysisData, chatHistoryData] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
        getChatHistory(user.user_id).catch(() => []),
      ]);

      // Process moods data
      const totalMoods = moodsData.length;
      const averageMood = totalMoods > 0
        ? moodsData.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / totalMoods
        : 0;

      // Process weekly analysis
      const weeklyGoal = weeklyAnalysisData.weekly_goal || 7;
      const weeklyProgress = weeklyAnalysisData.weekly_progress || totalMoods;
      const streakDays = weeklyAnalysisData.streak_days || Math.min(totalMoods, 7);

      // Process chat history
      const totalChats = chatHistoryData.length;

      // Create recent activity from moods and chats
      const recentActivity = [
        ...moodsData.slice(0, 3).map((mood: any, index: number) => ({
          id: `mood-${index}`,
          type: 'mood' as const,
          timestamp: new Date(mood.timestamp || Date.now()),
          description: `Logged mood: ${mood.mood || 'Unknown'} (${mood.score || 0}/10)`,
        })),
        ...chatHistoryData.slice(0, 2).map((chat: any, index: number) => ({
          id: `chat-${index}`,
          type: 'chat' as const,
          timestamp: new Date(chat.timestamp || Date.now()),
          description: 'Chat session with AI therapist',
        })),
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);

      setStats({
        totalMoods,
        totalChats,
        averageMood: Math.round(averageMood * 10) / 10,
        streakDays,
        weeklyGoal,
        weeklyProgress,
        recentActivity,
      });

      announceToScreenReader('Dashboard data loaded successfully', 'polite');

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      announceToScreenReader('Failed to load dashboard data', 'assertive');

      // Set fallback data
      setStats({
        totalMoods: 0,
        totalChats: 0,
        averageMood: 0,
        streakDays: 0,
        weeklyGoal: 7,
        weeklyProgress: 0,
        recentActivity: [],
      });
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
              onClick={() => setShowMoodLogger(true)}
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

          {/* Memory Recorder Card */}
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
              onClick={() => setShowMemoryRecorder(true)}
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
                  🎙️
                </Box>
                <Typography variant="h6" fontWeight="semibold" gutterBottom>
                  Spela in Minne
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Spara viktiga tankar och känslor
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Memory List Card */}
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
              onClick={() => setShowMemoryList(true)}
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
                  💭
                </Box>
                <Typography variant="h6" fontWeight="semibold" gutterBottom>
                  Dina Minnen
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lyssna på sparade minnen
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

      {/* Mood Logger Modal */}
      {showMoodLogger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Logga Humör
                </h2>
                <button
                  onClick={() => setShowMoodLogger(false)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-2xl"
                >
                  ✕
                </button>
              </div>
              <MoodLogger onMoodLogged={() => {
                setShowMoodLogger(false);
                loadDashboardData(); // Refresh dashboard data
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Memory Recorder Modal */}
      {showMemoryRecorder && user?.user_id && (
        <MemoryRecorder
          userId={user.user_id}
          onClose={() => setShowMemoryRecorder(false)}
        />
      )}

      {/* Memory List Modal */}
      {showMemoryList && (
        <MemoryList onClose={() => setShowMemoryList(false)} />
      )}
    </Box>
  );
};

export default Dashboard;
