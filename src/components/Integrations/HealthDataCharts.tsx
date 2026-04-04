import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ResponsiveContainer,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	PieChart,
	Pie,
	Cell,
} from 'recharts';
import { getSyncStats, type SyncStatsResponse } from '../../api/sync';
import { logger } from '../../utils/logger';

interface HealthDataChartsProps {
	userId: string;
}

const PIE_COLORS = ['#16a34a', '#f59e0b', '#dc2626'];

const HealthDataCharts: React.FC<HealthDataChartsProps> = ({ userId }) => {
	const [stats, setStats] = useState<SyncStatsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadStats = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await getSyncStats();
			setStats(data);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Kunde inte hämta synkstatistik.';
			setError(message);
			logger.error('Failed to load health sync stats', { userId, message });
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		void loadStats();
	}, [loadStats]);

	const providerData = useMemo(() => {
		if (!stats) return [];
		return Object.values(stats.byProvider).map((provider) => ({
			name: provider.name,
			total: provider.total,
			successRate: provider.total > 0 ? Math.round((provider.success / provider.total) * 100) : 0,
		}));
	}, [stats]);

	const outcomeData = useMemo(() => {
		if (!stats) return [];
		return [
			{ name: 'Lyckade', value: stats.successCount },
			{ name: 'Delvis', value: stats.partialCount },
			{ name: 'Misslyckade', value: stats.failedCount },
		].filter((item) => item.value > 0);
	}, [stats]);

	if (loading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
				<div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
				<p className="text-sm text-red-700 dark:text-red-300">{error}</p>
			</div>
		);
	}

	if (!stats || stats.totalSyncs === 0) {
		return (
			<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center">
				<p className="text-slate-600 dark:text-slate-400">Ingen synkstatistik tillgänglig ännu. Kör en synk först för att visa diagram.</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
					<p className="text-xs text-slate-500 dark:text-slate-400">Totala synkar</p>
					<p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.totalSyncs}</p>
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
					<p className="text-xs text-slate-500 dark:text-slate-400">Lyckade</p>
					<p className="text-2xl font-semibold text-green-600 dark:text-green-400">{stats.successCount}</p>
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
					<p className="text-xs text-slate-500 dark:text-slate-400">Misslyckade</p>
					<p className="text-2xl font-semibold text-red-600 dark:text-red-400">{stats.failedCount}</p>
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
					<p className="text-xs text-slate-500 dark:text-slate-400">Success rate</p>
					<p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.successRate.toFixed(1)}%</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
					<h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Synkar per källa</h4>
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={providerData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
								<CartesianGrid strokeDasharray="3 3" opacity={0.25} />
								<XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
								<YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
								<Tooltip
									contentStyle={{
										backgroundColor: 'rgba(15,23,42,0.95)',
										border: '1px solid rgba(148,163,184,0.3)',
										borderRadius: 8,
										color: '#e2e8f0',
									}}
								/>
								<Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#2563eb" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
					<h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Utfall</h4>
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={outcomeData}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="50%"
									outerRadius={86}
									label
								>
									{outcomeData.map((entry, index) => (
										<Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
									))}
								</Pie>
								<Tooltip
									contentStyle={{
										backgroundColor: 'rgba(15,23,42,0.95)',
										border: '1px solid rgba(148,163,184,0.3)',
										borderRadius: 8,
										color: '#e2e8f0',
									}}
								/>
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
		</div>
	);
};

export default HealthDataCharts;
