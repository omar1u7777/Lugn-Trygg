/**
 * Feedback API functions
 * Handles user feedback submission and retrieval
 */

import { api } from './client';
import { API_ENDPOINTS } from './constants';

// ============================================================================
// Types
// ============================================================================

/**
 * APIResponse wrapper from backend
 */
interface APIResponseWrapper<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Feedback submission request */
export interface FeedbackSubmitRequest {
  user_id: string;
  rating: number;
  category?: 'general' | 'bug' | 'feature' | 'support' | 'other';
  message?: string;
  feature_request?: string;
  bug_report?: string;
  allow_contact?: boolean;
  timestamp?: string;
}

/** Feedback submission response (camelCase from backend) */
export interface FeedbackSubmitResponse {
  feedbackId: string;
  // Legacy snake_case alias
  feedback_id?: string;
}

/** Single feedback entry (camelCase from backend) */
export interface FeedbackEntry {
  id: string;
  userId: string;
  rating: number;
  category: string;
  message: string;
  featureRequest?: string;
  bugReport?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'archived';
  createdAt: string;
  timestamp: string;
  // Legacy snake_case aliases
  user_id?: string;
  feature_request?: string;
  bug_report?: string;
  created_at?: string;
}

/** Feedback list response (from data wrapper) */
export interface FeedbackListResponse {
  feedback: FeedbackEntry[];
  count: number;
}

/** Feedback statistics (camelCase from backend) */
export interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  categories: Record<string, number>;
  recentCount30Days: number;
  dateRangeDays: number;
  // Legacy snake_case aliases
  total_feedback?: number;
  average_rating?: number;
  recent_count_30_days?: number;
  date_range_days?: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Submit user feedback
 * @param feedback - Feedback data to submit
 * @returns Submission result with feedback ID
 */
export async function submitFeedback(
  feedback: FeedbackSubmitRequest
): Promise<FeedbackSubmitResponse> {
  const response = await api.post<APIResponseWrapper<FeedbackSubmitResponse>>(
    API_ENDPOINTS.FEEDBACK.SUBMIT,
    feedback
  );
  // Handle APIResponse wrapper: { success: true, data: { feedbackId: "..." }, message: "..." }
  const responseData = response.data?.data || response.data;
  return responseData as FeedbackSubmitResponse;
}

/**
 * Get current user's feedback history
 * Requires authentication
 * @returns List of user's feedback submissions
 */
export async function getMyFeedback(): Promise<FeedbackListResponse> {
  const response = await api.get<APIResponseWrapper<FeedbackListResponse>>(
    API_ENDPOINTS.FEEDBACK.MY_FEEDBACK
  );
  // Handle APIResponse wrapper: { success: true, data: { feedback: [...], count: N }, message: "..." }
  const responseData = response.data?.data || response.data;
  return responseData as FeedbackListResponse;
}

/**
 * List all feedback (admin only)
 * @param options - Filter options
 * @returns Filtered feedback list
 */
export async function listFeedback(options?: {
  status?: 'pending' | 'reviewed' | 'resolved' | 'archived' | 'all';
  category?: string;
  limit?: number;
}): Promise<FeedbackListResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.category) params.append('category', options.category);
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await api.get<APIResponseWrapper<FeedbackListResponse>>(
    `${API_ENDPOINTS.FEEDBACK.LIST}?${params.toString()}`
  );
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  return responseData as FeedbackListResponse;
}

/**
 * Get feedback statistics (admin only)
 * @param days - Number of days to include (default 30, max 365)
 * @returns Feedback statistics
 */
export async function getFeedbackStats(days: number = 30): Promise<FeedbackStats> {
  const response = await api.get<APIResponseWrapper<FeedbackStats>>(
    `${API_ENDPOINTS.FEEDBACK.STATS}?days=${Math.min(days, 365)}`
  );
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  // Normalize to camelCase
  return {
    totalFeedback: responseData.totalFeedback ?? responseData.total_feedback ?? 0,
    averageRating: responseData.averageRating ?? responseData.average_rating ?? 0,
    categories: responseData.categories ?? {},
    recentCount30Days: responseData.recentCount30Days ?? responseData.recent_count_30_days ?? 0,
    dateRangeDays: responseData.dateRangeDays ?? responseData.date_range_days ?? 30
  };
}
