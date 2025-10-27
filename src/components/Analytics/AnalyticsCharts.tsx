import React from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface AnalyticsChartsProps {
    dailyPredictions: number[];
    confidenceInterval: {
        lower: number;
        upper: number;
    };
    historicalData?: { date: string; score: number }[];
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
    dailyPredictions,
    confidenceInterval,
    historicalData = [],
}) => {
    // Prepare data for charts
    const forecastData = dailyPredictions.map((prediction, index) => ({
        day: `Dag ${index + 1}`,
        prognos: prediction,
        övre: prediction + (confidenceInterval.upper - prediction),
        nedre: prediction - (prediction - confidenceInterval.lower),
    }));

    return (
        <div className="space-y-6">
            {/* Forecast Line Chart with Confidence Interval */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <span>📈</span>
                    7-dagars Humörprognos
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={forecastData}>
                        <defs>
                            <linearGradient id="colorPrognos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#93C5FD" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#93C5FD" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                            dataKey="day"
                            stroke="#6B7280"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#6B7280"
                            style={{ fontSize: '12px' }}
                            domain={[-1, 1]}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '10px',
                            }}
                        />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="övre"
                            stroke="#93C5FD"
                            fill="url(#colorConfidence)"
                            name="Osäkerhetsintervall (övre)"
                        />
                        <Area
                            type="monotone"
                            dataKey="prognos"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            fill="url(#colorPrognos)"
                            name="Prognos"
                        />
                        <Area
                            type="monotone"
                            dataKey="nedre"
                            stroke="#93C5FD"
                            fill="url(#colorConfidence)"
                            name="Osäkerhetsintervall (nedre)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
                    Blå linje visar prognostiserat humör, ljusblå område visar osäkerhetsmarginal
                </p>
            </div>

            {/* Daily Predictions Bar Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <span>📊</span>
                    Dagliga Humörvärden
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={forecastData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                            dataKey="day"
                            stroke="#6B7280"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#6B7280"
                            style={{ fontSize: '12px' }}
                            domain={[-1, 1]}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '10px',
                            }}
                        />
                        <Legend />
                        <Bar
                            dataKey="prognos"
                            fill="#3B82F6"
                            name="Prognos"
                            radius={[8, 8, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Historical Data Line Chart (if available) */}
            {historicalData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <span>📉</span>
                        Historiskt Humör (30 dagar)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={historicalData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis
                                dataKey="date"
                                stroke="#6B7280"
                                style={{ fontSize: '10px' }}
                            />
                            <YAxis
                                stroke="#6B7280"
                                style={{ fontSize: '12px' }}
                                domain={[-1, 1]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '8px',
                                    padding: '10px',
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke="#8B5CF6"
                                strokeWidth={2}
                                dot={{ fill: '#8B5CF6', r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Humör"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default AnalyticsCharts;
