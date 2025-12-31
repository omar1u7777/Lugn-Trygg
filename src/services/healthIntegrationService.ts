import api from '../api/api';

export interface WearableDevice {
    id: string;
    name: string;
    type: 'fitbit' | 'apple_health' | 'google_fit' | 'samsung_health';
    connected: boolean;
    lastSync?: string;
}

export interface WearableData {
    steps?: number;
    heartRate?: number;
    sleep?: number;
    calories?: number;
    timestamp?: string;
}

export interface HealthMetrics {
    heart_rate?: {
        current: number;
        average_today: number;
        resting_hr: number;
        unit: string;
    };
    steps?: {
        today: number;
        goal: number;
        average_weekly: number;
        unit: string;
    };
    sleep?: {
        last_night: number;
        average_weekly: number;
        deep_sleep_percentage: number;
        unit: string;
    };
    active_minutes?: {
        today: number;
        goal: number;
        average_weekly: number;
        unit: string;
    };
}

export interface WearableDetailsResponse {
    data: WearableData;
    last_sync: string;
    devices: Array<{
        type: string;
        brand: string;
        model: string;
        connected: boolean;
        last_sync: string;
    }>;
    metrics: HealthMetrics;
    insights: string[];
}

class HealthIntegrationService {
    /**
     * Get status of all connected wearable devices
     */
    async getWearableStatus(): Promise<WearableDevice[]> {
        try {
            const response = await api.get('/api/integration/wearable/status');
            return response.data.devices || [];
        } catch (error: any) {
            console.error('Failed to fetch wearable status:', error);
            throw new Error(error.response?.data?.message || 'Failed to load wearable devices');
        }
    }

    /**
     * Get detailed wearable data and metrics
     */
    async getWearableDetails(): Promise<WearableDetailsResponse> {
        try {
            const response = await api.get('/api/integration/wearable/details');
            return response.data;
        } catch (error: any) {
            console.error('Failed to fetch wearable details:', error);
            throw new Error(error.response?.data?.message || 'Failed to load wearable data');
        }
    }

    /**
     * Connect a new wearable device
     */
    async connectDevice(deviceType: string): Promise<WearableDevice> {
        try {
            const response = await api.post('/api/integration/wearable/connect', {
                device_type: deviceType
            });
            return response.data.device;
        } catch (error: any) {
            console.error('Failed to connect device:', error);
            throw new Error(error.response?.data?.message || 'Failed to connect device');
        }
    }

    /**
     * Disconnect a wearable device
     */
    async disconnectDevice(deviceId: string): Promise<void> {
        try {
            await api.post('/api/integration/wearable/disconnect', {
                device_id: deviceId
            });
        } catch (error: any) {
            console.error('Failed to disconnect device:', error);
            throw new Error(error.response?.data?.message || 'Failed to disconnect device');
        }
    }

    /**
     * Sync data from a specific wearable device
     */
    async syncWearable(deviceId: string): Promise<WearableData> {
        try {
            const response = await api.post('/api/integration/wearable/sync', {
                device_id: deviceId
            });
            return response.data.data;
        } catch (error: any) {
            console.error('Failed to sync wearable:', error);
            throw new Error(error.response?.data?.message || 'Failed to sync device');
        }
    }

    /**
     * Sync Google Fit data
     */
    async syncGoogleFit(accessToken: string, dateFrom?: string, dateTo?: string): Promise<any> {
        try {
            const response = await api.post('/api/integration/wearable/google-fit/sync', {
                access_token: accessToken,
                date_from: dateFrom,
                date_to: dateTo
            });
            return response.data;
        } catch (error: any) {
            console.error('Failed to sync Google Fit:', error);
            throw new Error(error.response?.data?.message || 'Failed to sync Google Fit');
        }
    }

    /**
     * Sync Apple Health data
     */
    async syncAppleHealth(healthData: any): Promise<any> {
        try {
            const response = await api.post('/api/integration/wearable/apple-health/sync', {
                health_data: healthData
            });
            return response.data;
        } catch (error: any) {
            console.error('Failed to sync Apple Health:', error);
            throw new Error(error.response?.data?.message || 'Failed to sync Apple Health');
        }
    }

    /**
     * Sync comprehensive health data from multiple sources
     */
    async syncHealthData(sources: string[] = ['google_fit']): Promise<any> {
        try {
            const response = await api.post('/api/integration/health/sync', {
                sources
            });
            return response.data;
        } catch (error: any) {
            console.error('Failed to sync health data:', error);
            throw new Error(error.response?.data?.message || 'Failed to sync health data');
        }
    }

    /**
     * Get FHIR patient data
     */
    async getFHIRPatient(): Promise<any> {
        try {
            const response = await api.get('/api/integration/fhir/patient');
            return response.data;
        } catch (error: any) {
            console.error('Failed to fetch FHIR patient data:', error);
            throw new Error(error.response?.data?.message || 'Failed to load patient data');
        }
    }

    /**
     * Get FHIR observations
     */
    async getFHIRObservations(): Promise<any> {
        try {
            const response = await api.get('/api/integration/fhir/observation');
            return response.data;
        } catch (error: any) {
            console.error('Failed to fetch FHIR observations:', error);
            throw new Error(error.response?.data?.message || 'Failed to load observations');
        }
    }

    /**
     * Create a crisis referral
     */
    async createCrisisReferral(crisisType: string, urgencyLevel: string, notes: string): Promise<any> {
        try {
            const response = await api.post('/api/integration/crisis/referral', {
                crisis_type: crisisType,
                urgency_level: urgencyLevel,
                notes
            });
            return response.data;
        } catch (error: any) {
            console.error('Failed to create crisis referral:', error);
            throw new Error(error.response?.data?.message || 'Failed to create referral');
        }
    }
}

export const healthIntegrationService = new HealthIntegrationService();
export default healthIntegrationService;
