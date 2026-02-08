/**
 * API-related constants for better maintainability and type safety.
 * Endpoints are grouped by feature for improved readability and organization.
 */

// API Endpoints - Grouped by feature for better maintainability
export const API_ENDPOINTS = {
  /** Authentication endpoints */
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH_TOKEN: '/api/v1/auth/refresh',
    GOOGLE_LOGIN: '/api/v1/auth/google-login',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    CONFIRM_PASSWORD_RESET: '/api/v1/auth/confirm-password-reset',
    CHANGE_EMAIL: '/api/v1/auth/change-email',
    CHANGE_PASSWORD: '/api/v1/auth/change-password',
    CONSENT: '/api/v1/auth/consent',
    SETUP_2FA: '/api/v1/auth/setup-2fa',
    SETUP_2FA_BIOMETRIC: '/api/v1/auth/setup-2fa-biometric',
    VERIFY_2FA: '/api/v1/auth/verify-2fa',
    VERIFY_2FA_SETUP: '/api/v1/auth/verify-2fa-setup',
    EXPORT_DATA: '/api/v1/auth/export-data',
    DELETE_ACCOUNT: '/api/v1/auth/delete-account',
    CSRF_TOKEN: '/api/v1/dashboard/csrf-token',
  } as const,

  /** Mood tracking endpoints */
  MOOD: {
    LOG_MOOD: '/api/v1/mood/log',
    GET_MOODS: '/api/v1/mood',
    MOOD_WEEKLY_ANALYSIS: '/api/v1/mood/weekly-analysis',
    MOOD_STATS: '/api/v1/mood-stats/statistics',
    ANALYZE_TEXT: '/api/v1/mood/analyze-text',
    PREDICTIVE_FORECAST: '/api/v1/mood/predictive-forecast',
    DELETE: '/api/v1/mood/delete',
  } as const,

  /** Dashboard endpoints */
  DASHBOARD: {
    /** GET dashboard summary - append /{userId}/summary */
    DASHBOARD_SUMMARY: '/api/v1/dashboard',
    /** GET quick stats - append /{userId}/quick-stats */
    DASHBOARD_QUICK_STATS: '/api/v1/dashboard',
    /** GET legacy dashboard (uses JWT user) */
    LEGACY: '/api/v1/dashboard',
    /** GET legacy stats (uses JWT user) */
    LEGACY_STATS: '/api/v1/dashboard/stats',
    /** GET CSRF token */
    CSRF_TOKEN: '/api/v1/dashboard/csrf-token',
  } as const,

  /** Memory management endpoints */
  MEMORY: {
    /** GET /api/v1/memory/list/{userId} - List user's memories */
    LIST_MEMORIES: '/api/v1/memory/list',
    /** GET /api/v1/memory/get/{memoryId} - Get signed URL for memory */
    GET_MEMORY_URL: '/api/v1/memory/get',
    /** POST /api/v1/memory/upload - Upload audio memory (requires auth, form data) */
    UPLOAD_MEMORY: '/api/v1/memory/upload',
  } as const,

  /** Chatbot endpoints */
  CHATBOT: {
    /** POST send message to AI chatbot */
    CHAT: '/api/v1/chatbot/chat',
    /** POST legacy alias for /chat */
    MESSAGE: '/api/v1/chatbot/message',
    /** GET conversation history */
    CHAT_HISTORY: '/api/v1/chatbot/history',
    /** POST analyze mood patterns */
    ANALYZE_PATTERNS: '/api/v1/chatbot/analyze-patterns',
    /** POST start exercise session */
    EXERCISE: '/api/v1/chatbot/exercise',
    /** POST mark exercise complete - append /{userId}/{exerciseId}/complete */
    EXERCISE_COMPLETE: '/api/v1/chatbot/exercise',
  } as const,

  /** Referral system endpoints */
  REFERRAL: {
    LEADERBOARD: '/api/v1/referral/leaderboard',
    GENERATE_REFERRAL: '/api/v1/referral/generate',
    STATS: '/api/v1/referral/stats',
    HISTORY: '/api/v1/referral/history',
    INVITE: '/api/v1/referral/invite',
    REWARDS_CATALOG: '/api/v1/referral/rewards/catalog',
    REWARDS_REDEEM: '/api/v1/referral/rewards/redeem',
  } as const,

  /** User/Wellness endpoints */
  USERS: {
    WELLNESS_GOALS: '/api/v1/users',
    /** @deprecated Use JOURNAL section instead */
    JOURNAL: '/api/v1/journal',
    MEDITATION_SESSIONS: '/api/v1/users',
  } as const,

  /** Journal endpoints - Mental health journaling */
  JOURNAL: {
    /** Base path for journal operations - append /{userId}/journal */
    BASE: '/api/v1/journal',
    /** GET/POST journal entries - append /{userId}/journal */
    ENTRIES: '/api/v1/journal',
    /** PUT/DELETE single entry - append /{userId}/journal/{entryId} */
    ENTRY: '/api/v1/journal',
  } as const,

  /** Onboarding endpoints */
  ONBOARDING: {
    GOALS: '/api/v1/onboarding/goals',
    STATUS: '/api/v1/onboarding/status',
    SKIP: '/api/v1/onboarding/skip',
  } as const,

  /** Notification endpoints */
  NOTIFICATIONS: {
    FCM_TOKEN: '/api/v1/notifications/fcm-token',
    SEND_REMINDER: '/api/v1/notifications/send-reminder',
    SCHEDULE_DAILY: '/api/v1/notifications/schedule-daily',
    DISABLE_ALL: '/api/v1/notifications/disable-all',
    NOTIFICATION_SETTINGS: '/api/v1/notifications/settings',
  } as const,

  /** Feedback endpoints */
  FEEDBACK: {
    /** POST submit feedback */
    SUBMIT: '/api/v1/feedback/submit',
    /** GET list all feedback (admin only) */
    LIST: '/api/v1/feedback/list',
    /** GET feedback statistics (admin only) */
    STATS: '/api/v1/feedback/stats',
    /** GET current user's feedback history */
    MY_FEEDBACK: '/api/v1/feedback/my-feedback',
  } as const,

  /** Challenge system endpoints */
  CHALLENGES: {
    /** GET all active challenges */
    CHALLENGES: '/api/v1/challenges',
    /** GET single challenge by ID - append /{id} */
    CHALLENGE_BY_ID: '/api/v1/challenges',
    /** POST join challenge - append /{id}/join */
    CHALLENGE_JOIN: '/api/v1/challenges',
    /** POST leave challenge - append /{id}/leave */
    CHALLENGE_LEAVE: '/api/v1/challenges',
    /** POST contribute to challenge - append /{id}/contribute */
    CHALLENGE_CONTRIBUTE: '/api/v1/challenges',
    /** GET user's challenges - append /{userId} */
    USER_CHALLENGES: '/api/v1/challenges/user',
    /** POST trigger cleanup (admin) */
    MAINTENANCE_CLEANUP: '/api/v1/challenges/maintenance/cleanup',
  } as const,

  /** Consent management endpoints (GDPR compliance) */
  CONSENT: {
    /** POST grant bulk consents | GET all user consents */
    BASE: '/api/v1/consent',
    /** POST grant specific consent - append /{consentType} */
    GRANT: '/api/v1/consent',
    /** DELETE withdraw consent - append /{consentType} */
    WITHDRAW: '/api/v1/consent',
    /** GET validate feature access - append /validate/{feature} */
    VALIDATE: '/api/v1/consent/validate',
    /** GET check consent status - append /check/{consentType} */
    CHECK: '/api/v1/consent/check',
  } as const,

  /** Rewards system endpoints */
  REWARDS: {
    /** GET reward catalog */
    REWARD_CATALOG: '/api/v1/rewards/catalog',
    /** GET all achievements */
    ACHIEVEMENTS: '/api/v1/rewards/achievements',
    /** GET user rewards profile */
    PROFILE: '/api/v1/rewards/profile',
    /** POST claim a reward */
    CLAIM: '/api/v1/rewards/claim',
    /** POST add XP */
    ADD_XP: '/api/v1/rewards/add-xp',
    /** POST check achievements */
    CHECK_ACHIEVEMENTS: '/api/v1/rewards/check-achievements',
    /** GET user badges */
    BADGES: '/api/v1/rewards/badges',
  } as const,

  /** Audio content endpoints */
  AUDIO: {
    AUDIO_CATEGORIES: '/api/v1/audio/categories',
    AUDIO_CATEGORY: '/api/v1/audio/category',
    AUDIO_LIBRARY: '/api/v1/audio/library',
    AUDIO_TRACK: '/api/v1/audio/track',
    AUDIO_SEARCH: '/api/v1/audio/search',
  } as const,

  /** AI-powered features endpoints */
  AI: {
    GENERATE_STORY: '/api/v1/ai/story',
    GET_STORIES: '/api/v1/ai/stories',
    GENERATE_FORECAST: '/api/v1/ai/forecast',
    GET_FORECASTS: '/api/v1/ai/forecasts',
  } as const,

  /** Admin dashboard endpoints (Admin only) */
  ADMIN: {
    PERFORMANCE_METRICS: '/api/v1/admin/performance-metrics',
    STATS: '/api/v1/admin/stats',
    USERS: '/api/v1/admin/users',
    REPORTS: '/api/v1/admin/reports',
    SYSTEM_HEALTH: '/api/v1/admin/system/health',
  } as const,

  /** Security and monitoring endpoints (Admin only) */
  SECURITY: {
    /** GET API key rotation status */
    KEY_ROTATION_STATUS: '/api/v1/security/key-rotation/status',
    /** GET tamper detection events (query param: limit) */
    TAMPER_EVENTS: '/api/v1/security/tamper/events',
    /** GET security monitoring metrics */
    MONITORING_METRICS: '/api/v1/security/monitoring/metrics',
  } as const,

  /** Peer chat endpoints */
  PEER_CHAT: {
    CHAT_ROOMS: '/api/v1/peer-chat/rooms',
    CHAT_ROOM_JOIN: '/api/v1/peer-chat/room',
    CHAT_ROOM_LEAVE: '/api/v1/peer-chat/room',
    CHAT_MESSAGES: '/api/v1/peer-chat/room',
    CHAT_SEND: '/api/v1/peer-chat/room',
    CHAT_LIKE: '/api/v1/peer-chat/message',
    CHAT_REPORT: '/api/v1/peer-chat/message',
    CHAT_TYPING: '/api/v1/peer-chat/room',
    CHAT_PRESENCE: '/api/v1/peer-chat/room',
  } as const,

  /** Leaderboard endpoints */
  LEADERBOARD: {
    BASE: '/api/v1/leaderboard',
    XP_LEADERBOARD: '/api/v1/leaderboard/xp',
    STREAK_LEADERBOARD: '/api/v1/leaderboard/streaks',
    MOOD_LEADERBOARD: '/api/v1/leaderboard/moods',
    USER_RANKING: '/api/v1/leaderboard/user',
    WEEKLY_WINNERS: '/api/v1/leaderboard/weekly-winners',
  } as const,

  /** Voice processing endpoints */
  VOICE: {
    TRANSCRIBE_AUDIO: '/api/v1/voice/transcribe',
    ANALYZE_VOICE_EMOTION: '/api/v1/voice/analyze-emotion',
    VOICE_STATUS: '/api/v1/voice/status',
  } as const,

  /** Predictive AI endpoints */
  PREDICTIVE: {
    PREDICT: '/api/v1/predictive/predict',
    INSIGHTS: '/api/v1/predictive/insights',
    TRENDS: '/api/v1/predictive/trends',
    CRISIS_CHECK: '/api/v1/predictive/crisis-check',
  } as const,

  /** Sync history endpoints */
  SYNC_HISTORY: {
    SYNC_HISTORY_LIST: '/api/v1/sync-history/list',
    SYNC_HISTORY_LOG: '/api/v1/sync-history/log',
    SYNC_HISTORY_STATS: '/api/v1/sync-history/stats',
    SYNC_HISTORY_RETRY: '/api/v1/sync-history/retry',
  } as const,

  /** Health monitoring endpoints (admin/ops) - no v1 prefix */
  HEALTH: {
    /** GET basic health check - public */
    CHECK: '/api/health',
    /** GET readiness probe - public */
    READY: '/api/health/ready',
    /** GET liveness probe - public */
    LIVE: '/api/health/live',
    /** GET system metrics - admin only */
    METRICS: '/api/health/metrics',
    /** GET database health - requires auth */
    DATABASE: '/api/health/db',
    /** GET advanced comprehensive health report - admin only */
    ADVANCED: '/api/health/advanced',
  } as const,

  /** Subscription and payment endpoints (Stripe integration) */
  SUBSCRIPTION: {
    /** POST create Stripe checkout session for subscription */
    CREATE_SESSION: '/api/v1/subscription/create-session',
    /** GET subscription status - append /{userId} */
    STATUS: '/api/v1/subscription/status',
    /** POST handle Stripe webhooks (internal) */
    WEBHOOK: '/api/v1/subscription/webhook',
    /** POST purchase CBT module (one-time payment) */
    PURCHASE_CBT_MODULE: '/api/v1/subscription/purchase-cbt-module',
    /** GET available subscription plans */
    PLANS: '/api/v1/subscription/plans',
    /** GET user's purchased items - append /{userId} */
    PURCHASES: '/api/v1/subscription/purchases',
    /** POST cancel subscription - append /{userId} */
    CANCEL: '/api/v1/subscription/cancel',
  } as const,

  /** CBT (Cognitive Behavioral Therapy) endpoints */
  CBT: {
    /** GET all available CBT modules */
    MODULES: '/api/v1/cbt/modules',
    /** GET specific module details - append /{moduleId} */
    MODULE_DETAIL: '/api/v1/cbt/modules',
    /** GET personalized CBT session */
    SESSION: '/api/v1/cbt/session',
    /** POST update user CBT progress */
    PROGRESS: '/api/v1/cbt/progress',
    /** GET user CBT insights */
    INSIGHTS: '/api/v1/cbt/insights',
    /** GET all CBT exercises */
    EXERCISES: '/api/v1/cbt/exercises',
  } as const,

  /** Crisis Intervention endpoints - Mental health crisis detection and support */
  CRISIS: {
    /** POST assess crisis risk based on user data */
    ASSESS: '/api/v1/crisis/assess',
    /** GET user's personalized safety plan */
    SAFETY_PLAN: '/api/v1/crisis/safety-plan',
    /** PUT update safety plan */
    UPDATE_SAFETY_PLAN: '/api/v1/crisis/safety-plan',
    /** GET intervention protocol for risk level - append /protocols/{risk_level} */
    PROTOCOLS: '/api/v1/crisis/protocols',
    /** GET user's crisis assessment history - query param: limit */
    HISTORY: '/api/v1/crisis/history',
    /** GET all available crisis indicators */
    INDICATORS: '/api/v1/crisis/indicators',
    /** POST check if crisis requires escalation */
    CHECK_ESCALATION: '/api/v1/crisis/check-escalation',
  } as const,

  /** API Documentation endpoints (developer tools) - no v1 prefix */
  DOCS: {
    /** GET Swagger UI documentation interface */
    SWAGGER_UI: '/api/docs',
    /** GET ReDoc documentation interface */
    REDOC: '/api/docs/redoc',
    /** GET OpenAPI specification in JSON format */
    OPENAPI_JSON: '/api/docs/openapi.json',
    /** GET OpenAPI specification in YAML format */
    OPENAPI_YAML: '/api/docs/openapi.yaml',
    /** GET documentation service health check */
    HEALTH: '/api/docs/health',
    /** GET authentication test page (development only) */
    TEST_AUTH: '/api/docs/test-auth',
  } as const,

  /** Privacy and GDPR Compliance endpoints */
  PRIVACY: {
    /** GET privacy settings - append /{userId} */
    SETTINGS: '/api/v1/privacy/settings',
    /** GET data export - append /{userId} */
    EXPORT: '/api/v1/privacy/export',
    /** POST delete user data - append /{userId} */
    DELETE: '/api/v1/privacy/delete',
    /** GET data retention status - append /{userId} */
    RETENTION_STATUS: '/api/v1/privacy/retention/status',
    /** POST manual retention cleanup - append /{userId} */
    RETENTION_CLEANUP: '/api/v1/privacy/retention/cleanup',
    /** POST system-wide retention cleanup (admin) */
    RETENTION_CLEANUP_ALL: '/api/v1/privacy/retention/cleanup-all',
    /** GET consent status - append /{userId} */
    CONSENT_GET: '/api/v1/privacy/consent',
    /** POST grant consent - append /{userId}/{consentType} */
    CONSENT_GRANT: '/api/v1/privacy/consent',
    /** DELETE withdraw consent - append /{userId}/{consentType} */
    CONSENT_WITHDRAW: '/api/v1/privacy/consent',
    /** GET validate consent - append /{userId}/{feature} */
    CONSENT_VALIDATE: '/api/v1/privacy/consent/validate',
    /** POST report data breach (admin) */
    BREACH_REPORT: '/api/v1/privacy/breach/report',
    /** GET breach history (admin) */
    BREACH_HISTORY: '/api/v1/privacy/breach/history',
    /** GET HIPAA encryption status */
    HIPAA_ENCRYPTION: '/api/v1/privacy/hipaa/encryption-status',
    /** GET GDPR data residency info */
    GDPR_RESIDENCY: '/api/v1/privacy/gdpr/data-residency',
  } as const,

  /** Integration endpoints (OAuth, wearables, health data, FHIR) */
  INTEGRATION: {
    // OAuth 2.0 endpoints
    /** GET OAuth authorization URL - append /{provider}/authorize */
    OAUTH_AUTHORIZE: '/api/v1/integration/oauth',
    /** GET OAuth callback - append /{provider}/callback */
    OAUTH_CALLBACK: '/api/v1/integration/oauth',
    /** POST disconnect OAuth - append /{provider}/disconnect */
    OAUTH_DISCONNECT: '/api/v1/integration/oauth',
    /** GET OAuth connection status - append /{provider}/status */
    OAUTH_STATUS: '/api/v1/integration/oauth',
    
    // Health data sync
    /** POST sync health data from provider - append /{provider} */
    HEALTH_SYNC_PROVIDER: '/api/v1/integration/health/sync',
    /** POST sync health data from multiple sources */
    HEALTH_SYNC_MULTI: '/api/v1/integration/health/sync',
    /** POST analyze health and mood patterns */
    HEALTH_ANALYZE: '/api/v1/integration/health/analyze',
    /** POST check health alerts */
    HEALTH_CHECK_ALERTS: '/api/v1/integration/health/check-alerts',
    /** POST update alert settings */
    HEALTH_ALERT_SETTINGS: '/api/v1/integration/health/alert-settings',
    
    // Auto-sync settings
    /** POST toggle auto-sync for provider - append /{provider}/auto-sync */
    AUTO_SYNC_TOGGLE: '/api/v1/integration/oauth',
    /** GET all auto-sync settings */
    AUTO_SYNC_SETTINGS: '/api/v1/integration/oauth/auto-sync/settings',
    
    // Wearable endpoints (legacy - use OAuth instead)
    /** GET wearable status - DEPRECATED */
    WEARABLE_STATUS: '/api/v1/integration/wearable/status',
    /** POST disconnect wearable - DEPRECATED */
    WEARABLE_DISCONNECT: '/api/v1/integration/wearable/disconnect',
    /** POST sync wearable data - DEPRECATED */
    WEARABLE_SYNC: '/api/v1/integration/wearable/sync',
    /** GET wearable details with insights */
    WEARABLE_DETAILS: '/api/v1/integration/wearable/details',
    /** POST sync Google Fit data */
    GOOGLE_FIT_SYNC: '/api/v1/integration/wearable/google-fit/sync',
    /** POST sync Apple Health data (iOS only) */
    APPLE_HEALTH_SYNC: '/api/v1/integration/wearable/apple-health/sync',
    
    // FHIR Healthcare integration
    /** GET FHIR patient data */
    FHIR_PATIENT: '/api/v1/integration/fhir/patient',
    /** GET FHIR observations */
    FHIR_OBSERVATIONS: '/api/v1/integration/fhir/observation',
    
    // Crisis support
    /** POST create crisis referral */
    CRISIS_REFERRAL: '/api/v1/integration/crisis/referral',
    
    // Test endpoint (development only)
    /** GET test integration blueprint */
    TEST: '/api/v1/integration/test',
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