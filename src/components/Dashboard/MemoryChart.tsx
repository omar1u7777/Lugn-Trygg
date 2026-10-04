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
    // Validate data is an array
    let validData = data;
    if (!Array.isArray(data)) {
      console.error('MemoryChart: data is not an array:', data);
      validData = [];
    }
    if (validData && validData.length > 0) {
      // Validate each data point
      const filteredData = validData.filter((point) => {
        if (!point || typeof point !== 'object') return false;
        if (typeof point.label !== 'string') return false;
        if (typeof point.entries !== 'number' || point.entries < 0) return false;
        return true;
      });
      return filteredData;
    }

    return [];
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 ${className ?? ''}`}>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Minnesaktivitet</h4>
        <div className="h-64 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Ingen data än
        </div>
      </div>
    );
  }

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
              formatter={(value) => [Number(value), 'Inlägg']}
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
