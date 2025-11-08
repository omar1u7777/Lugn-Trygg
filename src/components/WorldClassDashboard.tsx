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
  Avatar,
  IconButton,
  Fab,
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
  Add,
  SelfImprovement,
  Spa,
  NatureOutlined,
  MusicNote,
  MenuBook,
  Group,
  Star,
  EmojiEvents,
  Timeline,
  Assessment,
  Insights,
  TrackChanges,
  Celebration,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { LoadingSpinner } from './LoadingStates';
import ErrorBoundary from './ErrorBoundary';
import { getMoods, getWeeklyAnalysis, getChatHistory } from '../api/api';
import useAuth from '../hooks/useAuth';
import '../styles/world-class-design.css';

// Lazy load components for performance
const WorldClassMoodLogger = lazy(() => import('./WorldClassMoodLogger'));
const WorldClassAIChat = lazy(() => import('./WorldClassAIChat'));
const WorldClassAnalytics = lazy(() => import('./WorldClassAnalytics'));
const WorldClassGamification = lazy(() => import('./WorldClassGamification'));

interface WorldClassDashboardProps {
  userId?: string;
}

interface DashboardStats {
  totalMoods: number;
  totalChats: number;
  averageMood: number;
  streakDays: number;
  weeklyGoal: number;
  weeklyProgress: number;
  insightsCount: number;
  achievementsCount: number;
  recentActivity: Array<{
    id: string;
    type: 'mood' | 'chat' | 'achievement' | 'meditation';
    timestamp: Date;
    description: string;
    icon: React.ReactNode;
    color: string;
  }>;
}

const WorldClassDashboard: React.FC<WorldClassDashboardProps> = ({ userId }) => {
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
    insightsCount: 0,
    achievementsCount: 0,
    recentActivity: [],
  });

  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'mood' | 'chat' | 'analytics' | 'gamification'>('overview');
  const [showQuickAction, setShowQuickAction] = useState(false);

  useEffect(() => {
    analytics.page('World Class Dashboard', {
      component: 'WorldClassDashboard',
      userId,
    });

    loadDashboardData();
  }, [userId, user]);

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

      // Process data for world-class dashboard
      const totalMoods = moodsData.length;
      const averageMood = totalMoods > 0
        ? moodsData.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / totalMoods
        : 0;

      const weeklyGoal = weeklyAnalysisData.weekly_goal || 7;
      const weeklyProgress = weeklyAnalysisData.weekly_progress || 0;
      const streakDays = weeklyAnalysisData.streak_days || 0;
      const totalChats = chatHistoryData.length;

      // Calculate insights and achievements
      const insightsCount = Math.floor(totalMoods / 3) + Math.floor(totalChats / 5);
      const achievementsCount = Math.floor(streakDays / 7) + Math.floor(totalMoods / 10);

      // Create rich recent activity
      const recentActivity = [
        ...moodsData.slice(0, 2).map((mood: any, index: number) => ({
          id: `mood-${index}`,
          type: 'mood' as const,
          timestamp: new Date(mood.timestamp || Date.now()),
          description: `Logged mood: ${mood.mood_text || 'Mood update'} (${mood.score || 0}/10)`,
          icon: <Favorite sx={{ fontSize: 20 }} />,
          color: getMoodColor(mood.score || 5),
        })),
        ...chatHistoryData.slice(0, 2).map((chat: any, index: number) => ({
          id: `chat-${index}`,
          type: 'chat' as const,
          timestamp: new Date(chat.timestamp || Date.now()),
          description: 'AI therapy session completed',
          icon: <Psychology sx={{ fontSize: 20 }} />,
          color: 'info.main',
        })),
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 4);

      setStats({
        totalMoods,
        totalChats,
        averageMood: Math.round(averageMood * 10) / 10,
        streakDays,
        weeklyGoal,
        weeklyProgress,
        insightsCount,
        achievementsCount,
        recentActivity,
      });

      announceToScreenReader('World-class dashboard loaded successfully', 'polite');

    } catch (error) {
      console.error('Failed to load world-class dashboard data:', error);
      announceToScreenReader('Failed to load dashboard data', 'assertive');
      setStats(prev => ({ ...prev, recentActivity: [] }));
    } finally {
      setLoading(false);
    }
  };

  const getMoodColor = (score: number): string => {
    if (score >= 8) return 'success.main';
    if (score >= 6) return 'warning.main';
    return 'error.main';
  };

  const handleRefresh = () => {
    analytics.track('World Class Dashboard Refreshed', {
      component: 'WorldClassDashboard',
      userId,
    });
    loadDashboardData();
  };

  const handleQuickAction = (action: string) => {
    analytics.track('Quick Action Taken', {
      action,
      component: 'WorldClassDashboard',
    });

    switch (action) {
      case 'mood':
        setActiveView('mood');
        break;
      case 'chat':
        setActiveView('chat');
        break;
      case 'meditation':
        // Navigate to meditation
        break;
      case 'journal':
        // Navigate to journal
        break;
    }
    setShowQuickAction(false);
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
    trend?: 'up' | 'down' | 'stable';
    ariaLabel?: string;
  }> = ({ title, value, icon, color = 'primary', trend, ariaLabel }) => (
    <Card className="world-class-dashboard-card world-class-animate-fade-in-up">
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography
              variant="h6"
              color="text.secondary"
              className="world-class-caption"
              gutterBottom
            >
              {title}
            </Typography>
            <Typography
              variant="h4"
              component="div"
              className="world-class-heading-2"
              aria-label={ariaLabel || `${title}: ${value}`}
              sx={{ color: `${color}.main` }}
            >
              {value}
            </Typography>
            {trend && (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                {trend === 'up' && <TrendingUp sx={{ color: 'success.main', fontSize: 16 }} />}
                {trend === 'down' && <TrendingUp sx={{ color: 'error.main', fontSize: 16, transform: 'rotate(180deg)' }} />}
                <Typography variant="caption" color="text.secondary">
                  {trend === 'up' ? '+12%' : trend === 'down' ? '-5%' : 'Stable'}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: `${color}.main`, fontSize: 48 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box className="world-class-dashboard" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom className="world-class-body">
          Loading your personalized mental health dashboard...
        </Typography>
        <LinearProgress aria-label="Loading dashboard data" className="world-class-loading-skeleton" />
      </Box>
    );
  }

  if (activeView !== 'overview') {
    return (
      <Box className="world-class-dashboard">
        <Box sx={{ p: 2 }}>
          <Button
            onClick={() => setActiveView('overview')}
            startIcon={<Refresh />}
            className="world-class-btn-secondary"
          >
            Back to Dashboard
          </Button>
        </Box>

        <Suspense fallback={<LoadingSpinner isLoading={true} message="Loading..." />}>
          {activeView === 'mood' && <WorldClassMoodLogger onClose={() => setActiveView('overview')} />}
          {activeView === 'chat' && <WorldClassAIChat onClose={() => setActiveView('overview')} />}
          {activeView === 'analytics' && <WorldClassAnalytics onClose={() => setActiveView('overview')} />}
          {activeView === 'gamification' && <WorldClassGamification onClose={() => setActiveView('overview')} />}
        </Suspense>
      </Box>
    );
  }

  return (
    <Box className="world-class-dashboard">
      {/* Hero Header */}
      <Box className="world-class-dashboard-header">
        <Box className="world-class-container">
          <Typography variant="h1" className="world-class-heading-1 world-class-brand-shadow">
            🌟 Välkommen tillbaka, {user?.email?.split('@')[0] || 'vän'}
          </Typography>
          <Typography variant="h5" className="world-class-body-large" sx={{ opacity: 0.9, mt: 2 }}>
            Din personliga resa mot bättre mental hälsa börjar här
          </Typography>

          {/* Quick Stats Row */}
          <Grid container spacing={4} sx={{ mt: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Humör idag"
                value={`${stats.averageMood}/10`}
                icon={<Favorite />}
                color="secondary"
                trend="up"
                ariaLabel={`Ditt genomsnittliga humör är ${stats.averageMood} av 10`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Streak dagar"
                value={stats.streakDays}
                icon={<Celebration />}
                color="accent"
                trend="up"
                ariaLabel={`Du har ${stats.streakDays} dagar i rad`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="AI-sessioner"
                value={stats.totalChats}
                icon={<Psychology />}
                color="info"
                ariaLabel={`Du har haft ${stats.totalChats} AI-samtal`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Achievements"
                value={stats.achievementsCount}
                icon={<EmojiEvents />}
                color="warning"
                ariaLabel={`Du har ${stats.achievementsCount} achievements`}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Main Content */}
      <Box className="world-class-dashboard-content">
        {/* Quick Actions Grid */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h3" className="world-class-heading-2" sx={{ mb: 4, textAlign: 'center' }}>
            Vad vill du göra idag?
          </Typography>

          <Grid container spacing={3}>
            {/* Mood Logging */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                className="world-class-dashboard-card world-class-animate-fade-in-up"
                sx={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleQuickAction('mood')}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box className="world-class-animate-breathe" sx={{ mb: 3 }}>
                    <Favorite sx={{ fontSize: 64, color: 'secondary.main' }} />
                  </Box>
                  <Typography variant="h6" className="world-class-heading-3" gutterBottom>
                    Logga Humör
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Spåra dina känslor och få personliga insikter
                  </Typography>
                  <Button
                    variant="contained"
                    className="world-class-btn-primary"
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Börja nu
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* AI Therapy */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                className="world-class-dashboard-card world-class-animate-fade-in-up"
                sx={{ cursor: 'pointer', height: '100%', animationDelay: '0.1s' }}
                onClick={() => handleQuickAction('chat')}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box className="world-class-animate-float" sx={{ mb: 3 }}>
                    <Psychology sx={{ fontSize: 64, color: 'primary.main' }} />
                  </Box>
                  <Typography variant="h6" className="world-class-heading-3" gutterBottom>
                    AI Terapeut
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Prata med din personliga AI-terapeut dygnet runt
                  </Typography>
                  <Button
                    variant="contained"
                    className="world-class-btn-primary"
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Starta samtal
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Meditation */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                className="world-class-dashboard-card world-class-animate-fade-in-up"
                sx={{ cursor: 'pointer', height: '100%', animationDelay: '0.2s' }}
                onClick={() => handleQuickAction('meditation')}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box className="world-class-animate-pulse-gentle" sx={{ mb: 3 }}>
                    <SelfImprovement sx={{ fontSize: 64, color: 'success.main' }} />
                  </Box>
                  <Typography variant="h6" className="world-class-heading-3" gutterBottom>
                    Meditation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Guidad meditation för stressreduktion och fokus
                  </Typography>
                  <Button
                    variant="outlined"
                    className="world-class-btn-secondary"
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Börja meditera
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Journal */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                className="world-class-dashboard-card world-class-animate-fade-in-up"
                sx={{ cursor: 'pointer', height: '100%', animationDelay: '0.3s' }}
                onClick={() => handleQuickAction('journal')}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box className="world-class-animate-glow" sx={{ mb: 3 }}>
                    <MenuBook sx={{ fontSize: 64, color: 'info.main' }} />
                  </Box>
                  <Typography variant="h6" className="world-class-heading-3" gutterBottom>
                    Journal
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Skriv ner dina tankar och känslor för bättre självinsikt
                  </Typography>
                  <Button
                    variant="outlined"
                    className="world-class-btn-secondary"
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Öppna journal
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Weekly Progress */}
        <Card className="world-class-dashboard-card world-class-dashboard-card-premium" sx={{ mb: 6 }}>
          <CardContent sx={{ p: 4 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <TrackChanges sx={{ fontSize: 32, color: 'white' }} />
              <Box>
                <Typography variant="h5" className="world-class-heading-3" sx={{ color: 'white' }}>
                  Veckoprogress
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {stats.weeklyProgress} av {stats.weeklyGoal} humör-inlägg denna vecka
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={(stats.weeklyProgress / stats.weeklyGoal) * 100}
                sx={{
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: 'white',
                    borderRadius: 6,
                  }
                }}
              />
            </Box>

            {stats.weeklyProgress >= stats.weeklyGoal ? (
              <Alert
                severity="success"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
                icon={<Celebration sx={{ color: 'white' }} />}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  🎉 Grattis! Du har nått ditt veckomål!
                </Typography>
              </Alert>
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {stats.weeklyGoal - stats.weeklyProgress} inlägg kvar till nästa achievement
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity & Insights */}
        <Grid container spacing={4}>
          {/* Recent Activity */}
          <Grid item xs={12} lg={6}>
            <Card className="world-class-dashboard-card">
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Timeline sx={{ color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h6" className="world-class-heading-3">
                    Senaste aktivitet
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {stats.recentActivity.length > 0 ? (
                    stats.recentActivity.map((activity) => (
                      <Box
                        key={activity.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: 'grey.50',
                          transition: 'all 0.2s',
                          '&:hover': { backgroundColor: 'grey.100' }
                        }}
                      >
                        <Avatar sx={{ bgcolor: activity.color, width: 40, height: 40 }}>
                          {activity.icon}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {activity.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.timestamp.toLocaleDateString('sv-SE', {
                              weekday: 'long',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                        </Box>
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <AccessTime sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        Ingen aktivitet ännu. Börja med att logga ditt första humör!
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* AI Insights */}
          <Grid item xs={12} lg={6}>
            <Card className="world-class-dashboard-card">
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Insights sx={{ color: 'secondary.main', fontSize: 28 }} />
                  <Typography variant="h6" className="world-class-heading-3">
                    AI Insikter
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Alert
                    severity="info"
                    sx={{ borderRadius: 3 }}
                    icon={<Psychology sx={{ color: 'info.main' }} />}
                  >
                    <Typography variant="body2">
                      <strong>Personlig insikt:</strong> Dina humör-mönster visar en positiv trend.
                      Fortsätt logga regelbundet för bättre självinsikt!
                    </Typography>
                  </Alert>

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<Star />}
                      label={`${stats.insightsCount} Insikter`}
                      variant="outlined"
                      color="primary"
                    />
                    <Chip
                      icon={<EmojiEvents />}
                      label={`${stats.achievementsCount} Achievements`}
                      variant="outlined"
                      color="secondary"
                    />
                    <Chip
                      icon={<Assessment />}
                      label={`${stats.totalMoods} Humör-loggar`}
                      variant="outlined"
                      color="info"
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Breathing Exercise Reminder */}
        <Card className="world-class-breathing-guide world-class-dashboard-card" sx={{ mt: 6 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Box className="world-class-breathing-circle" sx={{ mb: 3 }} />
            <Typography variant="h6" className="world-class-breathing-text" sx={{ mb: 2 }}>
              Ta ett djupt andetag
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Andas in... Håll kvar... Andas ut... Upprepa för bättre fokus och lugn.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Floating Action Button for Quick Access */}
      <Fab
        color="primary"
        aria-label="Quick actions"
        className="world-class-animate-float"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
        onClick={() => setShowQuickAction(!showQuickAction)}
      >
        <Add />
      </Fab>

      {/* Quick Action Menu */}
      {showQuickAction && (
        <Card
          sx={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            zIndex: 1000,
            minWidth: 200,
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem' }}>
              Snabbåtgärder
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                size="small"
                startIcon={<Favorite />}
                onClick={() => handleQuickAction('mood')}
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Logga humör
              </Button>
              <Button
                size="small"
                startIcon={<Psychology />}
                onClick={() => handleQuickAction('chat')}
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                AI-chatt
              </Button>
              <Button
                size="small"
                startIcon={<SelfImprovement />}
                onClick={() => handleQuickAction('meditation')}
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Meditation
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default WorldClassDashboard;