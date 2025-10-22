import React, { useState, useEffect } from 'react';
import oauthHealthService, { OAuthStatus, OAuthProvider } from '../../services/oauthHealthService';
import { useAuth } from '../../contexts/AuthContext';
import SyncHistory from './SyncHistory';
import HealthDataCharts from './HealthDataCharts';

interface AnalysisResult {
    status: string;
    patterns: any[];
    recommendations: any[];
    mood_average?: number;
    mood_trend?: string;
    health_summary?: any;
    message?: string;
}

const OAuthHealthIntegrations: React.FC = () => {
    const { user } = useAuth();
    const [providers] = useState<OAuthProvider[]>(oauthHealthService.getSupportedProviders());
    const [statuses, setStatuses] = useState<Map<string, OAuthStatus>>(new Map());
    const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
    const [syncing, setSyncing] = useState<Map<string, boolean>>(new Map());
    const [analyzing, setAnalyzing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    useEffect(() => {
        if (user?.user_id) {
            loadAllStatuses();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const loadAllStatuses = async () => {
        try {
            const allStatuses = await oauthHealthService.checkAllStatuses();
            setStatuses(allStatuses);
        } catch (err: any) {
            console.error('Failed to load OAuth statuses:', err);
        }
    };

    const handleConnect = async (providerId: string) => {
        setError(null);
        setSuccess(null);
        setLoading(prev => new Map(prev).set(providerId, true));

        try {
            await oauthHealthService.connectProvider(providerId);
            await loadAllStatuses();
            setSuccess(`Successfully connected to ${providerId}!`);
        } catch (err: any) {
            setError(err.message || `Failed to connect to ${providerId}`);
        } finally {
            setLoading(prev => new Map(prev).set(providerId, false));
        }
    };

    const handleDisconnect = async (providerId: string) => {
        setError(null);
        setSuccess(null);
        setLoading(prev => new Map(prev).set(providerId, true));

        try {
            await oauthHealthService.disconnect(providerId);
            await loadAllStatuses();
            setSuccess(`Successfully disconnected from ${providerId}`);
        } catch (err: any) {
            setError(err.message || `Failed to disconnect from ${providerId}`);
        } finally {
            setLoading(prev => new Map(prev).set(providerId, false));
        }
    };

    const handleSync = async (providerId: string) => {
        setError(null);
        setSuccess(null);
        setSyncing(prev => new Map(prev).set(providerId, true));

        try {
            const healthData = await oauthHealthService.syncHealthData(providerId, 7);
            console.log('Synced health data:', healthData);
            
            // Check if any data was returned
            if (!healthData || Object.keys(healthData).length === 0) {
                setError(`No health data found for ${providerId}. This could mean:\n• No data recorded in the last 7 days\n• Device not connected to your account\n• API permission issue`);
            } else {
                // Format the data for display
                const dataDisplay = Object.entries(healthData)
                    .map(([key, value]) => {
                        if (typeof value === 'number') {
                            return `${key}: ${value}`;
                        }
                        return `${key}: ${JSON.stringify(value)}`;
                    })
                    .join(', ');
                    
                setSuccess(`✅ Successfully synced data from ${providerId}!\n${dataDisplay}`);
            }
        } catch (err: any) {
            setError(err.message || `Failed to sync data from ${providerId}`);
        } finally {
            setSyncing(prev => new Map(prev).set(providerId, false));
        }
    };

    const handleAnalyze = async () => {
        setError(null);
        setSuccess(null);
        setAnalyzing(true);

        try {
            const response = await fetch('/api/integration/health/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const result: AnalysisResult = await response.json();
            setAnalysisResult(result);
            
            if (result.status === 'insufficient_data') {
                setError(`Not enough data for analysis: ${result.message}`);
            } else if (result.status === 'success') {
                setSuccess('✅ Analysis completed successfully!');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to analyze health data');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    🔗 Health Integrations (OAuth)
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                    Connect your health devices and apps to sync real data automatically
                </p>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-red-800 dark:text-red-200">❌ {error}</p>
                </div>
            )}

            {success && (
                <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <p className="text-green-800 dark:text-green-200">✅ {success}</p>
                </div>
            )}

            {/* Providers Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                {providers.map((provider) => {
                    const status = statuses.get(provider.id) || { connected: false, provider: provider.id };
                    const isLoading = loading.get(provider.id) || false;
                    const isSyncing = syncing.get(provider.id) || false;
                    const isConnected = status.connected && !status.is_expired;

                    return (
                        <div
                            key={provider.id}
                            className={`bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border-2 transition-all ${
                                isConnected
                                    ? 'border-green-500 dark:border-green-600'
                                    : 'border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            {/* Provider Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <span className="text-4xl">{provider.icon}</span>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                            {provider.name}
                                        </h3>
                                        {isConnected && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                                ✓ Connected
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isConnected && (
                                    <button
                                        onClick={() => handleSync(provider.id)}
                                        disabled={isSyncing}
                                        className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                                    >
                                        {isSyncing ? '⏳ Syncing...' : '🔄 Sync Now'}
                                    </button>
                                )}
                            </div>

                            {/* Description */}
                            <p className="text-slate-600 dark:text-slate-400 mb-4">
                                {provider.description}
                            </p>

                            {/* Scopes */}
                            {status.connected && status.scope && (
                                <div className="mb-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                                        Authorized Scopes:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {status.scope.split(' ').map((scope, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded"
                                            >
                                                {scope}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Connection Info */}
                            {isConnected && status.obtained_at && (
                                <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                                    <p>Connected: {new Date(status.obtained_at).toLocaleString()}</p>
                                    {status.expires_at && (
                                        <p>Expires: {new Date(status.expires_at).toLocaleString()}</p>
                                    )}
                                </div>
                            )}

                            {/* Action Button */}
                            <div className="flex space-x-3">
                                {isConnected ? (
                                    <button
                                        onClick={() => handleDisconnect(provider.id)}
                                        disabled={isLoading}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? '⏳ Disconnecting...' : '🔌 Disconnect'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(provider.id)}
                                        disabled={isLoading}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? '⏳ Connecting...' : '🔗 Connect'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info Box */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    ℹ️ How OAuth Integration Works
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                    <li>✅ Click "Connect" to authorize access to your health data</li>
                    <li>✅ You'll be redirected to the provider's authorization page</li>
                    <li>✅ Grant permissions and you'll be redirected back</li>
                    <li>✅ Your data will sync automatically every 24 hours</li>
                    <li>✅ You can manually sync anytime by clicking "Sync Now"</li>
                    <li>✅ Disconnect anytime to revoke access</li>
                </ul>
            </div>

            {/* Why Connect Section */}
            <div className="mt-8 bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
                    🎯 Why Connect Your Health Data?
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-green-800 dark:text-green-200 text-sm">
                    <div>
                        <p className="font-medium mb-2">📊 Better Health Insights</p>
                        <p className="text-green-700 dark:text-green-300">Track your daily activity, heart rate, sleep patterns, and calories burned directly from your wearables.</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">🧠 Mental Health Connection</p>
                        <p className="text-green-700 dark:text-green-300">Combine physical health data with your mood tracking to discover patterns between exercise, sleep, and emotional wellness.</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">📈 AI-Powered Analysis</p>
                        <p className="text-green-700 dark:text-green-300">Our AI analyzes your health data to provide personalized recommendations for stress reduction and better sleep.</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">🔄 Automatic Sync</p>
                        <p className="text-green-700 dark:text-green-300">Data syncs automatically from your devices every 24 hours, so you always have your latest information.</p>
                    </div>
                </div>
            </div>

            {/* AI Analysis Section */}
            <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            🧠 Health & Mood Analysis
                        </h3>
                        <p className="text-purple-800 dark:text-purple-200 text-sm">
                            Click analyze to discover patterns between your health metrics and mood
                        </p>
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                    >
                        {analyzing ? '⏳ Analyzing...' : '🔬 Analyze Now'}
                    </button>
                </div>

                {/* Analysis Results */}
                {analysisResult && (
                    <div className="mt-4 space-y-4">
                        {/* Status */}
                        {analysisResult.status === 'insufficient_data' && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                                <p className="text-yellow-800 dark:text-yellow-200">
                                    ℹ️ {analysisResult.message || 'Need more data to analyze'}
                                </p>
                            </div>
                        )}

                        {/* Mood Summary */}
                        {analysisResult.mood_average !== undefined && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">😊 Mood Summary</p>
                                <div className="flex items-center space-x-4">
                                    <div>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">Average Mood: <span className="font-bold text-lg">{analysisResult.mood_average.toFixed(1)}/10</span></p>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">Trend: <span className="font-semibold">{analysisResult.mood_trend === 'improving' ? '📈 Improving' : analysisResult.mood_trend === 'declining' ? '📉 Declining' : '➡️ Stable'}</span></p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Health Summary */}
                        {analysisResult.health_summary && Object.keys(analysisResult.health_summary).length > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="font-medium text-green-900 dark:text-green-100 mb-2">💚 Health Summary</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {analysisResult.health_summary.avg_steps && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Avg Steps: <span className="font-semibold">{analysisResult.health_summary.avg_steps}</span></p>
                                            <p className="text-xs text-green-700 dark:text-green-300">Status: {analysisResult.health_summary.steps_status === 'good' ? '✅ Good' : '⚠️ Low'}</p>
                                        </div>
                                    )}
                                    {analysisResult.health_summary.avg_sleep && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Avg Sleep: <span className="font-semibold">{analysisResult.health_summary.avg_sleep}h</span></p>
                                            <p className="text-xs text-green-700 dark:text-green-300">Status: {analysisResult.health_summary.sleep_status === 'good' ? '✅ Good' : '⚠️ Check'}</p>
                                        </div>
                                    )}
                                    {analysisResult.health_summary.avg_hr && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Avg HR: <span className="font-semibold">{analysisResult.health_summary.avg_hr}</span> bpm</p>
                                            <p className="text-xs text-green-700 dark:text-green-300">Status: {analysisResult.health_summary.hr_status === 'good' ? '✅ Healthy' : '⚠️ Elevated'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Patterns Found */}
                        {analysisResult.patterns && analysisResult.patterns.length > 0 && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                                <p className="font-medium text-indigo-900 dark:text-indigo-100 mb-3">🔍 Patterns Discovered</p>
                                <div className="space-y-2">
                                    {analysisResult.patterns.map((pattern, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 rounded p-3 border-l-4 border-indigo-500">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{pattern.title}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">{pattern.description}</p>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Impact: {pattern.impact === 'high' ? '🔴 High' : '🟡 Medium'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                                <p className="font-medium text-orange-900 dark:text-orange-100 mb-3">💡 Personalized Recommendations</p>
                                <div className="space-y-2">
                                    {analysisResult.recommendations.map((rec, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 rounded p-3">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.title}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rec.description}</p>
                                            <div className="mt-2 flex items-center justify-between">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">💪 {rec.action}</p>
                                                <span className="text-xs bg-orange-200 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 px-2 py-1 rounded">{rec.expected_benefit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Troubleshooting Section */}
            <div className="mt-8 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3">
                    ⚠️ No Data After Sync?
                </h3>
                <p className="text-orange-800 dark:text-orange-200 mb-3">
                    If you don't see health data after syncing, here are some common reasons:
                </p>
                <ul className="space-y-2 text-orange-800 dark:text-orange-200 text-sm">
                    <li>📱 <strong>Device not connected:</strong> Make sure your fitness tracker or smartwatch is connected to the app and synced with your account.</li>
                    <li>📅 <strong>No recent data:</strong> Health platforms only share data you've recorded. If nothing was recorded in the last 7 days, no data will appear.</li>
                    <li>🔐 <strong>Permissions not granted:</strong> Some apps require specific permissions. Check that you granted all requested access.</li>
                    <li>⏱️ <strong>Initial sync delay:</strong> First sync can take 1-2 minutes. Try again after a short wait.</li>
                    <li>🔄 <strong>Try reconnecting:</strong> Click Disconnect and Connect again to refresh the authorization.</li>
                </ul>
            </div>

            {/* Sync History Section */}
            {user?.user_id && (
                <div className="mt-8">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        📜 Synkroniseringshistorik
                    </h3>
                    <SyncHistory userId={user.user_id} />
                </div>
            )}

            {/* Health Data Charts Section */}
            {user?.user_id && (
                <div className="mt-8">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        📊 Hälsodata visualisering
                    </h3>
                    <HealthDataCharts userId={user.user_id} />
                </div>
            )}

            {/* Setup Guide */}
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
                    ⚙️ OAuth Configuration Required
                </h3>
                <p className="text-yellow-800 dark:text-yellow-200 mb-4">
                    For OAuth to work in production, you need to configure credentials in Backend/.env:
                </p>
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-green-400">
{`# Google Fit OAuth
GOOGLE_FIT_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=your-client-secret

# Fitbit OAuth
FITBIT_CLIENT_ID=your-fitbit-client-id
FITBIT_CLIENT_SECRET=your-fitbit-client-secret

# Samsung Health OAuth
SAMSUNG_HEALTH_CLIENT_ID=your-samsung-client-id
SAMSUNG_HEALTH_CLIENT_SECRET=your-samsung-client-secret`}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default OAuthHealthIntegrations;
