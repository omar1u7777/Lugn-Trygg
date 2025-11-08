import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Button,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Assessment,
  Timeline,
  Insights,
  Psychology,
  Favorite,
  Close,
  Refresh,
  Download,
  Share,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { getMoods, getWeeklyAnalysis } from '../api/api';
import useAuth from '../hooks/useAuth';
import '../styles/world-class-design.css';

interface WorldClassAnalyticsProps {
  onClose: () => void;
}

interface AnalyticsData {
  totalMoods: number;
  averageMood: number;
  moodTrend: 'up' | 'down' | 'stable';
  weeklyProgress: number;
  weeklyGoal: number;
  streakDays: number;
  insights: Array<{
    id: string;
    type: 'pattern' | 'improvement' | 'concern';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  moodDistribution: { [key: string]: number };
  weeklyData: Array<{ day: string; mood: number; count: number }>;
}

const WorldClassAnalytics: React.FC<WorldClassAnalyticsProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();

  const [data, setData] = useState<AnalyticsData>({
    totalMoods: 0,
    averageMood: 0,
    moodTrend: 'stable',
    weeklyProgress: 0,
    weeklyGoal: 7,
    streakDays: 0,
    insights: [],
    moodDistribution: {},
    weeklyData: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.page('World Class Analytics', {
      component: 'WorldClassAnalytics',
    });

    loadAnalyticsData();
  }, [user]);

  const loadAnalyticsData = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      const [moodsData, weeklyAnalysisData] = await PromiseAll([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
      ]);

      // Process mood data
      const totalMoods = moodsData.length;
      const averageMood = totalMoods > 0
        ? moodsData.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / totalMoods
        : 0;

      // Calculate mood trend (simplified)
      const recentMoods = moodsData.slice(-7);
      const olderMoods = moodsData.slice(-14, -7);
      const recentAvg = recentMoods.length > 0
        ? recentMoods.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / recentMoods.length
        : 0;
      const olderAvg = olderMoods.length > 0
        ? olderMoods.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / olderMoods.length
        : 0;

      let moodTrend: 'up' | 'down' | 'stable' = 'stable';
      if (recentAvg > olderAvg + 0.5) moodTrend = 'up';
      if (recentAvg < olderAvg - 0.5) moodTrend = 'down';

      // Generate insights
      const insights = generateInsights(moodsData, averageMood, moodTrend);

      // Mood distribution
      const moodDistribution = calculateMoodDistribution(moodsData);

      // Weekly data (last 7 days)
      const weeklyData = generateWeeklyData(moodsData);

      setData({
        totalMoods,
        averageMood: Math.round(averageMood * 10) / 10,
        moodTrend,
        weeklyProgress: weeklyAnalysisData.weekly_progress || 0,
        weeklyGoal: weeklyAnalysisData.weekly_goal || 7,
        streakDays: weeklyAnalysisData.streak_days || 0,
        insights,
        moodDistribution,
        weeklyData,
      });

      announceToScreenReader('Analytics data loaded successfully', 'polite');

    } catch (error) {
      console.error('Failed to load analytics data:', error);
      announceToScreenReader('Failed to load analytics data', 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (moods: any[], avgMood: number, trend: string) => {
    const insights = [];

    if (moods.length < 3) {
      insights.push({
        id: 'start-tracking',
        type: 'pattern' as const,
        title: 'Börja spåra ditt humör',
        description: 'Logga ditt humör regelbundet för att få bättre insikter om dina mönster.',
        severity: 'medium' as const,
      });
    }

    if (avgMood >= 7) {
      insights.push({
        id: 'positive-trend',
        type: 'improvement' as const,
        title: 'Positiv trend!',
        description: 'Ditt genomsnittliga humör är högt. Fortsätt med det du gör!',
        severity: 'low' as const,
      });
    }

    if (trend === 'down') {
      insights.push({
        id: 'concerning-trend',
        type: 'concern' as const,
        title: 'Nedåtgående trend',
        description: 'Ditt humör har sjunkit de senaste dagarna. Överväg att prata med någon.',
        severity: 'high' as const,
      });
    }

    if (avgMood <= 4) {
      insights.push({
        id: 'low-mood-support',
        type: 'concern' as const,
        title: 'Behöver du stöd?',
        description: 'Ditt humör är lågt. Du är inte ensam - överväg professionell hjälp.',
        severity: 'high' as const,
      });
    }

    return insights;
  };

  const calculateMoodDistribution = (moods: any[]) => {
    const distribution: { [key: string]: number } = {
      'Mycket dåligt (1-2)': 0,
      'Dåligt (3-4)': 0,
      'Neutralt (5-6)': 0,
      'Bra (7-8)': 0,
      'Mycket bra (9-10)': 0,
    };

    moods.forEach((mood: any) => {
      const score = mood.score || 0;
      if (score <= 2) distribution['Mycket dåligt (1-2)']++;
      else if (score <= 4) distribution['Dåligt (3-4)']++;
      else if (score <= 6) distribution['Neutralt (5-6)']++;
      else if (score <= 8) distribution['Bra (7-8)']++;
      else distribution['Mycket bra (9-10)']++;
    });

    return distribution;
  };

  const generateWeeklyData = (moods: any[]) => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayMoods = moods.filter((mood: any) => {
        const moodDate = new Date(mood.timestamp);
        return moodDate.toDateString() === date.toDateString();
      });

      last7Days.push({
        day: date.toLocaleDateString('sv-SE', { weekday: 'short' }),
        mood: dayMoods.length > 0
          ? dayMoods.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / dayMoods.length
          : 0,
        count: dayMoods.length,
      });
    }
    return last7Days;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error.main';
      case 'medium': return 'warning.main';
      case 'low': return 'success.main';
      default: return 'primary.main';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <TrendingDown />;
      case 'medium': return <Assessment />;
      case 'low': return <TrendingUp />;
      default: return <Insights />;
    }
  };

  if (loading) {
    return (
      <Box className="world-class-app" sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" className="world-class-body">
          Analyserar dina data...
        </Typography>
        <LinearProgress sx={{ mt: 2, borderRadius: 2, height: 8 }} />
      </Box>
    );
  }

  return (
    <Box
      className="world-class-app"
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)',
        p: 2,
      }}
    >
      <Card className="world-class-dashboard-card" sx={{ maxWidth: 1200, mx: 'auto' }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" className="world-class-heading-2">
              📊 Dina Insikter & Analys
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<Refresh />} onClick={loadAnalyticsData}>
                Uppdatera
              </Button>
              <Button startIcon={<Download />} variant="outlined">
                Exportera
              </Button>
              <IconButton onClick={onClose} aria-label="Close analytics">
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {data.averageMood}/10
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  Genomsnittligt humör
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {data.totalMoods}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  Totala loggningar
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {data.streakDays}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  Dagar i rad
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {data.insights.length}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  AI-insikter
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Insights */}
          {data.insights.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" className="world-class-heading-3" gutterBottom>
                🤖 AI-Insikter
              </Typography>

              <Grid container spacing={2}>
                {data.insights.map((insight) => (
                  <Grid item xs={12} md={6} key={insight.id}>
                    <Alert
                      severity={insight.severity === 'high' ? 'error' : insight.severity === 'medium' ? 'warning' : 'info'}
                      sx={{ borderRadius: 2 }}
                      icon={getSeverityIcon(insight.severity)}
                    >
                      <Typography variant="h6" gutterBottom>
                        {insight.title}
                      </Typography>
                      <Typography variant="body2">
                        {insight.description}
                      </Typography>
                    </Alert>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Mood Distribution */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" className="world-class-heading-3" gutterBottom>
              📈 Humörfördelning
            </Typography>

            <Grid container spacing={2}>
              {Object.entries(data.moodDistribution).map(([range, count]) => (
                <Grid item xs={12} sm={6} md={4} key={range}>
                  <Card sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" color="primary">
                      {count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {range}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Weekly Progress */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" className="world-class-heading-3" gutterBottom>
              📅 Veckoöversikt
            </Typography>

            <Card sx={{ p: 3 }}>
              <Box sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body1">
                    {data.weeklyProgress} / {data.weeklyGoal} humör-inlägg
                  </Typography>
                  <Typography variant="body1" color="primary">
                    {Math.round((data.weeklyProgress / data.weeklyGoal) * 100)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(data.weeklyProgress / data.weeklyGoal) * 100}
                  sx={{ height: 12, borderRadius: 6 }}
                />
              </Box>

              <Grid container spacing={1}>
                {data.weeklyData.map((day, index) => (
                  <Grid item xs key={index}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" display="block">
                        {day.day}
                      </Typography>
                      <Box
                        sx={{
                          height: 40,
                          bgcolor: day.mood > 0 ? 'primary.main' : 'grey.200',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          opacity: day.mood > 0 ? 1 : 0.3,
                        }}
                      >
                        {day.count > 0 && (
                          <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                            {day.count}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Card>
          </Box>

          {/* Trend Analysis */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" className="world-class-heading-3" gutterBottom>
              📊 Trendanalys
            </Typography>

            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {data.moodTrend === 'up' && <TrendingUp sx={{ color: 'success.main', fontSize: 32 }} />}
                {data.moodTrend === 'down' && <TrendingDown sx={{ color: 'error.main', fontSize: 32 }} />}
                {data.moodTrend === 'stable' && <Timeline sx={{ color: 'warning.main', fontSize: 32 }} />}

                <Box>
                  <Typography variant="h6">
                    {data.moodTrend === 'up' && 'Uppåtgående trend'}
                    {data.moodTrend === 'down' && 'Nedåtgående trend'}
                    {data.moodTrend === 'stable' && 'Stabil trend'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Baserat på dina senaste 7 dagar jämfört med veckan innan
                  </Typography>
                </Box>
              </Box>

              {data.moodTrend === 'down' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Om du känner dig nedstämd, överväg att prata med en vän, familjemedlem eller professionell hjälpare.
                    Du är inte ensam i detta.
                  </Typography>
                </Alert>
              )}
            </Card>
          </Box>

          {/* Recommendations */}
          <Box>
            <Typography variant="h5" className="world-class-heading-3" gutterBottom>
              💡 Rekommendationer
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'primary.light', color: 'white' }}>
                  <Psychology sx={{ fontSize: 32, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Fortsätt spåra regelbundet
                  </Typography>
                  <Typography variant="body2">
                    Daglig humörspårning hjälper dig förstå dina mönster och förbättrar dina insikter över tid.
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'secondary.light', color: 'white' }}>
                  <Favorite sx={{ fontSize: 32, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Fokusera på välbefinnande
                  </Typography>
                  <Typography variant="body2">
                    Överväg mindfulness, motion eller andra aktiviteter som förbättrar ditt humör.
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WorldClassAnalytics;