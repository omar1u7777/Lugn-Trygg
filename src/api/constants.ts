/**
 * API-related constants for better maintainability and type safety.
 * Endpoints are grouped by feature for improved readability and organization.
 */

// API Endpoints - Grouped by feature for better maintainability
export const API_ENDPOINTS = {
  /** Authentication endpoints */
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH_TOKEN: '/api/auth/google-login',
    RESET_PASSWORD: '/api/auth/reset-password',
    CHANGE_EMAIL: '/api/auth/change-email',
    CHANGE_PASSWORD: '/api/auth/change-password',
    SETUP_2FA: '/api/auth/setup-2fa',
    VERIFY_2FA_SETUP: '/api/auth/verify-2fa-setup',
    EXPORT_DATA: '/api/auth/export-data',
    DELETE_ACCOUNT: '/api/auth/delete-account',
    CSRF_TOKEN: '/api/dashboard/csrf-token',
  } as const,

  /** Mood tracking endpoints */
  MOOD: {
    LOG_MOOD: '/api/mood/log',
    GET_MOODS: '/api/mood',
    MOOD_WEEKLY_ANALYSIS: '/api/mood/weekly-analysis',
    MOOD_STATS: '/api/mood-stats/statistics',
    ANALYZE_TEXT: '/api/mood/analyze-text',
  } as const,

  /** Dashboard endpoints */
  DASHBOARD: {
    DASHBOARD_SUMMARY: '/api/dashboard',
    DASHBOARD_QUICK_STATS: '/api/dashboard',
  } as const,

  /** Memory management endpoints */
  MEMORY: {
    LIST_MEMORIES: '/api/memory/list',
    GET_MEMORY_URL: '/api/memory/get',
  } as const,

  /** Chatbot endpoints */
  CHATBOT: {
    CHAT: '/api/chatbot/chat',
    CHAT_HISTORY: '/api/chatbot/history',
    ANALYZE_PATTERNS: '/api/chatbot/analyze-patterns',
  } as const,

  /** Referral system endpoints */
  REFERRAL: {
    LEADERBOARD: '/api/referral/leaderboard',
    GENERATE_REFERRAL: '/api/referral/generate',
  } as const,

  /** User/Wellness endpoints */
  USERS: {
    WELLNESS_GOALS: '/api/users',
    JOURNAL: '/api/users',
    MEDITATION_SESSIONS: '/api/users',
  } as const,

  /** Onboarding endpoints */
  ONBOARDING: {
    GOALS: '/api/onboarding/goals',
    STATUS: '/api/onboarding/status',
    SKIP: '/api/onboarding/skip',
  } as const,

  /** Notification endpoints */
  NOTIFICATIONS: {
    FCM_TOKEN: '/api/notifications/fcm-token',
    SEND_REMINDER: '/api/notifications/send-reminder',
    SCHEDULE_DAILY: '/api/notifications/schedule-daily',
    DISABLE_ALL: '/api/notifications/disable-all',
    NOTIFICATION_SETTINGS: '/api/notifications/settings',
  } as const,

  /** Challenge system endpoints */
  CHALLENGES: {
    CHALLENGES: '/api/challenges',
    CHALLENGE_JOIN: '/api/challenges',
    CHALLENGE_LEAVE: '/api/challenges',
    CHALLENGE_PROGRESS: '/api/challenges',
    USER_CHALLENGES: '/api/challenges/user',
  } as const,

  /** Rewards system endpoints */
  REWARDS: {
    REWARD_CATALOG: '/api/rewards/catalog',
    ACHIEVEMENTS: '/api/rewards/achievements',
    USER_REWARDS: '/api/rewards/user',
    CLAIM_REWARD: '/api/rewards/user',
  } as const,

  /** Audio content endpoints */
  AUDIO: {
    AUDIO_CATEGORIES: '/api/audio/categories',
    AUDIO_CATEGORY: '/api/audio/category',
    AUDIO_LIBRARY: '/api/audio/all',
    AUDIO_SEARCH: '/api/audio/search',
  } as const,

  /** Peer chat endpoints */
  PEER_CHAT: {
    CHAT_ROOMS: '/api/peer-chat/rooms',
    CHAT_ROOM_JOIN: '/api/peer-chat/room',
    CHAT_ROOM_LEAVE: '/api/peer-chat/room',
    CHAT_MESSAGES: '/api/peer-chat/room',
    CHAT_SEND: '/api/peer-chat/room',
    CHAT_LIKE: '/api/peer-chat/message',
    CHAT_REPORT: '/api/peer-chat/message',
    CHAT_TYPING: '/api/peer-chat/room',
    CHAT_PRESENCE: '/api/peer-chat/room',
  } as const,

  /** Leaderboard endpoints */
  LEADERBOARD: {
    XP_LEADERBOARD: '/api/leaderboard/xp',
    STREAK_LEADERBOARD: '/api/leaderboard/streaks',
    MOOD_LEADERBOARD: '/api/leaderboard/moods',
    USER_RANKING: '/api/leaderboard/user',
    WEEKLY_WINNERS: '/api/leaderboard/weekly-winners',
  } as const,

  /** Voice processing endpoints */
  VOICE: {
    TRANSCRIBE_AUDIO: '/api/voice/transcribe',
    ANALYZE_VOICE_EMOTION: '/api/voice/analyze-emotion',
    VOICE_STATUS: '/api/voice/status',
  } as const,

  /** Sync history endpoints */
  SYNC_HISTORY: {
    SYNC_HISTORY_LIST: '/api/sync-history/list',
    SYNC_HISTORY_LOG: '/api/sync-history/log',
    SYNC_HISTORY_STATS: '/api/sync-history/stats',
    SYNC_HISTORY_RETRY: '/api/sync-history/retry',
  } as const,
} as const;

// Type definitions for better type safety and IntelliSense
export type APIEndpoints = typeof API_ENDPOINTS;

/** HTTP status codes for API responses */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/** User-facing error messages in Swedish */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Nätverksfel. Kontrollera din internetanslutning.',
  OFFLINE_QUEUED: 'Nätverksfel. Förfrågan sparad för senare synkronisering.',
  RATE_LIMIT_EXCEEDED: 'För många förfrågningar. Försök igen om',
  TIMEOUT: 'Förfrågan tog för lång tid. Kontrollera din internetanslutning.',
  UNAUTHORIZED: 'Du är inte inloggad. Logga in igen.',
  SERVER_ERROR: 'Serverfel. Försök igen senare.',
  VALIDATION_ERROR: 'Ogiltiga uppgifter.',
  UNKNOWN_ERROR: 'Ett oväntat fel uppstod.',
} as const;

/** Default configuration values for API limits and timeouts */
export const DEFAULTS = {
  LEADERBOARD_LIMIT: 20,
  JOURNAL_LIMIT: 50,
  MEDITATION_LIMIT: 50,
  CHAT_HISTORY_LIMIT: 100,
  RETRY_ATTEMPTS: 3,
  TIMEOUT_MS: 30000,
  CACHE_DURATION_MS: 300000, // 5 minutes
} as const;

/** Firebase-related log messages and status indicators */
export const FIREBASE_MESSAGES = {
  TOKEN_REFRESH_SUCCESS: "🔄 Firebase token refreshed successfully",
  TOKEN_REFRESH_FAILED: "❌ Firebase token refresh failed:",
  USER_NOT_FOUND: "⚠️ No Firebase user found",
  MODULE_NOT_AVAILABLE: "⚠️ Firebase module not available",
} as const;