/**
 * Insights API - AI-powered wellness insights and recommendations
 */

import { api, ApiError } from './client';
import { API_ENDPOINTS } from './constants';

export interface Insight {
  id: string;
  type: 'wellness' | 'behavioral' | 'mood' | 'sleep' | 'activity';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'positive';
  created_at: string;
  data?: Record<string, unknown>;
}

export interface WellnessInsight extends Insight {
  type: 'wellness';
  wellness_score: number;
  areas: {
    name: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
  }[];
}

export interface BehavioralInsight extends Insight {
  type: 'behavioral';
  behavior: string;
  frequency: number;
  impact: 'positive' | 'negative' | 'neutral';
  suggestions: string[];
}

export interface PersonalizedRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actions: string[];
  expected_benefit: string;
}

/**
 * Get all user insights
 * @param limit - Number of insights to retrieve
 */
export const getAllInsights = async (limit: number = 20): Promise<Insight[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.INSIGHTS.ALL, {
      params: { limit }
    });
    return response.data.data?.insights || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get wellness insights
 */
export const getWellnessInsights = async (): Promise<WellnessInsight[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.INSIGHTS.WELLNESS);
    return response.data.data?.insights || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get behavioral insights
 */
export const getBehavioralInsights = async (): Promise<BehavioralInsight[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.INSIGHTS.BEHAVIORAL);
    return response.data.data?.insights || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get personalized recommendations
 */
export const getPersonalizedRecommendations = async (): Promise<PersonalizedRecommendation[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.INSIGHTS.RECOMMENDATIONS);
    return response.data.data?.recommendations || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};
