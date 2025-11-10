import React, { useEffect, useState, useCallback } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';
import { Line } from 'react-chartjs-2';
import { Box, Typography, CircularProgress } from '@mui/material';
import { debounce } from 'lodash';
import { getMoods } from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

// Chart.js registration is handled in src/config/chartConfig.ts

const MoodChart: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMoodData = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const moods = await getMoods(user.user_id);

      // Prepare data for last 7 days
      const last7Days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().substring(0, 10));
      }

      const moodScores = last7Days.map(date => {
        const dayMoods = moods.filter((mood: any) => {
          const timestamp = mood.timestamp;
          if (!timestamp) return false;
          try {
            // Handle Firestore Timestamp objects
            const moodDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            if (isNaN(moodDate.getTime())) return false;
            return moodDate.toISOString().split('T')[0] === date;
          } catch {
            return false;
          }
        });

        if (dayMoods.length === 0) return 0;
        const avgScore = dayMoods.reduce((sum: number, mood: any) =>
          sum + (mood.ai_analysis?.score || mood.sentiment_score || 0), 0
        ) / dayMoods.length;
        return avgScore;
      });

      const data = {
        labels: last7Days.map((date: string) => new Date(date).toLocaleDateString('sv-SE')),
        datasets: [{
          label: t('mood.score', 'Mood Score'),
          data: moodScores,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          fill: true,
          tension: 0.4
        }]
      };

      setChartData(data);
    } catch (error) {
      console.error('Failed to fetch mood data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  const debouncedFetchMoodData = useCallback(
    debounce(fetchMoodData, 500),
    [fetchMoodData]
  );

  useEffect(() => {
    debouncedFetchMoodData();
    return () => debouncedFetchMoodData.cancel();
  }, [debouncedFetchMoodData]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: t('dashboard.weeklyMoodAnalysis', 'Weekly Mood Analysis') }
    },
    scales: {
      y: {
        min: -1,
        max: 1,
        ticks: {
          callback: (value: number) => {
            if (value === -1) return t('mood.negative', 'Negative');
            if (value === 0) return t('mood.neutral', 'Neutral');
            if (value === 1) return t('mood.positive', 'Positive');
            return '';
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: spacing.lg }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      </Box>
    );
  }

  if (!chartData || !chartData.datasets || chartData.datasets.length === 0) {
    return (
      <Box sx={{ p: spacing.lg, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.noDataAvailable')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '300px' }}>
      <Line key={JSON.stringify(chartData)} data={chartData} options={options} />
    </Box>
  );
};

export default MoodChart;