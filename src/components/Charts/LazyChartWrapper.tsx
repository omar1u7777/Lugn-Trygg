/**
 * Lazy Chart Wrapper - Forces all charts to load AFTER React is ready
 * This fixes the "Cannot read properties of undefined (reading 'useState')" error
 * by ensuring React hooks are available before chart libraries execute
 */
import { lazy, Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';

// Lazy load ALL chart components to prevent React hooks errors
const AnalyticsCharts = lazy(() => import('../Analytics/AnalyticsCharts'));
const PredictiveAnalytics = lazy(() => import('../AI/PredictiveAnalytics'));
const HealthDataCharts = lazy(() => import('../Integrations/HealthDataCharts'));
const MoodChart = lazy(() => import('../Dashboard/MoodChart'));
const MemoryChart = lazy(() => import('../Dashboard/MemoryChart'));
const PerformanceMonitor = lazy(() => import('../Performance/PerformanceMonitor'));

function ChartLoadingFallback() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight={300}
      width="100%"
    >
      <CircularProgress size={40} />
    </Box>
  );
}

export function LazyAnalyticsCharts(props: any) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <AnalyticsCharts {...props} />
    </Suspense>
  );
}

export function LazyPredictiveAnalytics(props: any) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <PredictiveAnalytics {...props} />
    </Suspense>
  );
}

export function LazyHealthDataCharts(props: any) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <HealthDataCharts {...props} />
    </Suspense>
  );
}

export function LazyMoodChart(props: any) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <MoodChart {...props} />
    </Suspense>
  );
}

export function LazyMemoryChart(props: any) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <MemoryChart {...props} />
    </Suspense>
  );
}

export function LazyPerformanceMonitor(props: any) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <PerformanceMonitor {...props} />
    </Suspense>
  );
}
