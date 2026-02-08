/**
 * Integration API functions for OAuth, wearables, health data sync, and FHIR
 * Provides type-safe access to /api/integration/* endpoints
 */

import { api } from './client';
import { API_ENDPOINTS } from './constants';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Supported OAuth providers */
export type OAuthProvider = 'google_fit' | 'fitbit' | 'samsung' | 'withings';

/** Supported health data sources */
export type HealthSource = 'google_fit' | 'fitbit' | 'samsung' | 'apple_health' | 'fhir';

/** Auto-sync frequency options */
export type SyncFrequency = 'hourly' | 'daily' | 'weekly';

/** Crisis type options */
export type CrisisType = 'general' | 'anxiety' | 'depression' | 'suicidal' | 'panic' | 'other';

/** Urgency level options */
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

/** Alert type options */
export type AlertType = 'low_steps' | 'high_heart_rate' | 'poor_sleep' | 'low_calories';

/** OAuth authorization response */
export interface OAuthAuthorizeResponse {
  success: boolean;
  authorizationUrl: string;  // camelCase
  authorization_url?: string; // snake_case fallback
  state: string;
  provider: string;
  message: string;
}

/** OAuth connection status */
export interface OAuthStatusResponse {
  connected: boolean;
  provider: string;
  scope?: string;
  obtainedAt?: string;  // camelCase
  obtained_at?: string; // snake_case fallback
  expiresAt?: string;   // camelCase
  expires_at?: string;  // snake_case fallback
  isExpired?: boolean;  // camelCase
  is_expired?: boolean; // snake_case fallback
}

/** Health data metrics */
export interface HealthMetrics {
  steps?: number;
  heart_rate?: number;
  heartRate?: number;
  sleep?: number;
  sleep_hours?: number;
  calories?: number;
}

/** Health sync response */
export interface HealthSyncResponse {
  success: boolean;
  provider: string;
  data: Record<string, unknown>;
  syncedAt?: string;   // camelCase
  synced_at?: string;  // snake_case fallback
  message: string;
}

/** Multi-source health sync response */
export interface MultiHealthSyncResponse {
  success: boolean;
  syncedData?: Record<string, unknown>;  // camelCase
  synced_data?: Record<string, unknown>; // snake_case fallback
  insights: string[];
  correlationWithMood?: MoodCorrelation;  // camelCase
  correlation_with_mood?: MoodCorrelation; // snake_case fallback
}

/** Mood correlation data */
export interface MoodCorrelation {
  sleepMoodCorrelation?: number;      // camelCase
  sleep_mood_correlation?: number;    // snake_case fallback
  activityMoodCorrelation?: number;   // camelCase
  activity_mood_correlation?: number; // snake_case fallback
  heartRateMoodCorrelation?: number;  // camelCase
  heart_rate_mood_correlation?: number; // snake_case fallback
  insights: string[];
}

/** Wearable device */
export interface WearableDevice {
  id: string;
  type: string;
  name: string;
  brand?: string;
  model?: string;
  connected: boolean;
  lastSync?: string;
  last_sync?: string;
}

/** Wearable status response */
export interface WearableStatusResponse {
  success: boolean;
  devices: WearableDevice[];
  deprecated?: boolean;
  message?: string;
}

/** Wearable details response */
export interface WearableDetailsResponse {
  data: HealthMetrics;
  lastSync?: string;      // camelCase
  last_sync?: string;     // snake_case fallback
  devices: WearableDevice[];
  metrics: {
    heartRate?: MetricDetail;   // camelCase
    heart_rate?: MetricDetail;  // snake_case fallback
    steps: MetricDetail;
    sleep: MetricDetail;
    activeMinutes?: MetricDetail;  // camelCase
    active_minutes?: MetricDetail; // snake_case fallback
  };
  insights: string[];
}

/** Metric detail */
export interface MetricDetail {
  current?: number;
  today?: number;
  lastNight?: number;        // camelCase
  last_night?: number;       // snake_case fallback
  averageToday?: number;     // camelCase
  average_today?: number;    // snake_case fallback
  averageWeekly?: number;    // camelCase
  average_weekly?: number;   // snake_case fallback
  restingHr?: number;        // camelCase
  resting_hr?: number;       // snake_case fallback
  goal?: number;
  deepSleepPercentage?: number;   // camelCase
  deep_sleep_percentage?: number; // snake_case fallback
  unit: string;
}

/** Health alert */
export interface HealthAlert {
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: string | number;
  threshold: string;
  recommendations: string[];
}

/** Health alerts response */
export interface HealthAlertsResponse {
  success: boolean;
  alerts: HealthAlert[];
  alertCount?: number;   // camelCase
  alert_count?: number;  // snake_case fallback
}

/** Alert settings */
export interface AlertSettings {
  emailAlerts?: boolean;    // camelCase
  email_alerts?: boolean;   // snake_case fallback
  pushAlerts?: boolean;     // camelCase
  push_alerts?: boolean;    // snake_case fallback
  alertTypes?: AlertType[]; // camelCase
  alert_types?: AlertType[]; // snake_case fallback
}

/** Auto-sync settings for a provider */
export interface AutoSyncSetting {
  enabled: boolean;
  frequency: SyncFrequency;
  lastSync?: string | null;  // camelCase
  last_sync?: string | null; // snake_case fallback
  nextSync?: string | null;  // camelCase
  next_sync?: string | null; // snake_case fallback
}

/** All auto-sync settings */
export interface AutoSyncSettingsResponse {
  success: boolean;
  settings: Record<OAuthProvider, AutoSyncSetting>;
}

/** Crisis referral request */
export interface CrisisReferralRequest {
  crisis_type: CrisisType;
  urgency_level: UrgencyLevel;
  notes?: string;
}

/** Crisis referral response */
export interface CrisisReferralResponse {
  success: boolean;
  message: string;
  referral: {
    referralId?: string;       // camelCase
    referral_id?: string;      // snake_case fallback
    userId?: string;           // camelCase
    user_id?: string;          // snake_case fallback
    crisisType?: CrisisType;   // camelCase
    crisis_type?: CrisisType;  // snake_case fallback
    urgencyLevel?: UrgencyLevel;   // camelCase
    urgency_level?: UrgencyLevel;  // snake_case fallback
    notes: string;
    createdAt?: string;        // camelCase
    created_at?: string;       // snake_case fallback
    status: string;
    assignedProvider?: string;      // camelCase
    assigned_provider?: string;     // snake_case fallback
    followUpRequired?: boolean;     // camelCase
    follow_up_required?: boolean;   // snake_case fallback
    estimatedResponseTime?: string; // camelCase
    estimated_response_time?: string; // snake_case fallback
  };
  nextSteps?: string[];   // camelCase
  next_steps?: string[];  // snake_case fallback
}

/** FHIR Patient resource (simplified) */
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{ system: string; value: string }>;
  name: Array<{ family: string; given: string[] }>;
  gender: string;
  birthDate: string;
  address: Array<{ country: string }>;
  telecom: Array<{ system: string; value: string }>;
}

/** FHIR Observation resource (simplified) */
export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: string;
  code: {
    coding: Array<{ system: string; code: string; display: string }>;
  };
  subject: { reference: string };
  effectiveDateTime: string;
  valueQuantity: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
}

/** FHIR Bundle response */
export interface FHIRBundleResponse {
  resourceType: 'Bundle';
  type: 'searchset';
  entry: FHIRObservation[];
}

// ============================================================================
// OAUTH FUNCTIONS
// ============================================================================

/**
 * Get OAuth authorization URL for a provider
 * @param provider - OAuth provider (google_fit, fitbit, samsung, withings)
 * @returns Authorization URL and state
 */
export async function getOAuthAuthorizeUrl(
  provider: OAuthProvider
): Promise<OAuthAuthorizeResponse> {
  const response = await api.get<{ data: OAuthAuthorizeResponse } | OAuthAuthorizeResponse>(
    `${API_ENDPOINTS.INTEGRATION.OAUTH_AUTHORIZE}/${provider}/authorize`
  );
  return (response.data as any).data || response.data;
}

/**
 * Check OAuth connection status for a provider
 * @param provider - OAuth provider
 * @returns Connection status
 */
export async function getOAuthStatus(
  provider: OAuthProvider
): Promise<OAuthStatusResponse> {
  const response = await api.get<{ data: OAuthStatusResponse } | OAuthStatusResponse>(
    `${API_ENDPOINTS.INTEGRATION.OAUTH_STATUS}/${provider}/status`
  );
  return (response.data as any).data || response.data;
}

/**
 * Disconnect OAuth integration for a provider
 * @param provider - OAuth provider to disconnect
 * @returns Success response
 */
export async function disconnectOAuth(
  provider: OAuthProvider
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ data: { success: boolean; message: string } } | { success: boolean; message: string }>(
    `${API_ENDPOINTS.INTEGRATION.OAUTH_DISCONNECT}/${provider}/disconnect`
  );
  return (response.data as any).data || response.data;
}

// ============================================================================
// HEALTH DATA SYNC FUNCTIONS
// ============================================================================

/**
 * Sync health data from a specific provider
 * @param provider - Health data provider
 * @param days - Number of days to sync (default 7, max 90)
 * @returns Synced health data
 */
export async function syncHealthDataFromProvider(
  provider: 'google_fit' | 'fitbit' | 'samsung',
  days: number = 7
): Promise<HealthSyncResponse> {
  const response = await api.post<{ data: HealthSyncResponse } | HealthSyncResponse>(
    `${API_ENDPOINTS.INTEGRATION.HEALTH_SYNC_PROVIDER}/${provider}`,
    { days: Math.min(Math.max(days, 1), 90) }
  );
  return (response.data as any).data || response.data;
}

/**
 * Sync health data from multiple sources
 * @param sources - Array of health sources to sync
 * @returns Combined health data with insights
 */
export async function syncHealthDataMulti(
  sources: HealthSource[] = ['google_fit']
): Promise<MultiHealthSyncResponse> {
  const response = await api.post<{ data: MultiHealthSyncResponse } | MultiHealthSyncResponse>(
    API_ENDPOINTS.INTEGRATION.HEALTH_SYNC_MULTI,
    { sources }
  );
  return (response.data as any).data || response.data;
}

/**
 * Analyze health and mood patterns
 * @param days - Number of days to analyze (default: 30)
 * @returns Analysis results with patterns and recommendations
 */
export async function analyzeHealthMoodPatterns(days: number = 30): Promise<{
  success: boolean;
  message: string;
  status: 'success' | 'insufficient_data' | 'error';
  days_analyzed?: number;
  patterns?: Array<{
    type: string;
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    actionable: boolean;
  }>;
  recommendations?: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    expected_benefit: string;
  }>;
  mood_average?: number;
  mood_trend?: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  health_summary?: {
    avg_steps?: number;
    steps_status?: 'good' | 'low';
    avg_sleep?: number;
    sleep_status?: 'good' | 'too_much' | 'too_little';
    avg_hr?: number;
    hr_status?: 'good' | 'elevated';
  };
  user_id?: string;
  generated_at?: string;
  data_points?: {
    health_entries: number;
    mood_entries: number;
  };
}> {
  const response = await api.post<{
    data?: any;
    success?: boolean;
    message?: string;
  }>(API_ENDPOINTS.INTEGRATION.HEALTH_ANALYZE, { days });
  return (response.data as any).data || response.data;
}

// ============================================================================
// HEALTH ALERTS FUNCTIONS
// ============================================================================

/**
 * Check health data for abnormalities and get alerts
 * @param provider - Provider that generated the data
 * @param healthData - Health metrics to analyze
 * @returns Generated alerts
 */
export async function checkHealthAlerts(
  provider: string,
  healthData: HealthMetrics
): Promise<HealthAlertsResponse> {
  const response = await api.post<{ data: HealthAlertsResponse } | HealthAlertsResponse>(
    API_ENDPOINTS.INTEGRATION.HEALTH_CHECK_ALERTS,
    { provider, health_data: healthData }
  );
  return (response.data as any).data || response.data;
}

/**
 * Update health alert settings
 * @param settings - Alert settings to update
 * @returns Updated settings
 */
export async function updateAlertSettings(
  settings: Partial<AlertSettings>
): Promise<{ success: boolean; settings: AlertSettings }> {
  const response = await api.post<{ data: { success: boolean; settings: AlertSettings } } | { success: boolean; settings: AlertSettings }>(
    API_ENDPOINTS.INTEGRATION.HEALTH_ALERT_SETTINGS,
    settings
  );
  return (response.data as any).data || response.data;
}

// ============================================================================
// AUTO-SYNC FUNCTIONS
// ============================================================================

/**
 * Toggle auto-sync for a provider
 * @param provider - OAuth provider
 * @param enabled - Enable or disable auto-sync
 * @param frequency - Sync frequency (hourly, daily, weekly)
 * @returns Updated auto-sync status
 */
export async function toggleAutoSync(
  provider: OAuthProvider,
  enabled: boolean,
  frequency: SyncFrequency = 'daily'
): Promise<{
  success: boolean;
  provider: string;
  autoSyncEnabled?: boolean;    // camelCase
  auto_sync_enabled?: boolean;  // snake_case fallback
  frequency: SyncFrequency;
}> {
  const response = await api.post<{
    data?: {
      success: boolean;
      provider: string;
      autoSyncEnabled?: boolean;
      auto_sync_enabled?: boolean;
      frequency: SyncFrequency;
    };
    success?: boolean;
    provider?: string;
    autoSyncEnabled?: boolean;
    auto_sync_enabled?: boolean;
    frequency?: SyncFrequency;
  }>(`${API_ENDPOINTS.INTEGRATION.AUTO_SYNC_TOGGLE}/${provider}/auto-sync`, {
    enabled,
    frequency,
  });
  return (response.data as any).data || response.data;
}

/**
 * Get all auto-sync settings
 * @returns Auto-sync settings for all providers
 */
export async function getAutoSyncSettings(): Promise<AutoSyncSettingsResponse> {
  const response = await api.get<{ data: AutoSyncSettingsResponse } | AutoSyncSettingsResponse>(
    API_ENDPOINTS.INTEGRATION.AUTO_SYNC_SETTINGS
  );
  return (response.data as any).data || response.data;
}

// ============================================================================
// WEARABLE FUNCTIONS (LEGACY - USE OAUTH INSTEAD)
// ============================================================================

/**
 * Get wearable status
 * @deprecated Use getOAuthStatus instead
 * @returns Wearable devices status
 */
export async function getWearableStatus(): Promise<WearableStatusResponse> {
  const response = await api.get<{ data: WearableStatusResponse } | WearableStatusResponse>(
    API_ENDPOINTS.INTEGRATION.WEARABLE_STATUS
  );
  return (response.data as any).data || response.data;
}

/**
 * Disconnect a wearable device
 * @deprecated Use disconnectOAuth instead
 * @param deviceId - Device ID to disconnect
 * @returns Success response
 */
export async function disconnectWearable(
  deviceId: string
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ data: { success: boolean; message: string } } | { success: boolean; message: string }>(
    API_ENDPOINTS.INTEGRATION.WEARABLE_DISCONNECT,
    { device_id: deviceId }
  );
  return (response.data as any).data || response.data;
}

/**
 * Sync wearable device data
 * @deprecated Use syncHealthDataFromProvider instead
 * @param deviceId - Device ID to sync
 * @returns Synced data
 */
export async function syncWearable(
  deviceId: string
): Promise<{ success: boolean; message: string; data: HealthMetrics }> {
  const response = await api.post<{
    data: { success: boolean; message: string; data: HealthMetrics };
  } | { success: boolean; message: string; data: HealthMetrics }>(
    API_ENDPOINTS.INTEGRATION.WEARABLE_SYNC, { device_id: deviceId }
  );
  return (response.data as any).data || response.data;
}

/**
 * Get detailed wearable data with insights
 * @returns Detailed wearable metrics and insights
 */
export async function getWearableDetails(): Promise<WearableDetailsResponse> {
  const response = await api.get<{ data: WearableDetailsResponse } | WearableDetailsResponse>(
    API_ENDPOINTS.INTEGRATION.WEARABLE_DETAILS
  );
  return (response.data as any).data || response.data;
}

/**
 * Sync Google Fit data directly
 * @param accessToken - Google OAuth access token
 * @param dateFrom - Start date (ISO string)
 * @param dateTo - End date (ISO string)
 * @returns Synced Google Fit data
 */
export async function syncGoogleFit(
  accessToken: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  success: boolean;
  message: string;
  data: Record<string, unknown>;
}> {
  const response = await api.post<{
    data: { success: boolean; message: string; data: Record<string, unknown> };
  } | { success: boolean; message: string; data: Record<string, unknown> }>(
    API_ENDPOINTS.INTEGRATION.GOOGLE_FIT_SYNC, {
      access_token: accessToken,
      date_from: dateFrom,
      date_to: dateTo,
    }
  );
  return (response.data as any).data || response.data;
}

// ============================================================================
// FHIR HEALTHCARE FUNCTIONS
// ============================================================================

/**
 * Get FHIR patient data
 * @returns FHIR Patient resource
 */
export async function getFHIRPatient(): Promise<FHIRPatient> {
  const response = await api.get<{ data: FHIRPatient } | FHIRPatient>(
    API_ENDPOINTS.INTEGRATION.FHIR_PATIENT
  );
  return (response.data as any).data || response.data;
}

/**
 * Get FHIR observations (health measurements)
 * @returns FHIR Bundle with observations
 */
export async function getFHIRObservations(): Promise<FHIRBundleResponse> {
  const response = await api.get<{ data: FHIRBundleResponse } | FHIRBundleResponse>(
    API_ENDPOINTS.INTEGRATION.FHIR_OBSERVATIONS
  );
  return (response.data as any).data || response.data;
}

// ============================================================================
// CRISIS SUPPORT FUNCTIONS
// ============================================================================

/**
 * Create a crisis referral to healthcare services
 * @param request - Crisis referral details
 * @returns Created referral with next steps
 */
export async function createCrisisReferral(
  request: CrisisReferralRequest
): Promise<CrisisReferralResponse> {
  const response = await api.post<{ data: CrisisReferralResponse } | CrisisReferralResponse>(
    API_ENDPOINTS.INTEGRATION.CRISIS_REFERRAL,
    request
  );
  return (response.data as any).data || response.data;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const integrationsApi = {
  // OAuth
  getOAuthAuthorizeUrl,
  getOAuthStatus,
  disconnectOAuth,
  
  // Health sync
  syncHealthDataFromProvider,
  syncHealthDataMulti,
  analyzeHealthMoodPatterns,
  
  // Alerts
  checkHealthAlerts,
  updateAlertSettings,
  
  // Auto-sync
  toggleAutoSync,
  getAutoSyncSettings,
  
  // Wearables (legacy)
  getWearableStatus,
  disconnectWearable,
  syncWearable,
  getWearableDetails,
  syncGoogleFit,
  
  // FHIR
  getFHIRPatient,
  getFHIRObservations,
  
  // Crisis
  createCrisisReferral,
};

export default integrationsApi;
