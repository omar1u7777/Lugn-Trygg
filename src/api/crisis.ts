/**
 * Crisis Intervention API Client
 * TypeScript client for mental health crisis detection and intervention
 */

import api from './client';
import { API_ENDPOINTS } from './constants';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type IndicatorCategory = 'behavioral' | 'emotional' | 'cognitive' | 'physical';
export type SeverityLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface CrisisIndicator {
  id: string;
  name: string;
  category: IndicatorCategory;
  severity: SeverityLevel;
  description: string;
  risk_weight: number;
  intervention_triggers?: string[];
}

export interface CrisisAssessment {
  risk_level: RiskLevel;
  risk_score: number;
  confidence_score: number;
  active_indicators: CrisisIndicator[];
  intervention_recommendations: string[];
  risk_trends: {
    increasing_indicators?: string[];
    stable_indicators?: string[];
    decreasing_indicators?: string[];
  };
  assessment_timestamp: string;
  needs_immediate_attention: boolean;
}

export interface SafetyPlan {
  warning_signs: string[];
  coping_strategies: string[];
  support_contacts: Array<{
    name: string;
    phone: string;
    relationship: string;
  }>;
  professional_help: Array<{
    provider: string;
    phone: string;
    type: string;
  }>;
  environmental_safety: string[];
  updated_date: string;
  user_id: string;
}

export interface InterventionProtocol {
  protocol_id: string;
  name: string;
  risk_level: RiskLevel;
  immediate_actions: string[];
  support_resources: string[];
  follow_up_steps: string[];
  escalation_criteria: string[];
  swedish_guidance: string;
}

export interface AssessmentHistory {
  assessments: Array<{
    user_id: string;
    risk_level: RiskLevel;
    risk_score: number;
    active_indicators: CrisisIndicator[];
    intervention_recommendations: string[];
    confidence_score: number;
    risk_trends: Record<string, any>;
    assessment_timestamp: string;
    created_at: string;
  }>;
  total_count: number;
  latest_assessment: any | null;
  risk_trend: 'increasing' | 'stable' | 'decreasing';
}

export interface CrisisIndicatorsResponse {
  indicators: CrisisIndicator[];
  grouped_by_category: {
    behavioral: CrisisIndicator[];
    emotional: CrisisIndicator[];
    cognitive: CrisisIndicator[];
    physical: CrisisIndicator[];
  };
  total_count: number;
}

export interface EscalationCheck {
  should_escalate: boolean;
  previous_risk_level: RiskLevel;
  previous_risk_score: number;
  days_since_assessment: number;
  recommendation: string;
}

export interface UserContext {
  mood_history?: Array<{
    score: number;
    timestamp: string;
    note?: string;
  }>;
  recent_text_content?: string;
  days_without_social_interaction?: number;
  social_activity_trend?: number;
  avoidance_patterns?: string[];
  insomnia_nights_last_week?: number;
  sleep_duration_change_percent?: number;
  mood_score_drop_last_week?: number;
  consecutive_low_mood_days?: number;
  current_anxiety_score?: number;
  mood_decline_points_per_day?: number;
  recent_data_days?: number;
  mood_patterns?: Record<string, any>;
  effective_coping_strategies?: string[];
  emergency_contacts?: Array<{
    name: string;
    phone: string;
  }>;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Assess user's crisis risk based on comprehensive data
 * @param context User context data for assessment
 * @returns Crisis assessment with risk level and recommendations
 */
export const assessCrisisRisk = async (
  context: UserContext
): Promise<CrisisAssessment> => {
  const response = await api.post<{
    success: boolean;
    data: CrisisAssessment;
    message: string;
  }>(API_ENDPOINTS.CRISIS.ASSESS, context);
  
  return response.data.data;
};

/**
 * Get user's personalized safety plan
 * @returns Current safety plan
 */
export const getSafetyPlan = async (): Promise<SafetyPlan> => {
  const response = await api.get<{
    success: boolean;
    data: SafetyPlan;
    message: string;
  }>(API_ENDPOINTS.CRISIS.SAFETY_PLAN);
  
  return response.data.data;
};

/**
 * Update user's safety plan
 * @param safetyPlan Updated safety plan data
 * @returns Updated safety plan
 */
export const updateSafetyPlan = async (
  safetyPlan: Partial<SafetyPlan>
): Promise<SafetyPlan> => {
  const response = await api.put<{
    success: boolean;
    data: SafetyPlan;
    message: string;
  }>(API_ENDPOINTS.CRISIS.UPDATE_SAFETY_PLAN, safetyPlan);
  
  return response.data.data;
};

/**
 * Get intervention protocol for specific risk level
 * @param riskLevel The risk level (low, medium, high, critical)
 * @returns Intervention protocol with actions and resources
 */
export const getInterventionProtocol = async (
  riskLevel: RiskLevel
): Promise<InterventionProtocol> => {
  const response = await api.get<{
    success: boolean;
    data: InterventionProtocol;
    message: string;
  }>(`${API_ENDPOINTS.CRISIS.PROTOCOLS}/${riskLevel}`);
  
  return response.data.data;
};

/**
 * Get user's crisis assessment history
 * @param limit Maximum number of assessments to retrieve (default 10, max 50)
 * @returns Assessment history
 */
export const getAssessmentHistory = async (
  limit: number = 10
): Promise<AssessmentHistory> => {
  const response = await api.get<{
    success: boolean;
    data: AssessmentHistory;
    message: string;
  }>(`${API_ENDPOINTS.CRISIS.HISTORY}?limit=${limit}`);
  
  return response.data.data;
};

/**
 * Get all available crisis indicators information
 * @returns Crisis indicators grouped by category
 */
export const getCrisisIndicators = async (): Promise<CrisisIndicatorsResponse> => {
  const response = await api.get<{
    success: boolean;
    data: CrisisIndicatorsResponse;
    message: string;
  }>(API_ENDPOINTS.CRISIS.INDICATORS);
  
  return response.data.data;
};

/**
 * Check if crisis situation requires escalation
 * @param previousAssessmentId ID of previous assessment
 * @param currentContext Current user context
 * @returns Escalation check result
 */
export const checkEscalation = async (
  previousAssessmentId: string,
  currentContext: UserContext
): Promise<EscalationCheck> => {
  const response = await api.post<{
    success: boolean;
    data: EscalationCheck;
    message: string;
  }>(API_ENDPOINTS.CRISIS.CHECK_ESCALATION, {
    previous_assessment_id: previousAssessmentId,
    current_context: currentContext
  });
  
  return response.data.data;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format risk level for display
 */
export const formatRiskLevel = (level: RiskLevel): string => {
  const translations: Record<RiskLevel, string> = {
    low: 'Låg risk',
    medium: 'Medelhög risk',
    high: 'Hög risk',
    critical: 'Kritisk risk'
  };
  return translations[level] || level;
};

/**
 * Get color for risk level (Tailwind classes)
 */
export const getRiskLevelColor = (level: RiskLevel): string => {
  const colors: Record<RiskLevel, string> = {
    low: 'text-success-600 bg-success-50',
    medium: 'text-warning-600 bg-warning-50',
    high: 'text-error-600 bg-error-50',
    critical: 'text-error-700 bg-error-100'
  };
  return colors[level] || 'text-gray-600 bg-gray-50';
};

/**
 * Get icon for risk level (Heroicons name)
 */
export const getRiskLevelIcon = (level: RiskLevel): string => {
  const icons: Record<RiskLevel, string> = {
    low: 'CheckCircleIcon',
    medium: 'ExclamationTriangleIcon',
    high: 'ExclamationCircleIcon',
    critical: 'ShieldExclamationIcon'
  };
  return icons[level] || 'InformationCircleIcon';
};

/**
 * Determine if immediate action is needed based on assessment
 */
export const needsImmediateAction = (assessment: CrisisAssessment): boolean => {
  return assessment.needs_immediate_attention || 
         assessment.risk_level === 'critical' ||
         (assessment.risk_level === 'high' && assessment.risk_score > 7.5);
};

/**
 * Get priority level for indicator
 */
export const getIndicatorPriority = (indicator: CrisisIndicator): number => {
  const severityWeights: Record<SeverityLevel, number> = {
    low: 1,
    moderate: 2,
    high: 3,
    severe: 4
  };
  return severityWeights[indicator.severity] * indicator.risk_weight;
};

/**
 * Sort indicators by priority (highest first)
 */
export const sortIndicatorsByPriority = (
  indicators: CrisisIndicator[]
): CrisisIndicator[] => {
  return [...indicators].sort((a, b) => 
    getIndicatorPriority(b) - getIndicatorPriority(a)
  );
};

/**
 * Build user context from mood data
 */
export const buildUserContextFromMoods = (
  moods: Array<{ score: number; timestamp: string; note?: string }>
): UserContext => {
  if (moods.length === 0) {
    return {};
  }

  const recentMoods = moods.slice(0, 7); // Last 7 days
  const scores = recentMoods.map(m => m.score);
  const firstScore = scores[0] ?? 0;
  const lastScore = scores[scores.length - 1] ?? 0;

  return {
    mood_history: moods,
    mood_score_drop_last_week: firstScore - lastScore,
    consecutive_low_mood_days: recentMoods.filter(m => m.score < 4).length,
    mood_decline_points_per_day: (firstScore - lastScore) / recentMoods.length,
    recent_data_days: recentMoods.length
  };
};

export default {
  assessCrisisRisk,
  getSafetyPlan,
  updateSafetyPlan,
  getInterventionProtocol,
  getAssessmentHistory,
  getCrisisIndicators,
  checkEscalation,
  formatRiskLevel,
  getRiskLevelColor,
  getRiskLevelIcon,
  needsImmediateAction,
  getIndicatorPriority,
  sortIndicatorsByPriority,
  buildUserContextFromMoods
};
