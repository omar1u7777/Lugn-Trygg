export interface AppTheme {
	mode: 'light' | 'dark';
	colors: {
		background: string;
		surface: string;
		surfaceAlt: string;
		textPrimary: string;
		textSecondary: string;
		primary: string;
		success: string;
		warning: string;
		danger: string;
		border: string;
	};
	chart: {
		primary: string;
		secondary: string;
		accent: string;
		success: string;
		warning: string;
		danger: string;
	};
}

export const lightTheme: AppTheme = {
	mode: 'light',
	colors: {
		background: '#f8fafc',
		surface: '#ffffff',
		surfaceAlt: '#f1f5f9',
		textPrimary: '#0f172a',
		textSecondary: '#475569',
		primary: '#2563eb',
		success: '#16a34a',
		warning: '#f59e0b',
		danger: '#dc2626',
		border: '#e2e8f0',
	},
	chart: {
		primary: '#2563eb',
		secondary: '#0ea5e9',
		accent: '#7c3aed',
		success: '#16a34a',
		warning: '#f59e0b',
		danger: '#dc2626',
	},
};

export const darkTheme: AppTheme = {
	mode: 'dark',
	colors: {
		background: '#020617',
		surface: '#0f172a',
		surfaceAlt: '#1e293b',
		textPrimary: '#f8fafc',
		textSecondary: '#cbd5e1',
		primary: '#60a5fa',
		success: '#4ade80',
		warning: '#fbbf24',
		danger: '#f87171',
		border: '#334155',
	},
	chart: {
		primary: '#60a5fa',
		secondary: '#22d3ee',
		accent: '#a78bfa',
		success: '#4ade80',
		warning: '#fbbf24',
		danger: '#f87171',
	},
};

export const themes: Record<'light' | 'dark', AppTheme> = {
	light: lightTheme,
	dark: darkTheme,
};

export default lightTheme;
