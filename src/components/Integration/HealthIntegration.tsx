import React, { useState, useEffect } from 'react';
import healthIntegrationService, { WearableDevice, WearableData } from '../../services/healthIntegrationService';

const HealthIntegration: React.FC = () => {
    const [devices, setDevices] = useState<WearableDevice[]>([]);
    const [wearableData, setWearableData] = useState<WearableData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [connectingDevice, setConnectingDevice] = useState<string | null>(null);

    useEffect(() => {
        loadHealthData();
    }, []);

    const loadHealthData = async () => {
        await Promise.all([
            fetchWearableStatus(),
            fetchWearableData()
        ]);
    };

    const fetchWearableStatus = async () => {
        try {
            setLoading(true);
            const fetchedDevices = await healthIntegrationService.getWearableStatus();
            setDevices(fetchedDevices);
            setError(null);
        } catch (err: any) {
            console.error('❌ Failed to fetch wearable status:', err);
            setError(err.message || 'Failed to load wearable devices');
        } finally {
            setLoading(false);
        }
    };

    const fetchWearableData = async () => {
        try {
            const details = await healthIntegrationService.getWearableDetails();
            if (details.data) {
                setWearableData(details.data);
            }
        } catch (err: any) {
            console.error('❌ Failed to fetch wearable data:', err);
            // Don't set error here as this is non-critical
        }
    };

    const handleSyncWearable = async (deviceId: string) => {
        try {
            setSyncStatus('syncing');
            const data = await healthIntegrationService.syncWearable(deviceId);
            setWearableData(data);
            setSyncStatus('success');
            await fetchWearableStatus();
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err: any) {
            console.error('❌ Failed to sync wearable:', err);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const handleConnectDevice = async (deviceType: string) => {
        try {
            setConnectingDevice(deviceType);
            setError(null);
            const newDevice = await healthIntegrationService.connectDevice(deviceType);
            setDevices([...devices, newDevice]);
            
            // Show success message
            const deviceNames: Record<string, string> = {
                'fitbit': 'Fitbit',
                'apple_health': 'Apple Health',
                'google_fit': 'Google Fit',
                'samsung_health': 'Samsung Health'
            };
            
            alert(`✅ ${deviceNames[deviceType]} ansluten! Du kan nu synkronisera din hälsodata.`);
        } catch (err: any) {
            console.error('❌ Failed to connect device:', err);
            setError(err.message || 'Failed to connect device');
        } finally {
            setConnectingDevice(null);
        }
    };

    const handleDisconnectDevice = async (deviceId: string) => {
        try {
            await healthIntegrationService.disconnectDevice(deviceId);
            setDevices(devices.filter(d => d.id !== deviceId));
        } catch (err: any) {
            console.error('❌ Failed to disconnect device:', err);
            setError(err.message || 'Failed to disconnect device');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin text-6xl mb-4">⚙️</div>
                    <p className="text-slate-600 dark:text-slate-400">Laddar hälsodata...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    ❤️ Hälsointegration
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                    Anslut dina wearables och hälsoappar för att få bättre insikter om ditt välmående
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-red-800 dark:text-red-200">❌ {error}</p>
                </div>
            )}

            {/* Sync Status */}
            {syncStatus && (
                <div className={`rounded-xl p-4 ${
                    syncStatus === 'syncing' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                    syncStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                    'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                    <p className={`${
                        syncStatus === 'syncing' ? 'text-blue-800 dark:text-blue-200' :
                        syncStatus === 'success' ? 'text-green-800 dark:text-green-200' :
                        'text-red-800 dark:text-red-200'
                    }`}>
                        {syncStatus === 'syncing' && '⚙️ Synkroniserar...'}
                        {syncStatus === 'success' && '✅ Synkronisering klar!'}
                        {syncStatus === 'error' && '❌ Synkronisering misslyckades'}
                    </p>
                </div>
            )}

            {/* Current Health Data */}
            {wearableData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {wearableData.steps !== undefined && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                            <div className="text-3xl mb-2">🚶</div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{wearableData.steps}</div>
                            <p className="text-slate-600 dark:text-slate-400">Steg idag</p>
                        </div>
                    )}
                    {wearableData.heartRate !== undefined && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                            <div className="text-3xl mb-2">❤️</div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{wearableData.heartRate} bpm</div>
                            <p className="text-slate-600 dark:text-slate-400">Hjärtfrekvens</p>
                        </div>
                    )}
                    {wearableData.sleep !== undefined && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                            <div className="text-3xl mb-2">😴</div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{wearableData.sleep}h</div>
                            <p className="text-slate-600 dark:text-slate-400">Sömn</p>
                        </div>
                    )}
                    {wearableData.calories !== undefined && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                            <div className="text-3xl mb-2">🔥</div>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{wearableData.calories}</div>
                            <p className="text-slate-600 dark:text-slate-400">Kalorier</p>
                        </div>
                    )}
                </div>
            )}

            {/* Connected Devices */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                    📱 Anslutna enheter
                </h2>
                
                {devices.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">📱</div>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Inga enheter anslutna ännu
                        </p>
                        <p className="text-slate-500 dark:text-slate-500 text-sm">
                            Anslut en enhet nedan för att börja synkronisera din hälsodata
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {devices.map((device) => (
                            <div
                                key={device.id}
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="text-3xl">
                                        {device.type === 'fitbit' && '⌚'}
                                        {device.type === 'apple_health' && '🍎'}
                                        {device.type === 'google_fit' && '🏃'}
                                        {device.type === 'samsung_health' && '📱'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                            {device.name}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {device.connected ? (
                                                <>
                                                    ✅ Ansluten
                                                    {device.lastSync && ` • Senast synkad: ${new Date(device.lastSync).toLocaleString('sv-SE')}`}
                                                </>
                                            ) : (
                                                '⚠️ Frånkopplad'
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    {device.connected && (
                                        <button
                                            onClick={() => handleSyncWearable(device.id)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            disabled={syncStatus === 'syncing'}
                                        >
                                            🔄 Synka
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDisconnectDevice(device.id)}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                    >
                                        ❌ Koppla från
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New Device */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                    ➕ Anslut ny enhet
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => handleConnectDevice('fitbit')}
                        disabled={connectingDevice === 'fitbit'}
                        className="p-6 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="text-4xl mb-2">{connectingDevice === 'fitbit' ? '⏳' : '⌚'}</div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">Fitbit</p>
                    </button>
                    <button
                        onClick={() => handleConnectDevice('apple_health')}
                        disabled={connectingDevice === 'apple_health'}
                        className="p-6 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="text-4xl mb-2">{connectingDevice === 'apple_health' ? '⏳' : '🍎'}</div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">Apple Health</p>
                    </button>
                    <button
                        onClick={() => handleConnectDevice('google_fit')}
                        disabled={connectingDevice === 'google_fit'}
                        className="p-6 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="text-4xl mb-2">{connectingDevice === 'google_fit' ? '⏳' : '🏃'}</div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">Google Fit</p>
                    </button>
                    <button
                        onClick={() => handleConnectDevice('samsung_health')}
                        disabled={connectingDevice === 'samsung_health'}
                        className="p-6 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="text-4xl mb-2">{connectingDevice === 'samsung_health' ? '⏳' : '📱'}</div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">Samsung Health</p>
                    </button>
                </div>
            </div>

            {/* FHIR Integration */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    🏥 FHIR Integration
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Anslut till sjukvårdssystem som stödjer FHIR-standarden för säker delning av hälsodata
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            try {
                                const patient = await healthIntegrationService.getFHIRPatient();
                                alert('✅ FHIR Patient Data:\n' + JSON.stringify(patient, null, 2));
                            } catch (err: any) {
                                alert('❌ ' + err.message);
                            }
                        }}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                        🔐 Visa patientdata
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const observations = await healthIntegrationService.getFHIRObservations();
                                alert('✅ FHIR Observations:\n' + JSON.stringify(observations, null, 2));
                            } catch (err: any) {
                                alert('❌ ' + err.message);
                            }
                        }}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        📊 Visa observationer
                    </button>
                </div>
            </div>

            {/* Crisis Referral */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-4">
                    🆘 Krishantering
                </h2>
                <p className="text-orange-800 dark:text-orange-200 mb-4">
                    Om du upplever en kris, kontakta omedelbart:
                </p>
                <div className="space-y-2">
                    <p className="text-orange-900 dark:text-orange-100">📞 <strong>112</strong> - Akut nödläge</p>
                    <p className="text-orange-900 dark:text-orange-100">📞 <strong>1177</strong> - Sjukvårdsrådgivning</p>
                    <p className="text-orange-900 dark:text-orange-100">📞 <strong>Mind</strong> - Självmordslinjen 90101</p>
                </div>
            </div>
        </div>
    );
};

export default HealthIntegration;
