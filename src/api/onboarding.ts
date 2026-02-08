/**
 * Onboarding API Service
 * Backend integration for user onboarding and wellness goals
 */

import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

export interface WellnessGoal {
  id: string;
  name: string;
  description?: string;
}

export interface OnboardingGoalsRequest {
  goals: string[];
}

export interface OnboardingGoalsResponse {
  goals: string[];
  onboardingCompleted: boolean;
}

export interface OnboardingStatusResponse {
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;
  wellnessGoals: string[];
  goalsCount: number;
}

export interface SkipOnboardingResponse {
  onboardingCompleted: boolean;
  skipped: boolean;
}

/**
 * Onboarding API functions using the centralized API client
 */

/**
 * Save user's wellness goals after onboarding
 */
export async function saveOnboardingGoals(
  userId: string,
  goals: string[]
): Promise<OnboardingGoalsResponse> {
  console.log('💾 Saving onboarding goals:', { userId, goals });

  const response = await api.post(`${API_ENDPOINTS.ONBOARDING.GOALS}/${userId}`, { goals });
  const data = response.data?.data || response.data;

  console.log('✅ Goals saved successfully:', data);

  return data;
}

/**
 * Get user's current wellness goals
 */
export async function getOnboardingGoals(userId: string): Promise<string[]> {
  console.log('📥 Fetching onboarding goals for user:', userId);

  const response = await api.get(`${API_ENDPOINTS.ONBOARDING.GOALS}/${userId}`);
  const data = response.data?.data || response.data;

  console.log('✅ Goals fetched:', data);

  return data?.goals || [];
}

/**
 * Update user's wellness goals
 */
export async function updateOnboardingGoals(
  userId: string,
  goals: string[]
): Promise<OnboardingGoalsResponse> {
  console.log('🔄 Updating onboarding goals:', { userId, goals });

  const response = await api.put(`${API_ENDPOINTS.ONBOARDING.GOALS}/${userId}`, { goals });
  const data = response.data?.data || response.data;

  console.log('✅ Goals updated:', data);

  return data;
}

/**
 * Get user's onboarding status
 */
export async function getOnboardingStatus(userId: string): Promise<OnboardingStatusResponse> {
  console.log('📊 Fetching onboarding status for user:', userId);

  const response = await api.get(`${API_ENDPOINTS.ONBOARDING.STATUS}/${userId}`);
  const data = response.data?.data || response.data;

  console.log('✅ Status fetched:', data);

  return data;
}

/**
 * Skip onboarding (mark as completed without goals)
 */
export async function skipOnboarding(userId: string): Promise<SkipOnboardingResponse> {
  console.log('⏭️ Skipping onboarding for user:', userId);

  const response = await api.post(`${API_ENDPOINTS.ONBOARDING.SKIP}/${userId}`);
  const data = response.data?.data || response.data;

  console.log('✅ Onboarding skipped successfully');

  return data;
}

export default {
  saveOnboardingGoals,
  getOnboardingGoals,
  updateOnboardingGoals,
  getOnboardingStatus,
  skipOnboarding
};