import api from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssessmentType = 'phq9' | 'gad7';

export type SeverityLevel =
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'moderately_severe'
  | 'severe';

export interface PHQ9Result {
  total_score: number;
  severity: SeverityLevel;
  risk_level: string;
  suicidal_ideation: boolean;
  item_scores: Record<string, number>;
  interpretation: string;
  recommendations: string[];
}

export interface GAD7Result {
  total_score: number;
  severity: SeverityLevel;
  risk_level: string;
  item_scores: Record<string, number>;
  interpretation: string;
  recommendations: string[];
}

export type AssessmentResult = PHQ9Result | GAD7Result;

export interface AssessmentHistoryEntry {
  id: string;
  type: AssessmentType;
  total_score: number;
  severity: SeverityLevel;
  risk_level: string;
  suicidal_ideation?: boolean;
  timestamp: string;
  recommendations?: string[];
}

export interface AssessmentHistoryResponse {
  history: AssessmentHistoryEntry[];
  total: number;
}

export interface ComprehensiveRiskResult {
  timestamp: string;
  composite_risk: string;
  risk_factors: string[];
  protective_factors: string[];
  immediate_concerns: string[];
  suggested_interventions: string[];
  follow_up_recommended: boolean;
  follow_up_timeframe: string;
  latest_phq9: AssessmentHistoryEntry | null;
  latest_gad7: AssessmentHistoryEntry | null;
}

// ---------------------------------------------------------------------------
// API calls  — all endpoints under /api/v1/advanced-mood/assess/
// ---------------------------------------------------------------------------

const BASE = '/api/v1/advanced-mood/assess';

/**
 * Submit PHQ-9 responses and receive a scored result stored in Firestore.
 */
export async function submitPHQ9(
  responses: Record<string, number>,
  signal?: AbortSignal,
): Promise<PHQ9Result> {
  const res = await api.post<{ success: boolean; data: PHQ9Result }>(
    `${BASE}/phq9`,
    { responses },
    signal ? { signal } : undefined,
  );
  if (!res.data?.success) throw new Error('PHQ-9 calculation failed');
  return res.data.data;
}

/**
 * Submit GAD-7 responses and receive a scored result stored in Firestore.
 */
export async function submitGAD7(
  responses: Record<string, number>,
  signal?: AbortSignal,
): Promise<GAD7Result> {
  const res = await api.post<{ success: boolean; data: GAD7Result }>(
    `${BASE}/gad7`,
    { responses },
    signal ? { signal } : undefined,
  );
  if (!res.data?.success) throw new Error('GAD-7 calculation failed');
  return res.data.data;
}

/**
 * Fetch the N most recent assessments for the authenticated user.
 * Optionally filter by type ('phq9' | 'gad7').
 */
export async function getAssessmentHistory(
  options: { type?: AssessmentType; limit?: number; signal?: AbortSignal } = {},
): Promise<AssessmentHistoryResponse> {
  const params: Record<string, string | number> = {};
  if (options.type) params.type = options.type;
  if (options.limit) params.limit = options.limit;

  const res = await api.get<{ success: boolean; data: AssessmentHistoryResponse }>(
    `${BASE}/history`,
    { params, ...(options.signal ? { signal: options.signal } : {}) },
  );
  if (!res.data?.success) throw new Error('Could not retrieve assessment history');
  return res.data.data;
}

/**
 * Get comprehensive clinical risk combining PHQ-9, GAD-7 and recent mood data.
 */
export async function getComprehensiveRisk(): Promise<ComprehensiveRiskResult> {
  const res = await api.get<{ success: boolean; data: ComprehensiveRiskResult }>(
    `${BASE}/comprehensive`,
  );
  if (!res.data?.success) throw new Error('Comprehensive assessment failed');
  return res.data.data;
}
