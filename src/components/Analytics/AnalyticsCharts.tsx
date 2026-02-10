/**
 * Analytics Charts Component
 * Renders mood forecast predictions and confidence intervals using Recharts.
 * Displayed inside MoodAnalytics when forecast data is available.
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/tailwind/Card';

interface AnalyticsChartsProps {
  /** Daily predicted mood values */
  dailyPredictions: number[];
  /** Upper and lower bounds of the confidence interval */
  confidenceInterval: { lower: number; upper: number };
  /** Optional className for styling */
  className?: string;
}

interface ChartDataPoint {
  day: string;
  prediction: number;
  upper: number;
  lower: number;
}

/**
 * AnalyticsCharts – Mood forecast line chart with confidence band.
 */
const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  dailyPredictions,
  confidenceInterval,
  className,
}) => {
  // Build chart data from props
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!dailyPredictions || dailyPredictions.length === 0) return [];

    const { lower, upper } = confidenceInterval ?? { lower: 0, upper: 10 };

    return dailyPredictions.map((value, index) => {
      const dayLabel = `Dag ${index + 1}`;
      return {
        day: dayLabel,
        prediction: parseFloat(value.toFixed(1)),
        upper: parseFloat(Math.min(upper, 10).toFixed(1)),
        lower: parseFloat(Math.max(lower, 0).toFixed(1)),
      };
    });
  }, [dailyPredictions, confidenceInterval]);

  // No data fallback
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Humörprognos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
            <p>Inte tillräckligt med data för att visa prognos.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Humörprognos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

              <XAxis
                dataKey="day"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '0.85rem',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    prediction: 'Prognos',
                    upper: 'Övre gräns',
                    lower: 'Undre gräns',
                  };
                  return [value.toFixed(1), labels[name] ?? name];
                }}
              />

              <Legend
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    prediction: 'Prognos',
                    upper: 'Övre gräns',
                    lower: 'Undre gräns',
                  };
                  return labels[value] ?? value;
                }}
              />

              {/* Confidence band – rendered as two stacked areas */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="#a78bfa"
                fillOpacity={0.15}
                name="upper"
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#ffffff"
                fillOpacity={0.8}
                name="lower"
                legendType="none"
              />

              {/* Prediction line */}
              <Line
                type="monotone"
                dataKey="prediction"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#7c3aed', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                name="prediction"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence interval summary */}
        {confidenceInterval && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
            Konfidensintervall: {confidenceInterval.lower.toFixed(1)} – {confidenceInterval.upper.toFixed(1)} / 10
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(AnalyticsCharts);
