/**
 * Data Retention API Client
 * GDPR and HIPAA compliant data retention management
 */

import api from './client';
import { API_ENDPOINTS } from './constants';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface RetentionPeriod {
  collection: string;
  retention_days: number;
  expired_count: number;
  will_be_deleted: boolean;
}

export interface RetentionStatus {
  user_id: string;
  retention_status: Record<string, {
    retention_days: number;
    expired_count: number;
    will_be_deleted: boolean;
    error?: string;
  }>;
  next_cleanup: string;
}

export interface RetentionCleanupResult {
  success: boolean;
  total_deleted: number;
  collections_processed: Array<{
    collection: string;
    deleted: number;
    retention_days: number;
  }>;
  timestamp: string;
  error?: string;
}

export interface RetentionPolicy {
  moods: number;
  memories: number;
  chat_sessions: number;
  ai_conversations: number;
  journal_entries: number;
  voice_data: number;
  wellness_activities: number;
  notifications: number;
  feedback: number;
  achievements: number;
  referrals: number;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get data retention status for current user
 * @param userId User ID to check retention status
 * @returns Retention status with expired data counts
 */
export const getRetentionStatus = async (userId: string): Promise<RetentionStatus> => {
  const response = await api.get<{
    success: boolean;
    data: RetentionStatus;
    message: string;
  }>(`${API_ENDPOINTS.PRIVACY.RETENTION_STATUS}/${userId}`);
  
  return response.data.data;
};

/**
 * Manually trigger data retention cleanup for user
 * Deletes all data older than configured retention periods
 * @param userId User ID to perform cleanup for
 * @returns Cleanup result with deletion statistics
 */
export const triggerRetentionCleanup = async (userId: string): Promise<RetentionCleanupResult> => {
  const response = await api.post<{
    success: boolean;
    data: RetentionCleanupResult;
    message: string;
  }>(`${API_ENDPOINTS.PRIVACY.RETENTION_CLEANUP}/${userId}`);
  
  return response.data.data;
};

/**
 * System-wide retention cleanup (admin only)
 * @returns Cleanup result for all users
 */
export const triggerSystemRetentionCleanup = async (): Promise<RetentionCleanupResult> => {
  const response = await api.post<{
    success: boolean;
    data: RetentionCleanupResult;
    message: string;
  }>(`${API_ENDPOINTS.PRIVACY.RETENTION_CLEANUP_ALL}`);
  
  return response.data.data;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Default GDPR/HIPAA retention periods (7 years for medical data)
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  moods: 2555,  // 7 years
  memories: 2555,
  chat_sessions: 2555,
  ai_conversations: 2555,
  journal_entries: 2555,
  voice_data: 2555,
  wellness_activities: 2555,
  notifications: 365,  // 1 year for non-critical data
  feedback: 2555,
  achievements: 2555,
  referrals: 2555
};

/**
 * Convert days to human-readable format
 */
export const formatRetentionPeriod = (days: number): string => {
  if (days < 30) {
    return `${days} dagar`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} månad${months > 1 ? 'er' : ''}`;
  } else {
    const years = Math.floor(days / 365);
    return `${years} år`;
  }
};

/**
 * Calculate total expired data across all collections
 */
export const getTotalExpiredCount = (status: RetentionStatus): number => {
  return Object.values(status.retention_status).reduce(
    (total, collection) => total + (collection.expired_count || 0),
    0
  );
};

/**
 * Get collections with expired data
 */
export const getCollectionsWithExpiredData = (status: RetentionStatus): string[] => {
  return Object.entries(status.retention_status)
    .filter(([_, collection]) => collection.will_be_deleted && collection.expired_count > 0)
    .map(([name]) => name);
};

/**
 * Format collection name for display
 */
export const formatCollectionName = (collection: string): string => {
  const translations: Record<string, string> = {
    moods: 'Humörloggar',
    memories: 'Minnen',
    chat_sessions: 'Chattkonversationer',
    ai_conversations: 'AI-samtal',
    journal_entries: 'Dagboksanteckningar',
    voice_data: 'Röstdata',
    wellness_activities: 'Välbefinnande-aktiviteter',
    notifications: 'Notifikationer',
    feedback: 'Feedback',
    achievements: 'Prestationer',
    referrals: 'Hänvisningar'
  };
  return translations[collection] || collection;
};

/**
 * Determine if retention cleanup is recommended
 */
export const isCleanupRecommended = (status: RetentionStatus): boolean => {
  const totalExpired = getTotalExpiredCount(status);
  return totalExpired > 100;  // Recommend cleanup if >100 expired records
};

/**
 * Get retention warning message based on expired count
 */
export const getRetentionWarningMessage = (expiredCount: number): string => {
  if (expiredCount === 0) {
    return 'Ingen data behöver raderas just nu.';
  } else if (expiredCount < 50) {
    return `${expiredCount} gamla poster kan raderas för att följa datalagringsregler.`;
  } else if (expiredCount < 200) {
    return `${expiredCount} gamla poster bör raderas. Överväg att köra rensning.`;
  } else {
    return `⚠️ ${expiredCount} gamla poster måste raderas! Kör rensning nu för GDPR-efterlevnad.`;
  }
};

/**
 * Estimate storage saved from cleanup (rough estimate)
 */
export const estimateStorageSaved = (cleanupResult: RetentionCleanupResult): string => {
  // Rough estimate: 5KB per mood, 50KB per memory, 10KB per chat
  const estimateKB = cleanupResult.collections_processed.reduce((total, collection) => {
    const multipliers: Record<string, number> = {
      moods: 5,
      memories: 50,
      chat_sessions: 10,
      ai_conversations: 10,
      journal_entries: 15,
      voice_data: 100,
      wellness_activities: 3,
      notifications: 1,
      feedback: 2,
      achievements: 1,
      referrals: 2
    };
    const multiplier = multipliers[collection.collection] || 5;
    return total + (collection.deleted * multiplier);
  }, 0);

  if (estimateKB < 1024) {
    return `~${estimateKB} KB`;
  } else if (estimateKB < 1024 * 1024) {
    return `~${Math.round(estimateKB / 1024)} MB`;
  } else {
    return `~${Math.round(estimateKB / (1024 * 1024) * 10) / 10} GB`;
  }
};

/**
 * Get next scheduled cleanup date
 */
export const getNextCleanupDate = (status: RetentionStatus): Date => {
  return new Date(status.next_cleanup);
};

/**
 * Check if user should be notified about retention cleanup
 */
export const shouldNotifyUser = (status: RetentionStatus): boolean => {
  const totalExpired = getTotalExpiredCount(status);
  const nextCleanup = getNextCleanupDate(status);
  const daysUntilCleanup = Math.floor((nextCleanup.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  // Notify if >500 expired records OR cleanup is within 7 days
  return totalExpired > 500 || daysUntilCleanup <= 7;
};

export default {
  getRetentionStatus,
  triggerRetentionCleanup,
  triggerSystemRetentionCleanup,
  DEFAULT_RETENTION_POLICY,
  formatRetentionPeriod,
  getTotalExpiredCount,
  getCollectionsWithExpiredData,
  formatCollectionName,
  isCleanupRecommended,
  getRetentionWarningMessage,
  estimateStorageSaved,
  getNextCleanupDate,
  shouldNotifyUser
};
