import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface MoodChartPoint {
  label: string;
  score: number;
}

interface MoodChartProps {
  data?: MoodChartPoint[];
  className?: string;
}

const MoodChart: React.FC<MoodChartProps> = ({ data, className }) => {
  const chartData = useMemo(() => {
    if (data && data.length > 0) {
      return data;
    }

    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - index));
      return {
        label: day.toLocaleDateString('sv-SE', { weekday: 'short' }),
        score: 5 + Math.sin(index / 1.5) * 1.2,
      };
    });
  }, [data]);

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 ${className ?? ''}`}>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Humörutveckling</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis domain={[1, 10]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              formatter={(value: number) => [value.toFixed(1), 'Humör']}
              contentStyle={{
                backgroundColor: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 8,
                color: '#e2e8f0',
              }}
            />
            <Area type="monotone" dataKey="score" stroke="#0284c7" strokeWidth={2.5} fill="url(#moodGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MoodChart;
