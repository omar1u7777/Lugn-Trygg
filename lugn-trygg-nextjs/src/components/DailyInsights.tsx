import React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, Chip, Button, Paper, Grid } from '@mui/material';
import { motion } from 'framer-motion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

interface Insight {
  type: 'trend' | 'pattern' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const MOCK_INSIGHTS: Insight[] = [
  {
    type: 'trend',
    title: 'Mood Improving',
    description: 'Your mood has been trending upward. Keep up the good work!',
    icon: <TrendingUpIcon />,
    color: '#4CAF50',
  },
  {
    type: 'pattern',
    title: 'Morning Person',
    description: 'You tend to feel best in the mornings. Plan important tasks early!',
    icon: <LightbulbIcon />,
    color: '#FFD54F',
  },
  {
    type: 'recommendation',
    title: 'Try Breathing Exercises',
    description: 'Deep breathing can help reduce stress and improve mood.',
    icon: <LightbulbIcon />,
    color: '#81C784',
  },
];

const DailyInsights: React.FC = () => {
  const moodScore = 68;
  const trend = 'up';
  const getTrendIcon = () => {
    switch (trend as any) {
      case 'up': return <TrendingUpIcon sx={{ color: '#4CAF50' }} />;
      case 'down': return <TrendingDownIcon sx={{ color: '#FF9800' }} />;
      default: return <TrendingFlatIcon sx={{ color: '#2196F3' }} />;
    }
  };
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>Your Daily Insights</Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body1">Overall Mood Score</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getTrendIcon()}
              <Typography variant="h4" color="primary">{moodScore}%</Typography>
            </Box>
          </Box>
          <LinearProgress variant="determinate" value={moodScore} sx={{ height: 10, borderRadius: 5, backgroundColor: '#E0E0E0', '& .MuiLinearProgress-bar': { backgroundColor: moodScore > 70 ? '#4CAF50' : moodScore > 40 ? '#FFB74D' : '#E57373' } }} aria-label={`Mood score ${moodScore} percent`} />
        </CardContent>
      </Card>
      <Box display="flex" flexWrap="wrap" gap={2}>
        {MOCK_INSIGHTS.map((insight, index) => (
          <Box key={index} sx={{ flex: { xs: '1 1 100%', md: '1 1 48%' }, minWidth: 0 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.1 }}>
              <Paper elevation={2} sx={{ p: 2, borderLeft: `4px solid ${insight.color}`, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                  <Box sx={{ color: insight.color, mt: 0.5 }}>{insight.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">{insight.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{insight.description}</Typography>
                  </Box>
                </Box>
                <Chip label={insight.type} size="small" sx={{ mt: 1, backgroundColor: `${insight.color}22`, color: insight.color }} />
              </Paper>
            </motion.div>
          </Box>
        ))}
      </Box>
      {MOCK_INSIGHTS.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">Log more moods to see personalized insights!</Typography>
          <Button variant="outlined" sx={{ mt: 2 }}>Log Your Mood</Button>
        </Paper>
      )}
    </Box>
  );
};

export default DailyInsights;
