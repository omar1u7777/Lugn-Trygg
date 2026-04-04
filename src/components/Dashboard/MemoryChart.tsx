import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface MemoryChartPoint {
  label: string;
  entries: number;
}

interface MemoryChartProps {
  data?: MemoryChartPoint[];
  className?: string;
}

const MemoryChart: React.FC<MemoryChartProps> = ({ data, className }) => {
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
        entries: Math.max(0, Math.round(2 + Math.cos(index / 1.4) * 1.5 + index * 0.2)),
      };
    });
  }, [data]);

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 ${className ?? ''}`}>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Minnesaktivitet</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              formatter={(value: number) => [value, 'Inlägg']}
              contentStyle={{
                backgroundColor: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 8,
                color: '#e2e8f0',
              }}
            />
            <Bar dataKey="entries" fill="#7c3aed" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MemoryChart;
