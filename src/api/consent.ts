/**
 * Consent Management API Client
 * Handles user consent for GDPR compliance
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from './constants';

// Backend consent types
export type BackendConsentType =
  | 'data_processing'
  | 'ai_processing'
  | 'voice_processing'
  | 'analytics'
  | 'marketing'
  | 'terms_of_service'
  | 'privacy_policy';

// Frontend consent types (matches ConsentModal)
export type FrontendConsentType =
  | 'dataProcessing'
  | 'aiAnalysis'
  | 'storage'
  | 'marketing'
  | 'analytics'
  | 'termsOfService'
  | 'privacyPolicy'
  | 'voiceProcessing';

export interface ConsentStatus {
  has_consent: boolean;
  granted_at: string | null;
  version: string | null;
  withdrawn?: boolean;
  error?: string;
}

export interface ConsentMetadata {
  required: boolean;
  description: string;
  version: string;
  status: ConsentStatus;
}

export interface UserConsents {
  [key: string]: ConsentMetadata;
}

export interface BulkConsentRequest {
  analytics_consent?: boolean;
  marketing_consent?: boolean;
  data_processing_consent?: boolean;
  ai_analysis_consent?: boolean;
  terms_of_service?: boolean;
  privacy_policy?: boolean;
  voice_processing_consent?: boolean;
}

export interface BulkConsentResponse {
  granted: string[];
  failed: string[];
  timestamp: string;
}

export interface FeatureValidation {
  access_granted: boolean;
  feature: string;
  required_consents: string[];
  missing_consents?: Array<{
    type: string;
    description: string;
  }>;
}

export interface ConsentRecord {
  consent_type: string;
  granted_at?: string;
  withdrawn_at?: string;
  version?: string;
  has_consent?: boolean;
}

/**
 * Grant multiple consents at once (used by ConsentModal)
 */
export async function grantBulkConsents(
  consents: BulkConsentRequest
): Promise<BulkConsentResponse> {
  const response = await apiClient.post<BulkConsentResponse>(
    API_ENDPOINTS.CONSENT.BASE,
    consents
  );
  return response.data;
}

/**
 * Get all consent records for current user
 */
export async function getUserConsents(): Promise<UserConsents> {
  const response = await apiClient.get<UserConsents>(
    API_ENDPOINTS.CONSENT.BASE
  );
  return response.data;
}

/**
 * Grant consent for a specific type
 */
export async function grantConsent(
  consentType: BackendConsentType | FrontendConsentType,
  version: string = '1.0'
): Promise<ConsentRecord> {
  const response = await apiClient.post<ConsentRecord>(
    `${API_ENDPOINTS.CONSENT.BASE}/${consentType}`,
    { version }
  );
  return response.data;
}

/**
 * Withdraw consent for a specific type
 */
export async function withdrawConsent(
  consentType: BackendConsentType | FrontendConsentType
): Promise<ConsentRecord> {
  const response = await apiClient.delete<ConsentRecord>(
    `${API_ENDPOINTS.CONSENT.BASE}/${consentType}`
  );
  return response.data;
}

/**
 * Validate if user has required consents for a feature
 */
export async function validateFeatureAccess(
  feature: string
): Promise<FeatureValidation> {
  const response = await apiClient.get<FeatureValidation>(
    `${API_ENDPOINTS.CONSENT.BASE}/validate/${feature}`
  );
  return response.data;
}

/**
 * Check if user has given consent for a specific type
 */
export async function checkConsent(
  consentType: BackendConsentType | FrontendConsentType
): Promise<ConsentRecord> {
  const response = await apiClient.get<ConsentRecord>(
    `${API_ENDPOINTS.CONSENT.BASE}/check/${consentType}`
  );
  return response.data;
}

/**
 * Map frontend consent types to backend format for bulk request
 */
export function mapFrontendConsentsToBackend(frontendConsents: {
  dataProcessing: boolean;
  aiAnalysis: boolean;
  storage: boolean;
  marketing: boolean;
  termsOfService?: boolean;
  privacyPolicy?: boolean;
}): BulkConsentRequest {
  return {
    data_processing_consent: frontendConsents.dataProcessing || frontendConsents.storage,
    ai_analysis_consent: frontendConsents.aiAnalysis,
    marketing_consent: frontendConsents.marketing,
    terms_of_service: frontendConsents.termsOfService ?? true, // Required
    privacy_policy: frontendConsents.privacyPolicy ?? true, // Required
  };
}

export default {
  grantBulkConsents,
  getUserConsents,
  grantConsent,
  withdrawConsent,
  validateFeatureAccess,
  checkConsent,
  mapFrontendConsentsToBackend,
};
