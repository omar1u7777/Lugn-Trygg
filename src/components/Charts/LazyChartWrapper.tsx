/**
 * Lazy-loaded chart wrappers.
 * AnalyticsCharts is re-enabled (no longer uses React hooks internally that conflict).
 * Other chart components remain placeholders until their bundling issues are resolved.
 */
import React, { lazy, Suspense } from 'react';
import { ChartBarIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const AnalyticsChartsLazy = lazy(() => import('../Analytics/AnalyticsCharts'));
const PredictiveAnalyticsLazy = lazy(() => import('../AI/PredictiveAnalytics'));

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] w-full gap-4 p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-lg">
      <ChartBarIcon className="w-16 h-16 text-primary-500 dark:text-primary-400" />
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg max-w-lg">
        <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {title} - Tillfälligt Otillgänglig
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Chart-funktionalitet är tillfälligt inaktiverad på grund av ett bundling-problem. 
            Vi arbetar på att fixa detta snart. Din data är säker!
          </p>
        </div>
      </div>
    </div>
  );
}

export function LazyAnalyticsCharts(props: {
  dailyPredictions?: number[];
  confidenceInterval?: { lower: number; upper: number };
  className?: string;
}) {
  const { dailyPredictions, confidenceInterval } = props;

  // Fall back to placeholder when no data is passed
  if (!dailyPredictions || dailyPredictions.length === 0) {
    return <ChartPlaceholder title="Analytics Charts" />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-72">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <AnalyticsChartsLazy
        dailyPredictions={dailyPredictions}
        confidenceInterval={confidenceInterval ?? { lower: 0, upper: 10 }}
        className={props.className}
      />
    </Suspense>
  );
}

export function LazyPredictiveAnalytics() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-72">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <PredictiveAnalyticsLazy />
    </Suspense>
  );
}

export function LazyHealthDataCharts() {
  return <ChartPlaceholder title="Health Data Charts" />;
}

export function LazyMoodChart() {
  return <ChartPlaceholder title="Mood Chart" />;
}

export function LazyMemoryChart() {
  return <ChartPlaceholder title="Memory Chart" />;
}

export function LazyPerformanceMonitor() {
  return <ChartPlaceholder title="Performance Monitor" />;
}

