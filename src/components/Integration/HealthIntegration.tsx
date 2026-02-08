import React, { useState, useEffect, useCallback } from 'react'
import { Container, Typography, Button, Card, Grid, CardContent, Alert, Spinner, Paper } from '../ui/tailwind';
// TODO: Replace icons with Heroicons
import healthIntegrationService, { WearableDevice, WearableData } from '../../services/healthIntegrationService';
import { ArrowPathIcon, XMarkIcon, BuildingOfficeIcon, ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const HealthIntegration: React.FC = () => {
    const [devices, setDevices] = useState<WearableDevice[]>([]);
    const [wearableData, setWearableData] = useState<WearableData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [connectingDevice, setConnectingDevice] = useState<string | null>(null);

    const fetchWearableStatus = useCallback(async () => {
        try {
            setLoading(true);
            const fetchedDevices = await healthIntegrationService.getWearableStatus();
            setDevices(fetchedDevices);
            setError(null);
        } catch (err: unknown) {
            console.error('❌ Failed to fetch wearable status:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load wearable devices';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchWearableData = useCallback(async () => {
        try {
            const details = await healthIntegrationService.getWearableDetails();
            if (details.data) {
                setWearableData(details.data);
            }
        } catch (err: unknown) {
            console.error('❌ Failed to fetch wearable data:', err);
            // Don't set error here as this is non-critical
        }
    }, []);

    const loadHealthData = useCallback(async () => {
        await Promise.all([
            fetchWearableStatus(),
            fetchWearableData()
        ]);
    }, [fetchWearableStatus, fetchWearableData]);

    useEffect(() => {
        loadHealthData();
    }, [loadHealthData]);

    const handleSyncWearable = async (deviceId: string) => {
        try {
            setSyncStatus('syncing');
            const data = await healthIntegrationService.syncWearable(deviceId);
            setWearableData(data);
            setSyncStatus('success');
            await fetchWearableStatus();
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (err: unknown) {
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
            setDevices(prev => [...prev, newDevice]);
            
            // Show success message
            const deviceNames: Record<string, string> = {
                'fitbit': 'Fitbit',
                'apple_health': 'Apple Health',
                'google_fit': 'Google Fit',
                'samsung_health': 'Samsung Health'
            };
            
            alert(`✅ ${deviceNames[deviceType]} ansluten! Du kan nu synkronisera din hälsodata.`);
        } catch (err: unknown) {
            console.error('❌ Failed to connect device:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect device';
            setError(errorMessage);
        } finally {
            setConnectingDevice(null);
        }
    };

    const handleDisconnectDevice = async (deviceId: string) => {
        try {
            await healthIntegrationService.disconnectDevice(deviceId);
            setDevices(prev => prev.filter(d => d.id !== deviceId));
        } catch (err: unknown) {
            console.error('❌ Failed to disconnect device:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect device';
            setError(errorMessage);
        }
    };

    if (loading) {
        return (
            <div>
                <div>
                    <Spinner size="sm" />
                    <Typography variant="body1" color="text.secondary">
                        Laddar hälsodata...
                    </Typography>
                </div>
            </div>
        );
    }

    return (
        <Container>
            {/* Header */}
            <div>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                    ❤️ Hälsointegration
                </Typography>
                <Typography variant="h6" color="text.secondary">
                    Anslut dina wearables och hälsoappar för att få bättre insikter om ditt välmående
                </Typography>
            </div>

            {/* Error Message */}
            {error && (
                <Alert severity="error">
                    {error}
                </Alert>
            )}

            {/* Sync Status */}
            {syncStatus && (
                <Alert 
                    severity={
                        syncStatus === 'syncing' ? 'info' :
                        syncStatus === 'success' ? 'success' :
                        'error'
                    }
                >
                    {syncStatus === 'syncing' && '⚙️ Synkroniserar...'}
                    {syncStatus === 'success' && '✅ Synkronisering klar!'}
                    {syncStatus === 'error' && '❌ Synkronisering misslyckades'}
                </Alert>
            )}

            {/* Current Health Data */}
            {wearableData && (
                <Grid container spacing={2}>
                    {wearableData.steps !== undefined && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h2">🚶</Typography>
                                    <Typography variant="h4" fontWeight="bold">
                                        {wearableData.steps}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Steg idag
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                    {wearableData.heartRate !== undefined && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h2">❤️</Typography>
                                    <Typography variant="h4" fontWeight="bold">
                                        {wearableData.heartRate} bpm
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Hjärtfrekvens
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                    {wearableData.sleep !== undefined && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h2">😴</Typography>
                                    <Typography variant="h4" fontWeight="bold">
                                        {wearableData.sleep}h
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Sömn
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                    {wearableData.calories !== undefined && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h2">🔥</Typography>
                                    <Typography variant="h4" fontWeight="bold">
                                        {wearableData.calories}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Kalorier
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            )}

            {/* Connected Devices */}
            <Paper className="shadow-md">
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    📱 Anslutna enheter
                </Typography>
                
                {devices.length === 0 ? (
                    <div>
                        <Typography variant="h1">📱</Typography>
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                            Inga enheter anslutna ännu
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Anslut en enhet nedan för att börja synkronisera din hälsodata
                        </Typography>
                    </div>
                ) : (
                    <div>
                        {devices.map((device) => (
                            <Paper
                                key={device.id}
                                className="shadow-none"
                            >
                                <div>
                                    <Typography variant="h3">
                                        {device.type === 'fitbit' && '⌚'}
                                        {device.type === 'apple_health' && '🍎'}
                                        {device.type === 'google_fit' && '🏃'}
                                        {device.type === 'samsung_health' && '📱'}
                                    </Typography>
                                    <div>
                                        <Typography variant="h6" fontWeight="bold">
                                            {device.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {device.connected ? (
                                                <>
                                                    ✅ Ansluten
                                                    {device.lastSync && ` • Senast synkad: ${new Date(device.lastSync).toLocaleString('sv-SE')}`}
                                                </>
                                            ) : (
                                                '⚠️ Frånkopplad'
                                            )}
                                        </Typography>
                                    </div>
                                </div>
                                <div>
                                    {device.connected && (
                                        <Button
                                            variant="primary"
                                            color="primary"
                                            startIcon={<ArrowPathIcon className="w-5 h-5" />}
                                            onClick={() => handleSyncWearable(device.id)}
                                            disabled={syncStatus === 'syncing'}
                                        >
                                            Synka
                                        </Button>
                                    )}
                                    <Button
                                        variant="primary"
                                        color="error"
                                        startIcon={<XMarkIcon className="w-5 h-5" />}
                                        onClick={() => handleDisconnectDevice(device.id)}
                                    >
                                        Koppla från
                                    </Button>
                                </div>
                            </Paper>
                        ))}
                    </div>
                )}
            </Paper>

            {/* Add New Device */}
            <Paper className="shadow-md">
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    ➕ Anslut ny enhet
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                        <Button
                            fullWidth
                            variant="outline"
                            onClick={() => handleConnectDevice('fitbit')}
                            disabled={connectingDevice === 'fitbit'}
                        >
                            <Typography variant="h3">
                                {connectingDevice === 'fitbit' ? '⏳' : '⌚'}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">Fitbit</Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            fullWidth
                            variant="outline"
                            onClick={() => handleConnectDevice('apple_health')}
                            disabled={connectingDevice === 'apple_health'}
                        >
                            <Typography variant="h3">
                                {connectingDevice === 'apple_health' ? '⏳' : '🍎'}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">Apple Health</Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            fullWidth
                            variant="outline"
                            onClick={() => handleConnectDevice('google_fit')}
                            disabled={connectingDevice === 'google_fit'}
                        >
                            <Typography variant="h3">
                                {connectingDevice === 'google_fit' ? '⏳' : '🏃'}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">Google Fit</Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            fullWidth
                            variant="outline"
                            onClick={() => handleConnectDevice('samsung_health')}
                            disabled={connectingDevice === 'samsung_health'}
                        >
                            <Typography variant="h3">
                                {connectingDevice === 'samsung_health' ? '⏳' : '📱'}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">Samsung Health</Typography>
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* FHIR Integration */}
            <Paper className="shadow-md">
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    🏥 FHIR Integration
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Anslut till sjukvårdssystem som stödjer FHIR-standarden för säker delning av hälsodata
                </Typography>
                <div>
                    <Button
                        variant="primary"
                        color="success"
                        startIcon={<BuildingOfficeIcon className="w-5 h-5" />}
                        onClick={async () => {
                            try {
                                const patient = await healthIntegrationService.getFHIRPatient();
                                alert('✅ FHIR Patient Data:\n' + JSON.stringify(patient, null, 2));
                            } catch (err: unknown) {
                                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch FHIR patient';
                                alert('❌ ' + errorMessage);
                            }
                        }}
                    >
                        🔐 Visa patientdata
                    </Button>
                    <Button
                        variant="primary"
                        color="primary"
                        startIcon={<ChartBarIcon className="w-5 h-5" />}
                        onClick={async () => {
                            try {
                                const observations = await healthIntegrationService.getFHIRObservations();
                                alert('✅ FHIR Observations:\n' + JSON.stringify(observations, null, 2));
                            } catch (err: unknown) {
                                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch FHIR observations';
                                alert('❌ ' + errorMessage);
                            }
                        }}
                    >
                        📊 Visa observationer
                    </Button>
                </div>
            </Paper>

            {/* Crisis Referral */}
            <Alert 
                severity="warning" 
                icon={<ExclamationTriangleIcon />}
            >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    🆘 Krishantering
                </Typography>
                <Typography variant="body1" gutterBottom>
                    Om du upplever en kris, kontakta omedelbart:
                </Typography>
                <div>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        📞 <strong>112</strong> - Akut nödläge
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        📞 <strong>1177</strong> - Sjukvårdsrådgivning
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                        📞 <strong>Mind</strong> - Självmordslinjen 90101
                    </Typography>
                </div>
            </Alert>
        </Container>
    );
};

export default HealthIntegration;


