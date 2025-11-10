/**
 * Daily Insights Component
 * AI-powered mood analysis and personalized recommendations
 */

import React, { useEffect, useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Paper,
  Grid
} from '@mui/material';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { trackEvent } from '../services/analytics';

interface DailyInsightsProps {
  userId: string;
  moodData: any[];
}

interface Insight {
  type: 'trend' | 'pattern' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export const DailyInsights: React.FC<DailyInsightsProps> = ({
  userId,
  moodData,
}) => {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [moodScore, setMoodScore] = useState<number>(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  useEffect(() => {
    if (moodData && moodData.length > 0) {
      analyzeData();
      trackEvent('daily_insights_viewed', { userId });
    }
  }, [moodData, userId]);

  const analyzeData = () => {
    // Calculate average mood score
    const scores = moodData.map((m) => m.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    setMoodScore(Math.round((avgScore + 1) * 50)); // Normalize to 0-100

    // Determine trend
    if (moodData.length >= 2) {
      const recentScore = scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
      const olderScore = scores.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 3);
      
      if (recentScore > olderScore + 0.2) setTrend('up');
      else if (recentScore < olderScore - 0.2) setTrend('down');
      else setTrend('stable');
    }

    // Generate insights
    const generatedInsights: Insight[] = [];

    // Trend insight
    if (trend === 'up') {
      generatedInsights.push({
        type: 'trend',
        title: t('insights.trendUp', 'Mood Improving'),
        description: t('insights.trendUpDesc', 'Your mood has been trending upward. Keep up the good work!'),
        icon: <TrendingUpIcon />,
        color: '#4CAF50',
      });
    } else if (trend === 'down') {
      generatedInsights.push({
        type: 'trend',
        title: t('insights.trendDown', 'Need Support'),
        description: t('insights.trendDownDesc', 'Your mood has been lower lately. Consider reaching out for support.'),
        icon: <TrendingDownIcon />,
        color: '#FF9800',
      });
    } else {
      generatedInsights.push({
        type: 'trend',
        title: t('insights.trendStable', 'Mood Stable'),
        description: t('insights.trendStableDesc', 'Your mood has been consistent. Great job maintaining balance!'),
        icon: <TrendingFlatIcon />,
        color: '#2196F3',
      });
    }

    // Pattern insight
    const morningMoods = moodData.filter((m) => {
      const hour = new Date(m.timestamp).getHours();
      return hour >= 6 && hour < 12;
    });

    if (morningMoods.length > 0) {
      const avgMorningScore = morningMoods.reduce((a, m) => a + (m.score || 0), 0) / morningMoods.length;
      if (avgMorningScore > 0.3) {
        generatedInsights.push({
          type: 'pattern',
          title: t('insights.morningPattern', 'Morning Person'),
          description: t('insights.morningPatternDesc', 'You tend to feel best in the mornings. Plan important tasks early!'),
          icon: <LightbulbIcon />,
          color: '#FFD54F',
        });
      }
    }

    // Recommendation
    if (avgScore < -0.3) {
      generatedInsights.push({
        type: 'recommendation',
        title: t('insights.recBreathing', 'Try Breathing Exercises'),
        description: t('insights.recBreathingDesc', 'Deep breathing can help reduce stress and improve mood.'),
        icon: <LightbulbIcon />,
        color: '#81C784',
      });
    } else if (avgScore > 0.5) {
      generatedInsights.push({
        type: 'achievement',
        title: t('insights.achievement', 'Great Week!'),
        description: t('insights.achievementDesc', 'You\'ve had mostly positive moods this week. Celebrate your progress!'),
        icon: <LightbulbIcon />,
        color: '#4CAF50',
      });
    }

    setInsights(generatedInsights);
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ color: '#4CAF50' }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: '#FF9800' }} />;
      default:
        return <TrendingFlatIcon sx={{ color: '#2196F3' }} />;
    }
  };

  return (
    <Box sx={{ mt: spacing.lg }}>
      <Typography variant="h6" gutterBottom>
        {t('insights.title', 'Your Daily Insights')}
      </Typography>

      <Card sx={{ mb: spacing.md }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md }}>
            <Typography variant="body1">
              {t('insights.overallMood', 'Overall Mood Score')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              {getTrendIcon()}
              <Typography variant="h4" color="primary">
                {moodScore}%
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={moodScore}
            sx={{
              height: 10,
              borderRadius: 5,
              backgroundColor: '#E0E0E0',
              '& .MuiLinearProgress-bar': {
                backgroundColor:
                  moodScore > 70 ? '#4CAF50' : moodScore > 40 ? '#FFB74D' : '#E57373',
              },
            }}
            aria-label={`Mood score ${moodScore} percent`}
          />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {insights.map((insight, index) => (
          <Grid xs={12} md={6} key={index}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Paper
                elevation={2}
                sx={{
                  p: spacing.md,
                  borderLeft: `4px solid ${insight.color}`,
                  height: '100%',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, mb: spacing.sm }}>
                  <Box sx={{ color: insight.color, mt: 0.5 }}>{insight.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {insight.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {insight.description}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={insight.type}
                  size="small"
                  sx={{
                    mt: spacing.sm,
                    backgroundColor: `${insight.color}22`,
                    color: insight.color,
                  }}
                />
              </Paper>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {insights.length === 0 && (
        <Paper sx={{ p: spacing.lg, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {t('insights.noData', 'Log more moods to see personalized insights!')}
          </Typography>
          <Button variant="outlined" sx={{ mt: spacing.md }}>
            {t('insights.logMood', 'Log Your Mood')}
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default DailyInsights;
