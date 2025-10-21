import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Paper,
} from '@mui/material';
import Grid from '@mui/system/Grid';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Psychology as PsychologyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

interface ForecastData {
  forecast: {
    daily_predictions: number[];
    average_forecast: number;
    trend: string;
    confidence_interval: {
      lower: number;
      upper: number;
    };
  };
  model_info: {
    algorithm: string;
    training_rmse: number;
    data_points_used: number;
  };
  current_analysis: {
    recent_average: number;
    volatility: number;
  };
  risk_factors: string[];
  recommendations: string[];
  confidence: number;
}

const MoodAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysAhead, setDaysAhead] = useState(7);

  useEffect(() => {
    if (user) {
      loadForecast();
    }
  }, [daysAhead, user]);

  const loadForecast = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/mood/predictive-forecast?days_ahead=${daysAhead}`);
      setForecast(response.data);
    } catch (err: any) {
      console.error('Failed to load forecast:', err);
      setError(err.response?.data?.error || t('analytics.loadError'));
      // Set fallback forecast data for UI to work
      setForecast({
        forecast: {
          daily_predictions: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          average_forecast: 0.4,
          trend: 'stable',
          confidence_interval: { lower: 0.2, upper: 0.6 }
        },
        model_info: {
          algorithm: 'fallback',
          training_rmse: 0.5,
          data_points_used: 0
        },
        current_analysis: {
          recent_average: 0.3,
          volatility: 0.4
        },
        risk_factors: [],
        recommendations: ['Continue logging your mood regularly'],
        confidence: 0.5
      });
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return '#4CAF50';
    if (score < -0.2) return '#F44336';
    return '#FF9800';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.2) return t('mood.positive');
    if (score < -0.2) return t('mood.negative');
    return t('mood.neutral');
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUpIcon color="success" />;
      case 'declining':
        return <TrendingDownIcon color="error" />;
      default:
        return <TimelineIcon color="action" />;
    }
  };

  const getRiskIcon = (risk: string) => {
    if (risk.includes('high') || risk.includes('negative')) {
      return <WarningIcon color="warning" />;
    }
    return <CheckCircleIcon color="success" />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!forecast || !forecast.current_analysis) {
    return (
      <Alert severity="info">
        {t('analytics.noData')}
      </Alert>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          {t('analytics.title')}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {t('analytics.description')}
        </Typography>

        {/* Forecast Controls */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            {t('analytics.forecastPeriod')}
          </Typography>
          <Box display="flex" gap={1}>
            {[3, 7, 14].map((days) => (
              <Button
                key={days}
                variant={daysAhead === days ? 'contained' : 'outlined'}
                onClick={() => setDaysAhead(days)}
                size="small"
              >
                {days} {t('analytics.days')}
              </Button>
            ))}
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Current Analysis */}
          <Grid xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon />
                  {t('analytics.currentAnalysis')}
                </Typography>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.recentAverage')}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LinearProgress
                      variant="determinate"
                      value={((forecast.current_analysis.recent_average + 1) / 2) * 100}
                      sx={{
                        flexGrow: 1,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'grey.300',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getSentimentColor(forecast.current_analysis.recent_average),
                        },
                      }}
                    />
                    <Typography variant="body2" fontWeight="bold">
                      {forecast.current_analysis.recent_average.toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {getSentimentLabel(forecast.current_analysis.recent_average)}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.volatility')}
                  </Typography>
                  <Typography variant="h6" color={forecast.current_analysis.volatility > 0.5 ? 'warning.main' : 'success.main'}>
                    {(forecast.current_analysis.volatility || 0).toFixed(2)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Forecast Summary */}
          <Grid xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getTrendIcon(forecast.forecast.trend)}
                  {t('analytics.forecastSummary')}
                </Typography>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.averageForecast')}
                  </Typography>
                  <Typography variant="h5" sx={{ color: getSentimentColor(forecast.forecast.average_forecast) }}>
                    {forecast.forecast.average_forecast.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getSentimentLabel(forecast.forecast.average_forecast)}
                  </Typography>
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.trend')}
                  </Typography>
                  <Chip
                    label={t(`analytics.trend.${forecast.forecast.trend}`)}
                    color={forecast.forecast.trend === 'improving' ? 'success' : forecast.forecast.trend === 'declining' ? 'error' : 'default'}
                    size="small"
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.confidence')}
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {(forecast.confidence * 100).toFixed(0)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Daily Predictions */}
          <Grid xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('analytics.dailyPredictions')}
                </Typography>

                <Box display="flex" flexWrap="wrap" gap={1}>
                  {forecast.forecast.daily_predictions.map((prediction, index) => (
                    <Paper
                      key={index}
                      elevation={1}
                      sx={{
                        p: 1,
                        minWidth: 60,
                        textAlign: 'center',
                        backgroundColor: getSentimentColor(prediction),
                        color: 'white',
                      }}
                    >
                      <Typography variant="caption" display="block">
                        {t('analytics.day')} {index + 1}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {prediction.toFixed(1)}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Risk Factors */}
          {forecast.risk_factors.length > 0 && (
            <Grid xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" />
                    {t('analytics.riskFactors')}
                  </Typography>

                  <Box display="flex" flexDirection="column" gap={1}>
                    {forecast.risk_factors.map((risk, index) => (
                      <Box key={index} display="flex" alignItems="center" gap={1}>
                        {getRiskIcon(risk)}
                        <Typography variant="body2">
                          {t(`analytics.risks.${risk}`)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Recommendations */}
          <Grid xs={12} md={forecast.risk_factors.length > 0 ? 6 : 12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon color="success" />
                  {t('analytics.recommendations')}
                </Typography>

                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {forecast.recommendations.map((rec, index) => (
                    <Typography key={index} component="li" variant="body2" sx={{ mb: 1 }}>
                      {rec}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Model Info */}
          <Grid xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('analytics.modelInfo')}
                </Typography>

                <Grid container spacing={2}>
                  <Grid xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">
                      {t('analytics.algorithm')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {forecast.model_info.algorithm.replace('_', ' ').toUpperCase()}
                    </Typography>
                  </Grid>

                  <Grid xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">
                      {t('analytics.trainingAccuracy')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {forecast.model_info.training_rmse.toFixed(3)}
                    </Typography>
                  </Grid>

                  <Grid xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">
                      {t('analytics.dataPoints')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {forecast.model_info.data_points_used}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </motion.div>
  );
};

export default MoodAnalytics;