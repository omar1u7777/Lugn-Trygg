import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Divider,
    Snackbar
} from '@mui/material';
import {
    DirectionsWalk as StepsIcon,
    Favorite as HeartIcon,
    Bedtime as SleepIcon,
    LocalFireDepartment as CaloriesIcon,
    Watch as WatchIcon,
    Apple as AppleIcon,
    DirectionsRun as FitnessIcon,
    Smartphone as PhoneIcon,
    Sync as SyncIcon,
    LinkOff as DisconnectIcon,
    Add as AddIcon,
    LocalHospital as HospitalIcon,
    Assessment as DataIcon,
    SOS as SOSIcon
} from '@mui/icons-material';
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
            <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                        Laddar hälsodata...
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                    ❤️ Hälsointegration
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
                    Anslut dina wearables och hälsoappar för att få bättre insikter om ditt välmående
                </Typography>
            </Box>

            {/* Error Message */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
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
                    sx={{ mb: 3 }}
                >
                    {syncStatus === 'syncing' && '⚙️ Synkroniserar...'}
                    {syncStatus === 'success' && '✅ Synkronisering klar!'}
                    {syncStatus === 'error' && '❌ Synkronisering misslyckades'}
                </Alert>
            )}

            {/* Current Health Data */}
            {wearableData && (
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    {wearableData.steps !== undefined && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h2" sx={{ mb: 1 }}>🚶</Typography>
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
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h2" sx={{ mb: 1 }}>❤️</Typography>
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
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h2" sx={{ mb: 1 }}>😴</Typography>
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
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h2" sx={{ mb: 1 }}>🔥</Typography>
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
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    📱 Anslutna enheter
                </Typography>
                
                {devices.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>📱</Typography>
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                            Inga enheter anslutna ännu
                        </Typography>
                        <Typography variant="body2" color="text.disabled">
                            Anslut en enhet nedan för att börja synkronisera din hälsodata
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {devices.map((device) => (
                            <Paper
                                key={device.id}
                                elevation={0}
                                sx={{ 
                                    p: 2, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    bgcolor: 'background.default'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="h3">
                                        {device.type === 'fitbit' && '⌚'}
                                        {device.type === 'apple_health' && '🍎'}
                                        {device.type === 'google_fit' && '🏃'}
                                        {device.type === 'samsung_health' && '📱'}
                                    </Typography>
                                    <Box>
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
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {device.connected && (
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<SyncIcon />}
                                            onClick={() => handleSyncWearable(device.id)}
                                            disabled={syncStatus === 'syncing'}
                                        >
                                            Synka
                                        </Button>
                                    )}
                                    <Button
                                        variant="contained"
                                        color="error"
                                        startIcon={<DisconnectIcon />}
                                        onClick={() => handleDisconnectDevice(device.id)}
                                    >
                                        Koppla från
                                    </Button>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Paper>

            {/* Add New Device */}
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    ➕ Anslut ny enhet
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => handleConnectDevice('fitbit')}
                            disabled={connectingDevice === 'fitbit'}
                            sx={{ 
                                py: 3, 
                                flexDirection: 'column', 
                                gap: 1,
                                height: '100%'
                            }}
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
                            variant="outlined"
                            onClick={() => handleConnectDevice('apple_health')}
                            disabled={connectingDevice === 'apple_health'}
                            sx={{ 
                                py: 3, 
                                flexDirection: 'column', 
                                gap: 1,
                                height: '100%'
                            }}
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
                            variant="outlined"
                            onClick={() => handleConnectDevice('google_fit')}
                            disabled={connectingDevice === 'google_fit'}
                            sx={{ 
                                py: 3, 
                                flexDirection: 'column', 
                                gap: 1,
                                height: '100%'
                            }}
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
                            variant="outlined"
                            onClick={() => handleConnectDevice('samsung_health')}
                            disabled={connectingDevice === 'samsung_health'}
                            sx={{ 
                                py: 3, 
                                flexDirection: 'column', 
                                gap: 1,
                                height: '100%'
                            }}
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
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    🏥 FHIR Integration
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Anslut till sjukvårdssystem som stödjer FHIR-standarden för säker delning av hälsodata
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<HospitalIcon />}
                        onClick={async () => {
                            try {
                                const patient = await healthIntegrationService.getFHIRPatient();
                                alert('✅ FHIR Patient Data:\n' + JSON.stringify(patient, null, 2));
                            } catch (err: any) {
                                alert('❌ ' + err.message);
                            }
                        }}
                    >
                        🔐 Visa patientdata
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<DataIcon />}
                        onClick={async () => {
                            try {
                                const observations = await healthIntegrationService.getFHIRObservations();
                                alert('✅ FHIR Observations:\n' + JSON.stringify(observations, null, 2));
                            } catch (err: any) {
                                alert('❌ ' + err.message);
                            }
                        }}
                    >
                        📊 Visa observationer
                    </Button>
                </Box>
            </Paper>

            {/* Crisis Referral */}
            <Alert 
                severity="warning" 
                icon={<SOSIcon />}
                sx={{ 
                    bgcolor: 'warning.light',
                    border: 1,
                    borderColor: 'warning.main'
                }}
            >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    🆘 Krishantering
                </Typography>
                <Typography variant="body1" gutterBottom>
                    Om du upplever en kris, kontakta omedelbart:
                </Typography>
                <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        📞 <strong>112</strong> - Akut nödläge
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        📞 <strong>1177</strong> - Sjukvårdsrådgivning
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                        📞 <strong>Mind</strong> - Självmordslinjen 90101
                    </Typography>
                </Box>
            </Alert>
        </Container>
    );
};

export default HealthIntegration;
