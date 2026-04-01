/**
 * Mood Analytics API Client
 * Handles correlation analysis, clinical flagging, and impact analysis
 */

import { api } from './client';

export interface TagCorrelation {
  tag: string;
  occurrences: number;
  average_mood_with_tag: number;
  baseline_mood: number;
  impact: number;
  impact_percentage: number;
  impact_level: 'low' | 'medium' | 'high';
  is_significant: boolean;
  p_value: number;
  cohens_d: number;
  confidence: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface CorrelationInsight {
  type: string;
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
}

export interface CorrelationAnalysisResponse {
  status: string;
  total_entries: number;
  baseline_mood: number;
  tags_analyzed: number;
  correlations: TagCorrelation[];
  insights: CorrelationInsight[];
  analysis_period: {
    start: string;
    end: string;
    days: number;
  };
}

export interface ClinicalFlag {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  days_count?: number;
  date_range?: {
    start: string;
    end: string;
  };
  mood_change?: number;
  low_mood_days?: number;
  total_days?: number;
  clinical_significance: boolean;
}

export interface ClinicalRecommendation {
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  resources: Array<{
    name: string;
    phone?: string;
    available?: string;
  }>;
}

export interface ClinicalFlagsResponse {
  flagged: boolean;
  risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  flags: ClinicalFlag[];
  recommendations: ClinicalRecommendation[];
  checked_at: string;
}

export interface ImpactAnalysisResponse {
  correlation_analysis: CorrelationAnalysisResponse;
  clinical_flags: ClinicalFlagsResponse;
  summary: {
    total_entries: number;
    analysis_period_days: number;
    has_correlations: boolean;
    is_flagged: boolean;
    risk_level: string;
  };
}

/**
 * Get correlation analysis between tags and mood scores
 */
export async function getCorrelationAnalysis(
  days: number = 30,
  minOccurrences: number = 3
): Promise<CorrelationAnalysisResponse> {
  const response = await api.get('/mood-analytics/correlation-analysis', {
    params: { days, min_occurrences: minOccurrences }
  });
  return response.data.data;
}

/**
 * Get clinical flags for user's mood data
 */
export async function getClinicalFlags(): Promise<ClinicalFlagsResponse> {
  const response = await api.get('/mood-analytics/clinical-flags');
  return response.data.data;
}

/**
 * Get comprehensive impact analysis (correlation + clinical flags)
 */
export async function getImpactAnalysis(
  days: number = 30
): Promise<ImpactAnalysisResponse> {
  const response = await api.get('/mood-analytics/impact-analysis', {
    params: { days }
  });
  return response.data.data;
}
