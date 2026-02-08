import { api } from "./client";
import { ApiError } from "./errors";

/**
 * API Key Rotation Status
 */
export interface ApiKeyRotationStatus {
  service: string;
  lastRotation?: string;
  nextRotation?: string;
  status: string;
  keysActive: number;
  [key: string]: any;
}

/**
 * Tamper Detection Event
 */
export interface TamperEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: Record<string, any>;
  resolved: boolean;
}

/**
 * Tamper Detection Summary
 */
export interface TamperSummary {
  totalEvents: number;
  activeAlerts: number;
  resolvedEvents: number;
  criticalEvents: number;
  lastEventTime?: string;
}

/**
 * Security Metrics
 */
export interface SecurityMetrics {
  authFailures: number;
  suspiciousActivity: number;
  blockedRequests: number;
  activeThreats: number;
  lastUpdated: string;
  [key: string]: any;
}

/**
 * Get API key rotation status (Admin only)
 * @returns Promise resolving to key rotation status
 */
export const getKeyRotationStatus = async (): Promise<ApiKeyRotationStatus> => {
  try {
    const response = await api.get('/api/security/key-rotation/status');
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get tamper detection events (Admin only)
 * @param limit - Maximum number of events to retrieve (default: 50, max: 200)
 * @returns Promise resolving to tamper events and summary
 */
export const getTamperEvents = async (limit: number = 50): Promise<{
  events: TamperEvent[];
  summary: TamperSummary;
  activeAlerts: TamperEvent[];
}> => {
  try {
    const response = await api.get('/api/security/tamper/events', {
      params: { limit: Math.min(limit, 200) }
    });
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get security monitoring metrics (Admin only)
 * @returns Promise resolving to security metrics
 */
export const getSecurityMetrics = async (): Promise<SecurityMetrics> => {
  try {
    const response = await api.get('/api/security/monitoring/metrics');
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
