import React, { lazy, Suspense } from 'react';

const AnalyticsChartsLazy = lazy(() => import('../Analytics/AnalyticsCharts'));
const PredictiveAnalyticsLazy = lazy(() => import('../AI/PredictiveAnalytics'));
const HealthDataChartsLazy = lazy(() => import('../Integrations/HealthDataCharts'));
const MoodChartLazy = lazy(() => import('../Dashboard/MoodChart'));
const MemoryChartLazy = lazy(() => import('../Dashboard/MemoryChart'));
const PerformanceDashboardLazy = lazy(() => import('../PerformanceDashboard'));

interface ChartLoadingFallbackProps {
  minHeightClass?: string;
}

function ChartLoadingFallback({ minHeightClass = 'min-h-[260px]' }: ChartLoadingFallbackProps) {
  return (
    <div className={`w-full ${minHeightClass} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center`}>
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-primary-600" />
    </div>
  );
}

export function LazyAnalyticsCharts(props: {
  dailyPredictions?: number[];
  confidenceInterval?: { lower: number; upper: number };
  className?: string;
}) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <AnalyticsChartsLazy
        dailyPredictions={props.dailyPredictions ?? []}
        confidenceInterval={props.confidenceInterval ?? { lower: 0, upper: 10 }}
        className={props.className}
      />
    </Suspense>
  );
}

export function LazyPredictiveAnalytics() {
  return (
    <Suspense fallback={<ChartLoadingFallback minHeightClass="min-h-[320px]" />}>
      <PredictiveAnalyticsLazy />
    </Suspense>
  );
}

export function LazyHealthDataCharts(props: { userId: string }) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <HealthDataChartsLazy userId={props.userId} />
    </Suspense>
  );
}

export function LazyMoodChart(props: { data?: Array<{ label: string; score: number }>; className?: string }) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <MoodChartLazy data={props.data} className={props.className} />
    </Suspense>
  );
}

export function LazyMemoryChart(props: { data?: Array<{ label: string; entries: number }>; className?: string }) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <MemoryChartLazy data={props.data} className={props.className} />
    </Suspense>
  );
}

export function LazyPerformanceMonitor() {
  return (
    <Suspense fallback={<ChartLoadingFallback minHeightClass="min-h-[320px]" />}>
      <PerformanceDashboardLazy />
    </Suspense>
  );
}

