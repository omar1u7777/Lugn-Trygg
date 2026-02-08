/**
 * Sync History API Client
 * Handles sync tracking for health integrations
 */

import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Sync history entry from backend
 */
export interface SyncHistoryEntry {
  id: string;
  provider: string;
  providerName: string;
  providerIcon: string;
  timestamp: string; // ISO date string
  status: 'success' | 'failed' | 'partial' | 'pending' | 'unknown';
  dataTypes: string[];
  recordCount?: number;
  duration?: number;
  error?: string;
}

/**
 * Sync history response
 */
export interface SyncHistoryResponse {
  history: SyncHistoryEntry[];
  total: number;
  days: number;
  providerFilter: string;
}

/**
 * Sync stats by provider
 */
export interface ProviderStats {
  name: string;
  icon: string;
  total: number;
  success: number;
  failed: number;
  lastSync: string | null;
}

/**
 * Sync statistics response
 */
export interface SyncStatsResponse {
  totalSyncs: number;
  successCount: number;
  failedCount: number;
  partialCount: number;
  successRate: number;
  lastSync: string | null;
  byProvider: Record<string, ProviderStats>;
}

/**
 * Log sync operation request
 */
export interface LogSyncRequest {
  provider: string;
  status: 'success' | 'failed' | 'partial';
  dataTypes?: string[];
  recordCount?: number;
  durationSeconds?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Get sync history for user
 * 
 * @param provider - Filter by provider ('all' for no filter)
 * @param days - Number of days to look back (default: 7)
 * @param limit - Max entries to return (default: 50)
 * @returns Promise resolving to sync history
 */
export async function getSyncHistory(
  provider: string = 'all',
  days: number = 7,
  limit: number = 50
): Promise<SyncHistoryEntry[]> {
  try {
    const response = await api.get(API_ENDPOINTS.SYNC_HISTORY.SYNC_HISTORY_LIST, {
      params: { provider, days, limit }
    });
    
    return response.data.data.history || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
}

/**
 * Log a sync operation
 * 
 * @param request - Sync operation details
 * @returns Promise resolving to sync ID
 */
export async function logSyncOperation(request: LogSyncRequest): Promise<string> {
  try {
    const payload = {
      provider: request.provider,
      status: request.status,
      data_types: request.dataTypes || [],
      record_count: request.recordCount,
      duration_seconds: request.durationSeconds,
      error_message: request.errorMessage,
      metadata: request.metadata || {}
    };
    
    const response = await api.post(API_ENDPOINTS.SYNC_HISTORY.SYNC_HISTORY_LOG, payload);
    
    return response.data.data.syncId;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
}

/**
 * Get sync statistics
 * 
 * @returns Promise resolving to sync stats
 */
export async function getSyncStats(): Promise<SyncStatsResponse> {
  try {
    const response = await api.get(API_ENDPOINTS.SYNC_HISTORY.SYNC_HISTORY_STATS);
    
    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
}

/**
 * Retry a failed sync operation
 * 
 * @param syncId - Sync ID to retry
 * @returns Promise resolving to retry result
 */
export async function retrySyncOperation(syncId: string): Promise<{ retryId: string; message: string }> {
  try {
    const response = await api.post(`${API_ENDPOINTS.SYNC_HISTORY.SYNC_HISTORY_RETRY}/${syncId}`);
    
    return {
      retryId: response.data.data.retryId,
      message: response.data.data.message
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
}