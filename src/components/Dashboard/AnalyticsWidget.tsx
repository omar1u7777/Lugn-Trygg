import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

interface AnalyticsWidgetProps {
    userId: string;
}

interface ForecastData {
    forecast: {
        average_forecast: number;
        trend: string;
    };
    current_analysis: {
        recent_average: number;
    };
    confidence: number;
}

const AnalyticsWidget: React.FC<AnalyticsWidgetProps> = ({ userId }) => {
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState<ForecastData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchAnalytics();
        }
    }, [userId]);

    const fetchAnalytics = async () => {
        try {
            const response = await api.get('/api/mood/predictive-forecast?days_ahead=7');
            setAnalytics(response.data);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'improving':
                return 'from-green-500 to-emerald-600';
            case 'declining':
                return 'from-red-500 to-rose-600';
            default:
                return 'from-blue-500 to-cyan-600';
        }
    };

    const getTrendEmoji = (trend: string) => {
        switch (trend) {
            case 'improving':
                return '📈';
            case 'declining':
                return '📉';
            default:
                return '📊';
        }
    };

    const getTrendLabel = (trend: string) => {
        switch (trend) {
            case 'improving':
                return 'Förbättras';
            case 'declining':
                return 'Minskar';
            default:
                return 'Stabil';
        }
    };

    const getMoodLabel = (score: number) => {
        if (score > 0.2) return 'Positivt';
        if (score < -0.2) return 'Negativt';
        return 'Neutralt';
    };

    const getMoodColor = (score: number) => {
        if (score > 0.2) return 'text-green-600 dark:text-green-400';
        if (score < -0.2) return 'text-red-600 dark:text-red-400';
        return 'text-yellow-600 dark:text-yellow-400';
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 shadow-lg animate-pulse">
                <div className="h-8 bg-indigo-200 dark:bg-indigo-700 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-indigo-100 dark:bg-indigo-800 rounded w-3/4"></div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 shadow-lg border border-indigo-100 dark:border-indigo-800">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-3xl">📊</span>
                    <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                        Analytics
                    </h3>
                </div>
                <p className="text-indigo-700 dark:text-indigo-300 text-sm mb-4">
                    Logga ditt humör för att få AI-drivna insikter
                </p>
                <button
                    onClick={() => navigate('/analytics')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
                >
                    Se Analytics
                </button>
            </div>
        );
    }

    const trendGradient = getTrendColor(analytics.forecast.trend);

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xl">📊</span>
                        <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                            Analytics
                        </h3>
                    </div>
                    <p className="text-indigo-700 dark:text-indigo-300 text-sm">
                        AI-drivna humörprognoser
                    </p>
                </div>
            </div>

            {/* Current Mood */}
            <div className="bg-white dark:bg-indigo-900/30 rounded-lg p-4 mb-3">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-indigo-600 dark:text-indigo-400">Nuvarande humör</span>
                    <span className={`text-lg font-bold ${getMoodColor(analytics.current_analysis.recent_average)}`}>
                        {getMoodLabel(analytics.current_analysis.recent_average)}
                    </span>
                </div>
                <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                    {analytics.current_analysis.recent_average.toFixed(2)}
                </div>
            </div>

            {/* Forecast Trend */}
            <div className={`bg-gradient-to-r ${trendGradient} rounded-lg p-4 mb-3 text-white`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm opacity-90">7-dagars prognos</span>
                    <span className="text-2xl">{getTrendEmoji(analytics.forecast.trend)}</span>
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-2xl font-bold">
                            {analytics.forecast.average_forecast.toFixed(2)}
                        </div>
                        <div className="text-sm opacity-90">
                            Trend: {getTrendLabel(analytics.forecast.trend)}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm opacity-90">Säkerhet</div>
                        <div className="text-lg font-semibold">
                            {(analytics.confidence * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={() => navigate('/analytics')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
                <span>📈</span>
                <span>Detaljerad analys</span>
            </button>
        </div>
    );
};

export default AnalyticsWidget;
