/**
 * OAuth Service for Health Integrations
 * Handles OAuth 2.0 flows with health platforms
 */

import api from '../api/api';import { logger } from '../utils/logger';


export interface OAuthProvider {
    id: string;
    name: string;
    icon: string;
    description: string;
    scopes: string[];
}

export interface OAuthStatus {
    connected: boolean;
    provider: string;
    scope?: string;
    obtained_at?: string;
    expires_at?: string;
    is_expired?: boolean;
    last_sync?: string;
    last_sync_time?: string;
}

export interface HealthData {
    steps?: number;
    heart_rate?: number;
    sleep_hours?: number;
    calories?: number;
    [key: string]: any;
}

class OAuthHealthService {
    private supportedProviders: OAuthProvider[] = [
        {
            id: 'google_fit',
            name: 'Google Fit',
            icon: '🏃',
            description: 'Sync activity, heart rate, and sleep data from Google Fit',
            scopes: ['fitness.activity.read', 'fitness.heart_rate.read', 'fitness.sleep.read']
        },
        {
            id: 'fitbit',
            name: 'Fitbit',
            icon: '💪',
            description: 'Connect your Fitbit device for comprehensive health tracking',
            scopes: ['activity', 'heartrate', 'sleep', 'weight']
        },
        {
            id: 'samsung',
            name: 'Samsung Health',
            icon: '📱',
            description: 'Sync health data from Samsung Health app',
            scopes: ['shealth.read']
        },
        {
            id: 'withings',
            name: 'Withings',
            icon: '⚖️',
            description: 'Connect Withings devices for weight and health metrics',
            scopes: ['user.metrics']
        }
    ];

    /**
     * Get list of supported health providers
     */
    getSupportedProviders(): OAuthProvider[] {
        return this.supportedProviders;
    }

    /**
     * Get provider details by ID
     */
    getProvider(providerId: string): OAuthProvider | undefined {
        return this.supportedProviders.find(p => p.id === providerId);
    }

    /**
     * Initiate OAuth flow for a provider
     */
    async initiateOAuth(providerId: string): Promise<{ authorization_url: string; state: string }> {
        try {
            const response = await api.get(`/api/v1/integration/oauth/${providerId}/authorize`);
            
            if (response.data.authorization_url) {
                // Open authorization URL in new window
                const width = 600;
                const height = 700;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);
                
                window.open(
                    response.data.authorization_url,
                    'oauth_window',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );
                
                return response.data;
            } else {
                throw new Error('No authorization URL received');
            }
        } catch (error: any) {
            logger.error(`Failed to initiate OAuth for ${providerId}:`, error);
            throw error;
        }
    }

    /**
     * Check OAuth connection status
     */
    async checkStatus(providerId: string): Promise<OAuthStatus> {
        try {
            const response = await api.get(`/api/v1/integration/oauth/${providerId}/status`);
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to check OAuth status for ${providerId}:`, error);
            throw error;
        }
    }

    /**
     * Check status for all providers
     */
    async checkAllStatuses(): Promise<Map<string, OAuthStatus>> {
        const statuses = new Map<string, OAuthStatus>();
        
        await Promise.all(
            this.supportedProviders.map(async (provider) => {
                try {
                    const status = await this.checkStatus(provider.id);
                    statuses.set(provider.id, status);
                } catch (error) {
                    // Provider not connected or error - set as disconnected
                    statuses.set(provider.id, { connected: false, provider: provider.id });
                }
            })
        );
        
        return statuses;
    }

    /**
     * Disconnect OAuth integration
     */
    async disconnect(providerId: string): Promise<void> {
        try {
            await api.post(`/api/v1/integration/oauth/${providerId}/disconnect`);
            logger.debug(`Successfully disconnected from ${providerId}`);
        } catch (error: any) {
            logger.error(`Failed to disconnect from ${providerId}:`, error);
            throw error;
        }
    }

    /**
     * Sync health data from provider
     */
    async syncHealthData(providerId: string, days: number = 7): Promise<HealthData> {
        try {
            const response = await api.post(`/api/v1/integration/health/sync/${providerId}`, { days });
            
            if (response.data.success) {
                return response.data.data;
            } else {
                throw new Error(response.data.error || 'Failed to sync health data');
            }
        } catch (error: any) {
            logger.error(`Failed to sync health data from ${providerId}:`, error);
            throw error;
        }
    }

    /**
     * Listen for OAuth callback message from popup window
     */
    listenForOAuthCallback(): Promise<{ success: boolean; provider: string }> {
        return new Promise((resolve, reject) => {
            const messageHandler = (event: MessageEvent) => {
                // Verify origin
                if (event.origin !== window.location.origin) {
                    return;
                }
                
                if (event.data.type === 'oauth_callback') {
                    window.removeEventListener('message', messageHandler);
                    
                    if (event.data.success) {
                        resolve({ success: true, provider: event.data.provider });
                    } else {
                        reject(new Error(event.data.error || 'OAuth failed'));
                    }
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Timeout after 5 minutes
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('OAuth timeout'));
            }, 5 * 60 * 1000);
        });
    }

    /**
     * Connect to a health provider (full flow)
     */
    async connectProvider(providerId: string): Promise<boolean> {
        try {
            // Check if already connected
            const status = await this.checkStatus(providerId);
            if (status.connected && !status.is_expired) {
                logger.debug(`Already connected to ${providerId}`);
                return true;
            }
            
            // Initiate OAuth
            await this.initiateOAuth(providerId);
            
            // Wait for callback
            const result = await this.listenForOAuthCallback();
            
            if (result.success && result.provider === providerId) {
                logger.debug(`Successfully connected to ${providerId}`);
                return true;
            } else {
                throw new Error('OAuth callback mismatch');
            }
        } catch (error: any) {
            logger.error(`Failed to connect to ${providerId}:`, error);
            throw error;
        }
    }
}

// Singleton instance
const oauthHealthService = new OAuthHealthService();

export default oauthHealthService;
