/**
 * CBT (Cognitive Behavioral Therapy) API Service
 * 
 * Provides functions for interacting with CBT modules, exercises,
 * personalized sessions, and progress tracking.
 */

import { api } from './client';
import { API_ENDPOINTS } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CBTModule {
  moduleId: string;
  title: string;
  description: string;
  category: 'anxiety' | 'depression' | 'stress' | 'general';
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  prerequisites: string[];
  learningObjectives: string[];
  completionCriteria: Record<string, unknown>;
  isCompleted?: boolean;
  isLocked?: boolean;
  swedishContent?: {
    introduction?: string;
    keyConceptsᴇ?: string[];
    commonMisconceptions?: string[];
  };
  exercises?: CBTExercise[];
}

export interface CBTExercise {
  exerciseId: string;
  moduleId: string;
  title: string;
  type: 'thought_record' | 'behavioral_experiment' | 'exposure' | 'cognitive_restructuring';
  difficulty: string;
  duration: number;
  instructions: string;
  prompts: string[];
  successMetrics: string[];
}

export interface PersonalizedSession {
  exercises: CBTExercise[];
  sessionTheme: string;
  estimatedDuration: number;
  difficultyProgression: string;
  motivationalElements: string[];
  guidance: string;
}

export interface CBTProgress {
  skillMastery: Record<string, number>;
  streakCount: number;
  completedModules: string[];
  achievements: string[];
}

export interface CBTInsights {
  overallProgress: number;
  strengthAreas: string[];
  improvementAreas: string[];
  recommendedNextSteps: string[];
  streak: {
    current: number;
    longest: number;
    consistencyRating: string;
  };
  exercisesCompleted: number;
  modulesCompleted: number;
}

export interface ExerciseCompletionData {
  exerciseId: string;
  successRate: number;
  timeSpent: number;
  difficultyRating: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all available CBT modules
 */
export async function getCBTModules(): Promise<CBTModule[]> {
  const response = await api.get<{ modules: CBTModule[] }>(API_ENDPOINTS.CBT.MODULES);
  return response.data.modules;
}

/**
 * Get detailed information about a specific module
 */
export async function getCBTModuleDetail(moduleId: string): Promise<CBTModule> {
  const response = await api.get<{ module: CBTModule }>(
    `${API_ENDPOINTS.CBT.MODULE_DETAIL}/${moduleId}`
  );
  return response.data.module;
}

/**
 * Get a personalized CBT session based on current mood
 */
export async function getPersonalizedSession(mood?: string): Promise<PersonalizedSession> {
  const params = mood ? { mood } : {};
  const response = await api.get<{ session: PersonalizedSession }>(
    API_ENDPOINTS.CBT.SESSION,
    { params }
  );
  return response.data.session;
}

/**
 * Update progress after completing an exercise
 */
export async function updateCBTProgress(data: ExerciseCompletionData): Promise<CBTProgress> {
  const response = await api.post<CBTProgress>(API_ENDPOINTS.CBT.PROGRESS, data);
  return response.data;
}

/**
 * Get user's CBT insights and statistics
 */
export async function getCBTInsights(): Promise<CBTInsights> {
  const response = await api.get<{ insights: CBTInsights }>(API_ENDPOINTS.CBT.INSIGHTS);
  return response.data.insights;
}

/**
 * Get all CBT exercises, optionally filtered
 */
export async function getCBTExercises(filters?: {
  module?: string;
  type?: string;
}): Promise<CBTExercise[]> {
  const response = await api.get<{ exercises: CBTExercise[] }>(
    API_ENDPOINTS.CBT.EXERCISES,
    { params: filters }
  );
  return response.data.exercises;
}
