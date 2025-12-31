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
  message: string;
  goals: string[];
  onboarding_completed: boolean;
}

export interface OnboardingStatusResponse {
  onboarding_completed: boolean;
  onboarding_completed_at?: string;
  wellness_goals: string[];
  goals_count: number;
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

  console.log('✅ Goals saved successfully:', response.data);

  return response.data;
}

/**
 * Get user's current wellness goals
 */
export async function getOnboardingGoals(userId: string): Promise<string[]> {
  console.log('📥 Fetching onboarding goals for user:', userId);

  const response = await api.get(`${API_ENDPOINTS.ONBOARDING.GOALS}/${userId}`);

  console.log('✅ Goals fetched:', response.data);

  return response.data.goals;
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

  console.log('✅ Goals updated:', response.data);

  return response.data;
}

/**
 * Get user's onboarding status
 */
export async function getOnboardingStatus(userId: string): Promise<OnboardingStatusResponse> {
  console.log('📊 Fetching onboarding status for user:', userId);

  const response = await api.get(`${API_ENDPOINTS.ONBOARDING.STATUS}/${userId}`);

  console.log('✅ Status fetched:', response.data);

  return response.data;
}

/**
 * Skip onboarding (mark as completed without goals)
 */
export async function skipOnboarding(userId: string): Promise<void> {
  console.log('⏭️ Skipping onboarding for user:', userId);

  await api.post(`${API_ENDPOINTS.ONBOARDING.SKIP}/${userId}`);

  console.log('✅ Onboarding skipped successfully');
}

export default {
  saveOnboardingGoals,
  getOnboardingGoals,
  updateOnboardingGoals,
  getOnboardingStatus,
  skipOnboarding
};
