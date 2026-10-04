import React, { useState, useEffect } from 'react';
import oauthHealthService, { OAuthStatus, OAuthProvider } from '../../services/oauthHealthService';
import { useAuth } from '../../contexts/AuthContext';
import SyncHistory from './SyncHistory';
import { LazyHealthDataCharts as HealthDataCharts } from '../Charts/LazyChartWrapper';
import { logger } from '../../utils/logger';
import { analyzeHealthMoodPatterns, type HealthMoodAnalysisResult } from '../../api/integrations';


import { useTranslation } from 'react-i18next';

const OAuthHealthIntegrations: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const [providers] = useState<OAuthProvider[]>(oauthHealthService.getSupportedProviders());
    const [statuses, setStatuses] = useState<Map<string, OAuthStatus>>(new Map());
    const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
    const [syncing, setSyncing] = useState<Map<string, boolean>>(new Map());
    const [analyzing, setAnalyzing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<HealthMoodAnalysisResult | null>(null);

    const loadAllStatuses = async () => {
        try {
            const allStatuses = await oauthHealthService.checkAllStatuses();
            setStatuses(allStatuses);
        } catch (err: unknown) {
            logger.error('Failed to load OAuth statuses:', err);
        }
    };

    useEffect(() => {
        if (user?.user_id) {
            loadAllStatuses();
        }
         
    }, [user]);

    const handleConnect = async (providerId: string) => {
        setError(null);
        setSuccess(null);
        setLoading(prev => new Map(prev).set(providerId, true));

        try {
            await oauthHealthService.connectProvider(providerId);
            await loadAllStatuses();
            setSuccess(t('healthIntegrations.connected', '✅ Ansluten till {{provider}}!', { provider: providerId }));
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
            setSuccess(t('healthIntegrations.disconnected', 'Frånkopplad från {{provider}}.', { provider: providerId }));
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('healthIntegrations.disconnectFailed', 'Kunde inte koppla från {{provider}}', { provider: providerId });
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
                setError(t('healthIntegrations.noDataFound', 'Ingen hälsodata hittades för {{provider}}. Möjliga orsaker:\n• Ingen data registrerad de senaste 7 dagarna\n• Enheten är inte kopplad till ditt konto\n• Problem med API-behörighet', { provider: providerId }));
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
                    
                setSuccess(`${t('healthIntegrations.dataSynced', '✅ Data synkad från {{provider}}!', { provider: providerId })}\n${dataDisplay}`);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('healthIntegrations.syncFailed', 'Kunde inte synkronisera data från {{provider}}', { provider: providerId });
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
            const result = await analyzeHealthMoodPatterns();
            setAnalysisResult(result);
            
            if (result.status === 'insufficient_data') {
                setError(`Not enough data for analysis: ${result.message}`);
            } else if (result.status === 'success') {
                setSuccess(t('healthIntegrations.analysisDone', '✅ Analys genomförd!'));
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('healthIntegrations.analysisFailed', 'Kunde inte analysera hälsodata');
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
                    🔗 {t('healthIntegrations.title', 'Hälsointegreringar (OAuth)')}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                    {t('healthIntegrations.subtitle', 'Anslut dina hälsoenheter och appar för att synkronisera data automatiskt.')}
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
                                        {isSyncing ? t('healthIntegrations.syncing', '⏳ Synkroniserar...') : t('healthIntegrations.syncNow', '🔄 Synkronisera nu')}
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
                                        {t('healthIntegrations.grantedScopes', 'Beviljade behörigheter:')}
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
                                    <p>{t('healthIntegrations.connectedAt', 'Ansluten: {{date}}', { date: new Date(status.obtained_at).toLocaleString(i18n.language) })}</p>
                                    {status.expires_at && (
                                        <p>{t('healthIntegrations.expiresAt', 'Löper ut: {{date}}', { date: new Date(status.expires_at).toLocaleString(i18n.language) })}</p>
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
                                        {isLoading ? t('healthIntegrations.disconnecting', '⏳ Kopplar från...') : t('healthIntegrations.disconnect', '🔌 Koppla från')}
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
                    ℹ️ {t('healthIntegrations.howItWorks', 'Hur OAuth-integration fungerar')}
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                    <li>✅ {t('healthIntegrations.steps.connect', 'Klicka på ”Anslut” för att godkänna åtkomst till din hälsodata')}</li>
                    <li>✅ {t('healthIntegrations.steps.redirect', 'Du omdirigeras till leverantörens godkännandesida')}</li>
                    <li>✅ {t('healthIntegrations.steps.approve', 'Godkänn behörigheter och du omdirigeras tillbaka')}</li>
                    <li>✅ {t('healthIntegrations.steps.autoSync', 'Din data synkroniseras automatiskt var 24:e timme')}</li>
                    <li>✅ {t('healthIntegrations.steps.manualSync', 'Du kan manuellt synkronisera när som helst via ”Synkronisera nu”')}</li>
                    <li>✅ {t('healthIntegrations.steps.revoke', 'Koppla från när som helst för att återkalla åtkomst')}</li>
                </ul>
            </div>

            {/* Why Connect Section */}
            <div className="mt-8 bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
                    🎯 {t('healthIntegrations.whyConnect', 'Varför ansluta din hälsodata?')}
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-green-800 dark:text-green-200 text-sm">
                    <div>
                        <p className="font-medium mb-2">📊 {t('healthIntegrations.benefits.insights', 'Bättre hälsoinsikter')}</p>
                        <p className="text-green-700 dark:text-green-300">{t('healthIntegrations.benefits.insightsBody', 'Spåra din dagliga aktivitet, hjärtfrekvens, sömnmönster och kalorier direkt från dina bärbara enheter.')}</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">🧠 {t('healthIntegrations.benefits.mental', 'Koppling till mental hälsa')}</p>
                        <p className="text-green-700 dark:text-green-300">{t('healthIntegrations.benefits.mentalBody', 'Kombinera fysisk hälsodata med din humörspårning för att hitta mönster mellan träning, sömn och mående.')}</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">📈 AI-driven analys</p>
                        <p className="text-green-700 dark:text-green-300">{t('healthIntegrations.benefits.aiBody', 'Vår AI analyserar din hälsodata och ger personliga rekommendationer för stresshantering och bättre sömn.')}</p>
                    </div>
                    <div>
                        <p className="font-medium mb-2">🔄 {t('healthIntegrations.benefits.autoSync', 'Automatisk synkronisering')}</p>
                        <p className="text-green-700 dark:text-green-300">{t('healthIntegrations.benefits.autoSyncBody', 'Data synkroniseras automatiskt från dina enheter var 24:e timme, så du alltid har den senaste informationen.')}</p>
                    </div>
                </div>
            </div>

            {/* AI Analysis Section */}
            <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            🧠 {t('healthIntegrations.analysisTitle', 'Hälso- och humöranalys')}
                        </h3>
                        <p className="text-purple-800 dark:text-purple-200 text-sm">
                            {t('healthIntegrations.analysisBody', 'Klicka för att analysera samband mellan din hälsodata och ditt humör')}
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
                                    ℹ️ {analysisResult.message || t('healthIntegrations.needMoreData', 'Behöver mer data för att analysera')}
                                </p>
                            </div>
                        )}

                        {/* Mood Summary */}
                        {analysisResult.mood_average !== undefined && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">😊 {t('healthIntegrations.moodSummary', 'Humörsammanfattning')}</p>
                                <div className="flex items-center space-x-4">
                                    <div>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">{t('healthIntegrations.avgMood', 'Snitthumör:')} <span className="font-bold text-lg">{analysisResult.mood_average.toFixed(1)}/10</span></p>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">{t('healthIntegrations.trend', 'Trend:')} <span className="font-semibold">{analysisResult.mood_trend === 'improving' ? t('healthIntegrations.trendUp', '📈 Förbättrar sig') : analysisResult.mood_trend === 'declining' ? t('healthIntegrations.trendDown', '📉 Försämrar sig') : t('healthIntegrations.trendStable', '➡️ Stabil')}</span></p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Health Summary */}
                        {analysisResult.health_summary && Object.keys(analysisResult.health_summary).length > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="font-medium text-green-900 dark:text-green-100 mb-2">💚 {t('healthIntegrations.healthSummary', 'Hälsosammanfattning')}</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {analysisResult.health_summary.avg_steps && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Genomsn. steg: <span className="font-semibold">{analysisResult.health_summary.avg_steps}</span></p>
                                            <p className="text-xs text-green-700 dark:text-green-300">{t('healthIntegrations.status', 'Status:')} {analysisResult.health_summary.steps_status === 'good' ? t('healthIntegrations.statusGood', '✅ Bra') : t('healthIntegrations.statusLow', '⚠️ Lågt')}</p>
                                        </div>
                                    )}
                                    {analysisResult.health_summary.avg_sleep && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">{t('healthIntegrations.avgSleep', 'Genomsn. sömn:')} <span className="font-semibold">{analysisResult.health_summary.avg_sleep}h</span></p>
                                            <p className="text-xs text-green-700 dark:text-green-300">{t('healthIntegrations.status', 'Status:')} {analysisResult.health_summary.sleep_status === 'good' ? t('healthIntegrations.statusGood', '✅ Bra') : t('healthIntegrations.statusCheck', '⚠️ Kontrollera')}</p>
                                        </div>
                                    )}
                                    {analysisResult.health_summary.avg_hr && (
                                        <div>
                                            <p className="text-green-800 dark:text-green-200">Genomsn. puls: <span className="font-semibold">{analysisResult.health_summary.avg_hr}</span> bpm</p>
                                            <p className="text-xs text-green-700 dark:text-green-300">{t('healthIntegrations.status', 'Status:')} {analysisResult.health_summary.hr_status === 'good' ? t('healthIntegrations.statusNormal', '✅ Normalt') : t('healthIntegrations.statusHigh', '⚠️ Förhöjd')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Patterns Found */}
                        {analysisResult.patterns && analysisResult.patterns.length > 0 && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                                <p className="font-medium text-indigo-900 dark:text-indigo-100 mb-3">🔍 {t('healthIntegrations.patternsFound', 'Hittade mönster')}</p>
                                <div className="space-y-2">
                                    {analysisResult.patterns.map((pattern, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 rounded p-3 border-l-4 border-indigo-500">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{pattern.title}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">{pattern.description}</p>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{t('healthIntegrations.impact', 'Påverkan:')} {pattern.impact === 'high' ? t('healthIntegrations.impactHigh', '🔴 Hög') : t('healthIntegrations.impactMedium', '🟡 Medel')}</p>
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
                    {t('healthIntegrations.troubleshootIntro', 'Om du inte ser hälsodata efter synkronisering finns det några vanliga orsaker:')}
                </p>
                <ul className="space-y-2 text-orange-800 dark:text-orange-200 text-sm">
                    <li>📱 <strong>{t('healthIntegrations.trouble.deviceTitle', 'Enheten inte ansluten:')}</strong> {t('healthIntegrations.trouble.deviceBody', 'Kontrollera att din tränare eller smartklocka är ansluten till appen och synkad med ditt konto.')}</li>
                    <li>📅 <strong>{t('healthIntegrations.trouble.noDataTitle', 'Ingen ny data:')}</strong> {t('healthIntegrations.trouble.noDataBody', 'Hälsoplattformar delar bara data du registrerat. Om inget spårats de senaste 7 dagarna visas ingen data.')}</li>
                    <li>🔐 <strong>{t('healthIntegrations.trouble.scopesTitle', 'Behörigheter saknas:')}</strong> {t('healthIntegrations.trouble.scopesBody', 'Vissa appar kräver specifika behörigheter. Kontrollera att du godkänt all åtkomst.')}</li>
                    <li>⏱️ <strong>{t('healthIntegrations.trouble.firstSyncTitle', 'Första synken tar tid:')}</strong> {t('healthIntegrations.trouble.firstSyncBody', 'Den första synkroniseringen kan ta 1–2 minuter. Försök igen efter en stund.')}</li>
                    <li>🔄 <strong>{t('healthIntegrations.trouble.reconnectTitle', 'Försök att återansluta:')}</strong> {t('healthIntegrations.trouble.reconnectBody', 'Klicka på ”Koppla från” och sedan ”Anslut” igen för att uppdatera auktoriseringen.')}</li>
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
                        📊 {t('healthIntegrations.charts', 'Hälsodata visualisering')}
                    </h3>
                    <HealthDataCharts userId={user.user_id} />
                </div>
            )}

        </div>
    );
};

export default OAuthHealthIntegrations;
