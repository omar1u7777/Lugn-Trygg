export const CHART_COLORS = {
	primary: '#2563eb',
	secondary: '#0ea5e9',
	accent: '#7c3aed',
	success: '#16a34a',
	warning: '#f59e0b',
	danger: '#dc2626',
	slate: '#64748b',
} as const;

export const CHART_GRID = {
	strokeDasharray: '3 3',
	opacity: 0.25,
} as const;

export const CHART_MARGINS = {
	compact: { top: 8, right: 12, bottom: 8, left: 0 },
	default: { top: 12, right: 16, bottom: 12, left: 4 },
} as const;

export const CHART_AXIS = {
	tick: { fontSize: 12 },
	tickLine: false,
	axisLine: false,
} as const;

export interface ScoreDomain {
	min: number;
	max: number;
}

export function clampScore(value: number, domain: ScoreDomain = { min: 1, max: 10 }): number {
	return Math.max(domain.min, Math.min(domain.max, value));
}

export default {
	colors: CHART_COLORS,
	grid: CHART_GRID,
	margins: CHART_MARGINS,
	axis: CHART_AXIS,
	clampScore,
};
