/**
 * Admin API Client
 * Endpoints for admin dashboard, user management, content moderation, and system monitoring
 * All endpoints require admin role
 */

import { api } from './client';
import { ApiError } from './errors';
import { API_ENDPOINTS } from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetrics {
  endpoints: Record<string, EndpointStats>;
  totalRequests: number;
  errorCounts: Record<string, number>;
  slowRequestsCount: number;
}

export interface EndpointStats {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
}

export interface AdminStats {
  users: {
    total: number;
    active7d: number;
    new30d: number;
    premium: number;
  };
  moods: {
    total: number;
    today: number;
    averageScore: number;
  };
  content: {
    memories: number;
    journals: number;
    chatSessions: number;
  };
  engagement: {
    activeRate: number;
    premiumRate: number;
  };
  generatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'inactive' | 'suspended' | 'banned';
  role: 'user' | 'admin';
  xp: number;
  streak: number;
  premium: boolean;
  createdAt: string | null;
  lastActive: string | null;
}

export interface UsersListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ContentReport {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  reportedBy: string;
  createdAt: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface ReportsListResponse {
  reports: ContentReport[];
  total: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  firebase: 'connected' | 'disconnected';
  timestamp: string;
  uptimeRequests: number;
  errorRate: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get performance metrics (admin only)
 */
export const getPerformanceMetrics = async (): Promise<PerformanceMetrics> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADMIN.PERFORMANCE_METRICS);
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get comprehensive admin statistics
 */
export const getAdminStats = async (): Promise<AdminStats> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADMIN.STATS);
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get paginated user list for admin management
 * @param page - Page number (default: 1)
 * @param limit - Users per page (default: 20)
 * @param search - Search by email or name
 * @param status - Filter by status (active, inactive, suspended, banned)
 */
export const getAdminUsers = async (
  page: number = 1,
  limit: number = 20,
  search?: string,
  status?: 'active' | 'inactive' | 'suspended' | 'banned'
): Promise<UsersListResponse> => {
  try {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;

    const response = await api.get(API_ENDPOINTS.ADMIN.USERS, { params });
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Update user status (suspend, activate, ban)
 * @param userId - Target user ID
 * @param status - New status (active, suspended, banned)
 */
export const updateUserStatus = async (
  userId: string,
  status: 'active' | 'suspended' | 'banned'
): Promise<{ userId: string; newStatus: string }> => {
  try {
    const response = await api.put(`${API_ENDPOINTS.ADMIN.USERS}/${userId}/status`, { status });
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get content reports for moderation
 * @param status - Filter by status (default: 'pending')
 */
export const getContentReports = async (
  status: 'pending' | 'resolved' | 'dismissed' = 'pending'
): Promise<ReportsListResponse> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADMIN.REPORTS, { params: { status } });
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Resolve a content report
 * @param reportId - Report ID to resolve
 * @param action - Action to take (dismiss, remove_content, warn_user, ban_user)
 * @param notes - Resolution notes
 * @param contentType - Type of content being moderated
 * @param contentId - ID of content being moderated
 */
export const resolveReport = async (
  reportId: string,
  action: 'dismiss' | 'remove_content' | 'warn_user' | 'ban_user',
  notes?: string,
  contentType?: string,
  contentId?: string
): Promise<{ reportId: string; action: string }> => {
  try {
    const response = await api.post(`${API_ENDPOINTS.ADMIN.REPORTS}/${reportId}/resolve`, {
      action,
      notes,
      content_type: contentType,
      content_id: contentId,
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
 * Get system health status (admin only)
 */
export const getSystemHealth = async (): Promise<SystemHealth> => {
  try {
    const response = await api.get(API_ENDPOINTS.ADMIN.SYSTEM_HEALTH);
    return response.data.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};
