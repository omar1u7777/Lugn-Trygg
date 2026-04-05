import React, { useState, useEffect } from 'react';
import oauthHealthService, { OAuthStatus, OAuthProvider } from '../../services/oauthHealthService';
import { useAuth } from '../../contexts/AuthContext';
import SyncHistory from './SyncHistory';
import { LazyHealthDataCharts as HealthDataCharts } from '../Charts/LazyChartWrapper';
import { logger } from '../../utils/logger';


interface AnalysisResult {
    status: string;
    patterns: string[];
    recommendations: string[];
    mood_average?: number;
    mood_trend?: string;
    health_summary?: Record<string, unknown>;
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
         
    }, [user]);

    const loadAllStatuses = async () => {
        try {
            const allStatuses = await oauthHealthService.checkAllStatuses();
            setStatuses(allStatuses);
        } catch (err: unknown) {
            logger.error('Failed to load OAuth statuses:', err);
        }
    };

    const handleConnect = async (providerId: string) => {
        setError(null);
        setSuccess(null);
        setLoading(prev => new Map(prev).set(providerId, true));

        try {
            await oauthHealthService.connectProvider(providerId);
            await loadAllStatuses();
            setSuccess(`✅ Ansluten till ${providerId}!`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : `Kunde inte ansluta till ${providerId}`;
            setError(errorMessage);
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
            setSuccess(`Frånkopplad från ${providerId}.`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : `Kunde inte koppla från ${providerId}`;
            setError(errorMessage);
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
            logger.debug('Synced health data:', healthData);
            
            // Check if any data was returned
            if (!healthData || Object.keys(healthData).length === 0) {
                setError(`Ingen hälsodata hittades för ${providerId}. Möjliga orsaker:\n• Ingen data registrerad de senaste 7 dagarna\n• Enheten är inte kopplad till ditt konto\n• Problem med API-behörighet`);
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
                    
                setSuccess(`✅ Data synkad från ${providerId}!\n${dataDisplay}`);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : `Kunde inte synkronisera data från ${providerId}`;
            setError(errorMessage);
        } finally {
            setSyncing(prev => new Map(prev).set(providerId, false));
        }
    };

    const handleAnalyze = async () => {
        setError(null);
        setSuccess(null);
        setAnalyzing(true);

        try {
            const { default: api } = await import('../../api/client');
            const { API_ENDPOINTS } = await import('../../api/constants');
            const response = await api.post(API_ENDPOINTS.INTEGRATION.HEALTH_ANALYZE);
            const result: AnalysisResult = response.data?.data || response.data;
            setAnalysisResult(result);
            
            if (result.status === 'insufficient_data') {
                setError(`Not enough data for analysis: ${result.message}`);
            } else if (result.status === 'success') {
                setSuccess('✅ Analys genomförd!');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Kunde inte analysera hälsodata';
            setError(errorMessage);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    🔗 Hälsointegreringar (OAuth)
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                    Anslut dina hälsoenheter och appar för att synkronisera data automatiskt.
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
                                                ✓ Ansluten
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
                                        {isSyncing ? '⏳ Synkroniserar...' : '🔄 Synkronisera nu'}
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
                                        Beviljade behörigheter:
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
                                    <p>Ansluten: {new Date(status.obtained_at).toLocaleString('sv-SE')}</p>
                                    {status.expires_at && (
                                        <p>Löper ut: {new Date(status.expires_at).toLocaleString('sv-SE')}</p>
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
                                        {isLoading ? '⏳ Kopplar från...' : '🔌 Koppla från'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(provider.id)}
                                        disabled={isLoading}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? '⏳ Ansluter...' : '🔗 Anslut'}
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
                    ℹ️ Hur OAuth-integration fungerar
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                    <li>✅ Klicka på ”Anslut” för att godkänna åtkomst till din hälsodata</li>
                    <li>✅ Du omdirigeras till leverantörens godkännandesida</li>
                    <li>✅ Godkänn behörigheter och du omdirigeras tillbaka</li>
                    <li>✅ Din data synkroniseras automatiskt var 24:e timme</li>
                    <li>✅ Du kan manuellt synkronisera när som helst via ”Synkronisera nu”</li>
                    <li>✅ Koppla från när som helst för att återkalla åtkomst</li>
                </ul>
            </div>

            {/* Why Connect Section */}
            <div className="mt-8 bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
                    🎯 Varför ansluta din hälsodata?
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-green-800 dark:text-green-200 text-sm">
                    <div>
                        <p className="font-medium mb-2">📊 Bättre hälsoinsikter</p>
                        <p className="text-green-700 dark:text-green-300">Spåra din dagliga aktivitet, hjärtfrekvens, sömnmönster och kalorier direkt från dina bärbara enheter.</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">🧠 Koppling till mental hälsa</p>
                        <p className="text-green-700 dark:text-green-300">Kombinera fysisk hälsodata med din humörspårning för att hitta mönster mellan träning, sömn och mående.</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">📈 AI-driven analys</p>
                        <p className="text-green-700 dark:text-green-300">Vår AI analyserar din hälsodata och ger personliga rekommendationer för stresshantering och bättre sömn.</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">🔄 Automatisk synkronisering</p>
                        <p className="text-green-700 dark:text-green-300">Data synkroniseras automatiskt från dina enheter var 24:e timme, så du alltid har den senaste informationen.</p>
                    </div>
                </div>
            </div>

            {/* AI Analysis Section */}
            <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            🧠 Hälso- och humöranalys
                        </h3>
                        <p className="text-purple-800 dark:text-purple-200 text-sm">
                            Klicka för att analysera samband mellan din hälsodata och ditt humör
                        </p>
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                    >
                        {analyzing ? '⏳ Analyserar...' : '🔬 Analysera nu'}
                    </button>
                </div>

                {/* Analysis Results */}
                {analysisResult && (
                    <div className="mt-4 space-y-4">
                        {/* Status */}
                        {analysisResult.status === 'insufficient_data' && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                                <p className="text-yellow-800 dark:text-yellow-200">
                                    ℹ️ {analysisResult.message || 'Behöver mer data för att analysera'}
                                </p>
                            </div>
                        )}

                        {/* Mood Summary */}
                        {analysisResult.mood_average !== undefined && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">😊 Humörsammanfattning</p>
                                <div className="flex items-center space-x-4">
                                    <div>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">Snitthumör: <span className="font-bold text-lg">{analysisResult.mood_average.toFixed(1)}/10</span></p>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">Trend: <span className="font-semibold">{analysisResult.mood_trend === 'improving' ? '📈 Förbättrar sig' : analysisResult.mood_trend === 'declining' ? '📉 Försämrar sig' : '➡️ Stabil'}</span></p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Health Summary */}
                        {analysisResult.health_summary && Object.keys(analysisResult.health_summary).length > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="font-medium text-green-900 dark:text-green-100 mb-2">💚 Hälsosammanfattning</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {analysisResult.health_summary.avg_steps && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Genomsn. steg: <span className="font-semibold">{analysisResult.health_summary.avg_steps}</span></p>
                                            <p className="text-xs text-green-700 dark:text-green-300">Status: {analysisResult.health_summary.steps_status === 'good' ? '✅ Bra' : '⚠️ Lågt'}</p>
                                        </div>
                                    )}
                                    {analysisResult.health_summary.avg_sleep && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Genomsn. sömn: <span className="font-semibold">{analysisResult.health_summary.avg_sleep}h</span></p>
                                            <p className="text-xs text-green-700 dark:text-green-300">Status: {analysisResult.health_summary.sleep_status === 'good' ? '✅ Bra' : '⚠️ Kontrollera'}</p>
                                        </div>
                                    )}
                                    {analysisResult.health_summary.avg_hr && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Genomsn. puls: <span className="font-semibold">{analysisResult.health_summary.avg_hr}</span> bpm</p>
                                            <p className="text-xs text-green-700 dark:text-green-300">Status: {analysisResult.health_summary.hr_status === 'good' ? '✅ Normalt' : '⚠️ Förhöjd'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Patterns Found */}
                        {analysisResult.patterns && analysisResult.patterns.length > 0 && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                                <p className="font-medium text-indigo-900 dark:text-indigo-100 mb-3">🔍 Hittade mönster</p>
                                <div className="space-y-2">
                                    {analysisResult.patterns.map((pattern, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 rounded p-3 border-l-4 border-indigo-500">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{pattern.title}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">{pattern.description}</p>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Påverkan: {pattern.impact === 'high' ? '🔴 Hög' : '🟡 Medel'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                                <p className="font-medium text-orange-900 dark:text-orange-100 mb-3">💡 Personliga rekommendationer</p>
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
                    ⚠️ Ingen data efter synkronisering?
                </h3>
                <p className="text-orange-800 dark:text-orange-200 mb-3">
                    Om du inte ser hälsodata efter synkronisering finns det några vanliga orsaker:
                </p>
                <ul className="space-y-2 text-orange-800 dark:text-orange-200 text-sm">
                    <li>📱 <strong>Enheten inte ansluten:</strong> Kontrollera att din tränare eller smartklocka är ansluten till appen och synkad med ditt konto.</li>
                    <li>📅 <strong>Ingen ny data:</strong> Hälsoplattformar delar bara data du registrerat. Om inget spårats de senaste 7 dagarna visas ingen data.</li>
                    <li>🔐 <strong>Behörigheter saknas:</strong> Vissa appar kräver specifika behörigheter. Kontrollera att du godkänt all åtkomst.</li>
                    <li>⏱️ <strong>Första synken tar tid:</strong> Den första synkroniseringen kan ta 1–2 minuter. Försök igen efter en stund.</li>
                    <li>🔄 <strong>Försök att återansluta:</strong> Klicka på ”Koppla från” och sedan ”Anslut” igen för att uppdatera auktoriseringen.</li>
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
                    ⚙️ OAuth-konfiguration krävs
                </h3>
                <p className="text-yellow-800 dark:text-yellow-200 mb-4">
                    För att OAuth ska fungera i produktion måste du konfigurera credentials i Backend/.env:
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
