/**
 * TEMPORARY DISABLED - Chart components causing React hooks error on Vercel
 * TODO: Fix React/Recharts bundling issue and re-enable
 * Error: "Cannot read properties of undefined (reading 'useState')"
 * 
 * This wrapper is DISABLED to unblock production deployment.
 * Charts will be replaced with placeholder messages until fixed.
 */
import { CircularProgress, Box, Typography, Alert } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';

// TEMPORARILY DISABLED - Chart imports causing bundling issues
// const AnalyticsCharts = lazy(() => import('../Analytics/AnalyticsCharts'));
// const PredictiveAnalytics = lazy(() => import('../AI/PredictiveAnalytics'));
// const HealthDataCharts = lazy(() => import('../Integrations/HealthDataCharts'));
// const MoodChart = lazy(() => import('../Dashboard/MoodChart'));
// const MemoryChart = lazy(() => import('../Dashboard/MemoryChart'));
// const PerformanceMonitor = lazy(() => import('../Performance/PerformanceMonitor'));

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight={300}
      width="100%"
      gap={2}
    >
      <BarChartIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
      <Alert severity="info" sx={{ maxWidth: 500 }}>
        <Typography variant="h6" gutterBottom>
          {title} - Temporary Unavailable
        </Typography>
        <Typography variant="body2">
          Chart functionality is temporarily disabled due to a bundling issue. 
          We're working on fixing this soon. Your data is safe!
        </Typography>
      </Alert>
    </Box>
  );
}

export function LazyAnalyticsCharts(_props: any) {
  return <ChartPlaceholder title="Analytics Charts" />;
}

export function LazyPredictiveAnalytics(_props: any) {
  return <ChartPlaceholder title="Predictive Analytics" />;
}

export function LazyHealthDataCharts(_props: any) {
  return <ChartPlaceholder title="Health Data Charts" />;
}

export function LazyMoodChart(_props: any) {
  return <ChartPlaceholder title="Mood Chart" />;
}

export function LazyMemoryChart(_props: any) {
  return <ChartPlaceholder title="Memory Chart" />;
}

export function LazyPerformanceMonitor(_props: any) {
  return <ChartPlaceholder title="Performance Monitor" />;
}

