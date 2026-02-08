import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Backend Challenge interface (raw from API - now camelCase)
 */
interface BackendChallenge {
  id: string;
  title: string;
  description: string;
  goal: number;
  currentProgress: number;
  teamSize: number;
  maxTeamSize: number;
  startDate: string;
  endDate: string;
  rewardXp: number;
  rewardBadge: string;
  category: 'mood' | 'meditation' | 'journal' | 'streak';
  difficulty: 'easy' | 'medium' | 'hard';
  members: BackendChallengeMember[];
  createdAt: string;
  active: boolean;
  completed?: boolean;
  completedAt?: string;
}

/**
 * Backend ChallengeMember interface (camelCase)
 */
interface BackendChallengeMember {
  userId: string;
  username: string;
  contribution: number;
  joinedAt: string;
}

/**
 * Frontend Challenge interface (adapted for UI with snake_case aliases for backward compatibility)
 */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  goal: number;
  target_value: number; // Alias for goal
  currentProgress: number;
  current_progress: number; // Alias for currentProgress
  teamSize: number;
  team_size: number; // Alias for teamSize
  maxTeamSize: number;
  max_team_size: number; // Alias for maxTeamSize
  startDate: string;
  start_date: string; // Alias for startDate
  endDate: string;
  end_date: string; // Alias for endDate
  duration_days: number; // Calculated from dates
  rewardXp: number;
  reward_xp: number; // Alias for rewardXp
  xp_reward: number; // Alias for rewardXp
  rewardBadge: string;
  reward_badge: string; // Alias for rewardBadge
  badge_reward: string; // Alias for rewardBadge
  category: 'mood' | 'meditation' | 'journal' | 'streak';
  type: string; // Alias for category
  difficulty: 'easy' | 'medium' | 'hard';
  members: ChallengeMember[];
  participants: ChallengeMember[]; // Alias for members
  createdAt: string;
  created_at: string; // Alias for createdAt
  active: boolean;
  completed?: boolean;
  completedAt?: string;
  completed_at?: string; // Alias for completedAt
}

export interface ChallengeMember {
  userId: string;
  user_id: string; // Alias for backward compatibility
  username: string;
  contribution: number;
  joinedAt: string;
  joined_at: string; // Alias for backward compatibility
}

export interface ChallengesResponse {
  success: boolean;
  message?: string;
  data?: {
    challenges: BackendChallenge[];
    source?: 'firestore' | 'memory';
  };
  // Direct format for backward compatibility
  challenges?: BackendChallenge[];
  source?: 'firestore' | 'memory';
}

export interface ChallengeResponse {
  success: boolean;
  message?: string;
  data?: {
    challenge: BackendChallenge;
  };
  // Direct format for backward compatibility
  challenge?: BackendChallenge;
}

export interface JoinLeaveResponse {
  success: boolean;
  message: string;
  data?: {
    message: string;
    challengeId?: string;
  };
  error?: string;
}

export interface ContributeResponse {
  success: boolean;
  message: string;
  data?: {
    message: string;
    newProgress: number;
    goal: number;
    completed?: boolean;
    userContribution?: number;
  };
  error?: string;
}

export interface UserChallengesResponse {
  success: boolean;
  message?: string;
  data?: {
    challenges: BackendChallenge[];
  };
  // Direct format for backward compatibility
  challenges?: BackendChallenge[];
}

/**
 * Transform backend challenge to frontend format with snake_case aliases
 */
function transformChallenge(backend: BackendChallenge): Challenge {
  // Calculate duration in days from start/end dates
  const startDate = new Date(backend.startDate);
  const endDate = new Date(backend.endDate);
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

  // Transform members from camelCase backend to dual-format
  const transformedMembers: ChallengeMember[] = (backend.members || []).map(m => ({
    userId: m.userId,
    user_id: m.userId,
    username: m.username,
    contribution: m.contribution,
    joinedAt: m.joinedAt,
    joined_at: m.joinedAt
  }));

  return {
    id: backend.id,
    title: backend.title,
    description: backend.description,
    goal: backend.goal,
    target_value: backend.goal,
    currentProgress: backend.currentProgress,
    current_progress: backend.currentProgress,
    teamSize: backend.teamSize,
    team_size: backend.teamSize,
    maxTeamSize: backend.maxTeamSize,
    max_team_size: backend.maxTeamSize,
    startDate: backend.startDate,
    start_date: backend.startDate,
    endDate: backend.endDate,
    end_date: backend.endDate,
    duration_days: durationDays,
    rewardXp: backend.rewardXp,
    reward_xp: backend.rewardXp,
    xp_reward: backend.rewardXp,
    rewardBadge: backend.rewardBadge,
    reward_badge: backend.rewardBadge,
    badge_reward: backend.rewardBadge,
    category: backend.category,
    type: backend.category,
    difficulty: backend.difficulty,
    members: transformedMembers,
    participants: transformedMembers,
    createdAt: backend.createdAt,
    created_at: backend.createdAt,
    active: backend.active,
    completed: backend.completed,
    completedAt: backend.completedAt,
    completed_at: backend.completedAt
  };
}

/**
 * Get available challenges
 * @param activeOnly - If true, only return active challenges (default: true)
 * @returns Promise resolving to challenges data
 * @throws Error if challenges retrieval fails
 */
export const getChallenges = async (_activeOnly: boolean = true): Promise<Challenge[]> => {
  try {
    const response = await api.get<ChallengesResponse>(API_ENDPOINTS.CHALLENGES.CHALLENGES);
    // Handle both APIResponse format (data.challenges) and direct format (challenges)
    const backendChallenges = response.data.data?.challenges || response.data.challenges || [];
    return backendChallenges.map(transformChallenge);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get a specific challenge by ID
 * @param challengeId - Challenge ID
 * @returns Promise resolving to challenge data
 * @throws Error if challenge not found
 */
export const getChallenge = async (challengeId: string): Promise<Challenge> => {
  try {
    const response = await api.get<ChallengeResponse>(
      `${API_ENDPOINTS.CHALLENGES.CHALLENGE_BY_ID}/${challengeId}`
    );
    // Handle both APIResponse format (data.challenge) and direct format (challenge)
    const backendChallenge = response.data.data?.challenge || response.data.challenge;
    if (!backendChallenge) {
      throw new ApiError('Challenge not found', 404);
    }
    return transformChallenge(backendChallenge);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Join a challenge
 * @param challengeId - Challenge ID to join
 * @param username - Optional username to display
 * @returns Promise resolving to join response
 * @throws Error if join fails
 */
export const joinChallenge = async (
  challengeId: string,
  username?: string
): Promise<JoinLeaveResponse> => {
  try {
    const response = await api.post<JoinLeaveResponse>(
      `${API_ENDPOINTS.CHALLENGES.CHALLENGE_JOIN}/${challengeId}/join`,
      username ? { username } : undefined
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Leave a challenge
 * @param challengeId - Challenge ID to leave
 * @returns Promise resolving to leave response
 * @throws Error if leave fails
 */
export const leaveChallenge = async (challengeId: string): Promise<JoinLeaveResponse> => {
  try {
    const response = await api.post<JoinLeaveResponse>(
      `${API_ENDPOINTS.CHALLENGES.CHALLENGE_LEAVE}/${challengeId}/leave`
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Contribute to a challenge (called when user logs mood, meditates, etc.)
 * @param challengeId - Challenge ID to contribute to
 * @param type - Type of contribution: 'mood' | 'meditation' | 'journal' | 'streak'
 * @param amount - Amount to contribute (default: 1, max: 50)
 * @returns Promise resolving to contribution response
 * @throws Error if contribution fails
 */
export const contributeToChallenge = async (
  challengeId: string,
  type: 'mood' | 'meditation' | 'journal' | 'streak',
  amount: number = 1
): Promise<ContributeResponse> => {
  try {
    const response = await api.post<ContributeResponse>(
      `${API_ENDPOINTS.CHALLENGES.CHALLENGE_CONTRIBUTE}/${challengeId}/contribute`,
      { type, amount }
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get user's challenges
 * @param userId - User ID
 * @returns Promise resolving to user challenges data with transformed challenges
 * @throws Error if retrieval fails
 */
export const getUserChallenges = async (userId: string): Promise<{ challenges: Challenge[]; progress?: Record<string, { current_value: number; completed: boolean }> }> => {
  try {
    const response = await api.get<UserChallengesResponse>(
      `${API_ENDPOINTS.CHALLENGES.USER_CHALLENGES}/${userId}`
    );
    // Handle both APIResponse format (data.challenges) and direct format (challenges)
    const backendChallenges = response.data.data?.challenges || response.data.challenges || [];
    return {
      challenges: backendChallenges.map(transformChallenge),
      progress: {} // Backend doesn't return separate progress, it's in challenge.currentProgress
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};