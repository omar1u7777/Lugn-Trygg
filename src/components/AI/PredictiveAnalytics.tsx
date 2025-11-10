import React, { useEffect, useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  LinearProgress,
  Grid
} from '@mui/material';

import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';
import { Line } from 'react-chartjs-2';

// Chart.js registration is handled in src/config/chartConfig.ts

interface ForecastData {
  daily_predictions: number[];
  average_forecast: number;
  trend: 'improving' | 'declining' | 'stable';
  confidence_interval?: {
    lower: number;
    upper: number;
  };
}

interface AnalyticsResult {
  forecast: ForecastData;
  model_info?: {
    algorithm: string;
    training_rmse: number;
  };
  risk_factors: string[];
  recommendations: string[];
  confidence: number;
}

const PredictiveAnalytics: React.FC<{ userId: string }> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [daysAhead, setDaysAhead] = useState(7);
  const { token } = useAuth();

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post('/api/ai/forecast', {
        user_id: userId,
        days_ahead: daysAhead,
        use_sklearn: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchForecast();
    }
  }, [userId, daysAhead]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp color="success" />;
      case 'declining':
        return <TrendingDown color="error" />;
      default:
        return <TrendingFlat color="action" />;
    }
  };

  const getRiskColor = (riskFactors: string[]) => {
    if (riskFactors.length >= 3) return 'error';
    if (riskFactors.length >= 1) return 'warning';
    return 'success';
  };

  const chartData = result
    ? {
        labels: Array.from({ length: daysAhead }, (_, i) => `Day ${i + 1}`),
        datasets: [
          {
            label: 'Predicted Mood',
            data: result.forecast.daily_predictions,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
          }
        ]
      }
    : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: `${daysAhead}-Day Mood Forecast`
      }
    },
    scales: {
      y: {
        min: -1,
        max: 1,
        ticks: {
          callback: function (value: any) {
            if (value > 0.2) return 'Positive';
            if (value < -0.2) return 'Negative';
            return 'Neutral';
          }
        }
      }
    }
  };

  return (
    <Card sx={{ maxWidth: 900, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🔮 Predictive Mood Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.lg }}>
          AI-powered mood forecasting using machine learning models trained on your historical data.
        </Typography>

        <Box sx={{ mb: spacing.lg, display: 'flex', gap: spacing.md }}>
          <Button
            variant={daysAhead === 7 ? 'contained' : 'outlined'}
            onClick={() => setDaysAhead(7)}
          >
            7 Days
          </Button>
          <Button
            variant={daysAhead === 14 ? 'contained' : 'outlined'}
            onClick={() => setDaysAhead(14)}
          >
            14 Days
          </Button>
          <Button
            variant={daysAhead === 30 ? 'contained' : 'outlined'}
            onClick={() => setDaysAhead(30)}
          >
            30 Days
          </Button>
          <Button variant="outlined" onClick={fetchForecast}>
            Refresh
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: spacing.md }}>
            {error}
          </Alert>
        )}

        {result && !loading && (
          <>
            {/* Trend Summary */}
            <Grid container spacing={2} sx={{ mb: spacing.lg }}>
              <Grid xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      {getTrendIcon(result.forecast.trend)}
                      <Typography variant="h6">Trend</Typography>
                    </Box>
                    <Typography variant="body1" sx={{ mt: spacing.sm, textTransform: 'capitalize' }}>
                      {result.forecast.trend}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6">Average Forecast</Typography>
                    <Typography variant="h4" color="primary" sx={{ mt: spacing.sm }}>
                      {result.forecast.average_forecast.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (-1.0 to 1.0 scale)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6">Confidence</Typography>
                    <Box sx={{ mt: spacing.sm }}>
                      <LinearProgress
                        variant="determinate"
                        value={result.confidence * 100}
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                      <Typography variant="body2" sx={{ mt: spacing.sm }}>
                        {(result.confidence * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Chart */}
            {chartData && (
              <Box sx={{ mb: spacing.lg }}>
                <Line data={chartData} options={chartOptions} />
              </Box>
            )}

            {/* Risk Factors */}
            {result.risk_factors.length > 0 && (
              <Box sx={{ mb: spacing.lg }}>
                <Alert severity={getRiskColor(result.risk_factors)} icon={<Warning />}>
                  <Typography variant="subtitle1" gutterBottom>
                    Risk Factors Detected
                  </Typography>
                  <Box sx={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', mt: spacing.sm }}>
                    {result.risk_factors.map((factor, idx) => (
                      <Chip
                        key={idx}
                        label={factor.replace(/_/g, ' ')}
                        size="small"
                        color={getRiskColor(result.risk_factors)}
                      />
                    ))}
                  </Box>
                </Alert>
              </Box>
            )}

            {/* Recommendations */}
            <Box sx={{ mb: spacing.md }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <CheckCircle color="primary" />
                Personalized Recommendations
              </Typography>
              <Box sx={{ pl: 2 }}>
                {result.recommendations.map((rec, idx) => (
                  <Typography key={idx} variant="body2" sx={{ mb: spacing.sm }}>
                    • {rec}
                  </Typography>
                ))}
              </Box>
            </Box>

            {/* Model Info */}
            {result.model_info && (
              <Box sx={{ mt: spacing.lg, p: spacing.md, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Model: {result.model_info.algorithm} | RMSE: {result.model_info.training_rmse.toFixed(3)}
                </Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PredictiveAnalytics;
