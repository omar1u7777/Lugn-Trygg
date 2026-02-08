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
    REFRESH_TOKEN: '/api/auth/refresh',
    GOOGLE_LOGIN: '/api/auth/google-login',
    RESET_PASSWORD: '/api/auth/reset-password',
    CONFIRM_PASSWORD_RESET: '/api/auth/confirm-password-reset',
    CHANGE_EMAIL: '/api/auth/change-email',
    CHANGE_PASSWORD: '/api/auth/change-password',
    CONSENT: '/api/auth/consent',
    SETUP_2FA: '/api/auth/setup-2fa',
    SETUP_2FA_BIOMETRIC: '/api/auth/setup-2fa-biometric',
    VERIFY_2FA: '/api/auth/verify-2fa',
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
    PREDICTIVE_FORECAST: '/api/mood/predictive-forecast',
  } as const,

  /** Dashboard endpoints */
  DASHBOARD: {
    /** GET dashboard summary - append /{userId}/summary */
    DASHBOARD_SUMMARY: '/api/dashboard',
    /** GET quick stats - append /{userId}/quick-stats */
    DASHBOARD_QUICK_STATS: '/api/dashboard',
    /** GET legacy dashboard (uses JWT user) */
    LEGACY: '/api/dashboard',
    /** GET legacy stats (uses JWT user) */
    LEGACY_STATS: '/api/dashboard/stats',
    /** GET CSRF token */
    CSRF_TOKEN: '/api/dashboard/csrf-token',
  } as const,

  /** Memory management endpoints */
  MEMORY: {
    /** GET /api/memory/list/{userId} - List user's memories */
    LIST_MEMORIES: '/api/memory/list',
    /** GET /api/memory/get/{memoryId} - Get signed URL for memory */
    GET_MEMORY_URL: '/api/memory/get',
    /** POST /api/memory/upload - Upload audio memory (requires auth, form data) */
    UPLOAD_MEMORY: '/api/memory/upload',
  } as const,

  /** Chatbot endpoints */
  CHATBOT: {
    /** POST send message to AI chatbot */
    CHAT: '/api/chatbot/chat',
    /** POST legacy alias for /chat */
    MESSAGE: '/api/chatbot/message',
    /** GET conversation history */
    CHAT_HISTORY: '/api/chatbot/history',
    /** POST analyze mood patterns */
    ANALYZE_PATTERNS: '/api/chatbot/analyze-patterns',
    /** POST start exercise session */
    EXERCISE: '/api/chatbot/exercise',
    /** POST mark exercise complete - append /{userId}/{exerciseId}/complete */
    EXERCISE_COMPLETE: '/api/chatbot/exercise',
  } as const,

  /** Referral system endpoints */
  REFERRAL: {
    LEADERBOARD: '/api/referral/leaderboard',
    GENERATE_REFERRAL: '/api/referral/generate',
  } as const,

  /** User/Wellness endpoints */
  USERS: {
    WELLNESS_GOALS: '/api/users',
    /** @deprecated Use JOURNAL section instead */
    JOURNAL: '/api/journal',
    MEDITATION_SESSIONS: '/api/users',
  } as const,

  /** Journal endpoints - Mental health journaling */
  JOURNAL: {
    /** Base path for journal operations - append /{userId}/journal */
    BASE: '/api/journal',
    /** GET/POST journal entries - append /{userId}/journal */
    ENTRIES: '/api/journal',
    /** PUT/DELETE single entry - append /{userId}/journal/{entryId} */
    ENTRY: '/api/journal',
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

  /** Feedback endpoints */
  FEEDBACK: {
    /** POST submit feedback */
    SUBMIT: '/api/feedback/submit',
    /** GET list all feedback (admin only) */
    LIST: '/api/feedback/list',
    /** GET feedback statistics (admin only) */
    STATS: '/api/feedback/stats',
    /** GET current user's feedback history */
    MY_FEEDBACK: '/api/feedback/my-feedback',
  } as const,

  /** Challenge system endpoints */
  CHALLENGES: {
    /** GET all active challenges */
    CHALLENGES: '/api/challenges',
    /** GET single challenge by ID - append /{id} */
    CHALLENGE_BY_ID: '/api/challenges',
    /** POST join challenge - append /{id}/join */
    CHALLENGE_JOIN: '/api/challenges',
    /** POST leave challenge - append /{id}/leave */
    CHALLENGE_LEAVE: '/api/challenges',
    /** POST contribute to challenge - append /{id}/contribute */
    CHALLENGE_CONTRIBUTE: '/api/challenges',
    /** GET user's challenges - append /{userId} */
    USER_CHALLENGES: '/api/challenges/user',
    /** POST trigger cleanup (admin) */
    MAINTENANCE_CLEANUP: '/api/challenges/maintenance/cleanup',
  } as const,

  /** Consent management endpoints (GDPR compliance) */
  CONSENT: {
    /** POST grant bulk consents | GET all user consents */
    BASE: '/api/consent',
    /** POST grant specific consent - append /{consentType} */
    GRANT: '/api/consent',
    /** DELETE withdraw consent - append /{consentType} */
    WITHDRAW: '/api/consent',
    /** GET validate feature access - append /validate/{feature} */
    VALIDATE: '/api/consent/validate',
    /** GET check consent status - append /check/{consentType} */
    CHECK: '/api/consent/check',
  } as const,

  /** Rewards system endpoints */
  REWARDS: {
    /** GET reward catalog */
    REWARD_CATALOG: '/api/rewards/catalog',
    /** GET all achievements */
    ACHIEVEMENTS: '/api/rewards/achievements',
    /** GET user rewards profile (append /{userId}) */
    USER_REWARDS: '/api/rewards/user',
    /** POST claim a reward (append /{userId}/claim) */
    CLAIM_REWARD: '/api/rewards/user',
    /** POST add XP (append /{userId}/add-xp) */
    ADD_XP: '/api/rewards/user',
    /** POST check achievements (append /{userId}/check-achievements) */
    CHECK_ACHIEVEMENTS: '/api/rewards/user',
    /** GET user badges (append /{userId}/badges) */
    USER_BADGES: '/api/rewards/user',
  } as const,

  /** Audio content endpoints */
  AUDIO: {
    AUDIO_CATEGORIES: '/api/audio/categories',
    AUDIO_CATEGORY: '/api/audio/category',
    AUDIO_LIBRARY: '/api/audio/all',
    AUDIO_TRACK: '/api/audio/track',
    AUDIO_SEARCH: '/api/audio/search',
  } as const,

  /** AI-powered features endpoints */
  AI: {
    GENERATE_STORY: '/api/ai/story',
    GET_STORIES: '/api/ai/stories',
    GENERATE_FORECAST: '/api/ai/forecast',
    GET_FORECASTS: '/api/ai/forecasts',
  } as const,

  /** Security and monitoring endpoints (Admin only) */
  SECURITY: {
    /** GET API key rotation status */
    KEY_ROTATION_STATUS: '/api/security/key-rotation/status',
    /** GET tamper detection events (query param: limit) */
    TAMPER_EVENTS: '/api/security/tamper/events',
    /** GET security monitoring metrics */
    MONITORING_METRICS: '/api/security/monitoring/metrics',
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

  /** Health monitoring endpoints (admin/ops) */
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
    CREATE_SESSION: '/api/subscription/create-session',
    /** GET subscription status - append /{userId} */
    STATUS: '/api/subscription/status',
    /** POST handle Stripe webhooks (internal) */
    WEBHOOK: '/api/subscription/webhook',
    /** POST purchase CBT module (one-time payment) */
    PURCHASE_CBT_MODULE: '/api/subscription/purchase-cbt-module',
    /** GET available subscription plans */
    PLANS: '/api/subscription/plans',
    /** GET user's purchased items - append /{userId} */
    PURCHASES: '/api/subscription/purchases',
    /** POST cancel subscription - append /{userId} */
    CANCEL: '/api/subscription/cancel',
  } as const,

  /** CBT (Cognitive Behavioral Therapy) endpoints */
  CBT: {
    /** GET all available CBT modules */
    MODULES: '/api/cbt/modules',
    /** GET specific module details - append /{moduleId} */
    MODULE_DETAIL: '/api/cbt/modules',
    /** GET personalized CBT session */
    SESSION: '/api/cbt/session',
    /** POST update user CBT progress */
    PROGRESS: '/api/cbt/progress',
    /** GET user CBT insights */
    INSIGHTS: '/api/cbt/insights',
    /** GET all CBT exercises */
    EXERCISES: '/api/cbt/exercises',
  } as const,

  /** Crisis Intervention endpoints - Mental health crisis detection and support */
  CRISIS: {
    /** POST assess crisis risk based on user data */
    ASSESS: '/api/crisis/assess',
    /** GET user's personalized safety plan */
    SAFETY_PLAN: '/api/crisis/safety-plan',
    /** PUT update safety plan */
    UPDATE_SAFETY_PLAN: '/api/crisis/safety-plan',
    /** GET intervention protocol for risk level - append /protocols/{risk_level} */
    PROTOCOLS: '/api/crisis/protocols',
    /** GET user's crisis assessment history - query param: limit */
    HISTORY: '/api/crisis/history',
    /** GET all available crisis indicators */
    INDICATORS: '/api/crisis/indicators',
    /** POST check if crisis requires escalation */
    CHECK_ESCALATION: '/api/crisis/check-escalation',
  } as const,

  /** API Documentation endpoints (developer tools) */
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
    SETTINGS: '/api/privacy/settings',
    /** GET data export - append /{userId} */
    EXPORT: '/api/privacy/export',
    /** POST delete user data - append /{userId} */
    DELETE: '/api/privacy/delete',
    /** GET data retention status - append /{userId} */
    RETENTION_STATUS: '/api/privacy/retention/status',
    /** POST manual retention cleanup - append /{userId} */
    RETENTION_CLEANUP: '/api/privacy/retention/cleanup',
    /** POST system-wide retention cleanup (admin) */
    RETENTION_CLEANUP_ALL: '/api/privacy/retention/cleanup-all',
    /** GET consent status - append /{userId} */
    CONSENT_GET: '/api/privacy/consent',
    /** POST grant consent - append /{userId}/{consentType} */
    CONSENT_GRANT: '/api/privacy/consent',
    /** DELETE withdraw consent - append /{userId}/{consentType} */
    CONSENT_WITHDRAW: '/api/privacy/consent',
    /** GET validate consent - append /{userId}/{feature} */
    CONSENT_VALIDATE: '/api/privacy/consent/validate',
    /** POST report data breach (admin) */
    BREACH_REPORT: '/api/privacy/breach/report',
    /** GET breach history (admin) */
    BREACH_HISTORY: '/api/privacy/breach/history',
    /** GET HIPAA encryption status */
    HIPAA_ENCRYPTION: '/api/privacy/hipaa/encryption-status',
    /** GET GDPR data residency info */
    GDPR_RESIDENCY: '/api/privacy/gdpr/data-residency',
  } as const,

  /** Integration endpoints (OAuth, wearables, health data, FHIR) */
  INTEGRATION: {
    // OAuth 2.0 endpoints
    /** GET OAuth authorization URL - append /{provider}/authorize */
    OAUTH_AUTHORIZE: '/api/integration/oauth',
    /** GET OAuth callback - append /{provider}/callback */
    OAUTH_CALLBACK: '/api/integration/oauth',
    /** POST disconnect OAuth - append /{provider}/disconnect */
    OAUTH_DISCONNECT: '/api/integration/oauth',
    /** GET OAuth connection status - append /{provider}/status */
    OAUTH_STATUS: '/api/integration/oauth',
    
    // Health data sync
    /** POST sync health data from provider - append /{provider} */
    HEALTH_SYNC_PROVIDER: '/api/integration/health/sync',
    /** POST sync health data from multiple sources */
    HEALTH_SYNC_MULTI: '/api/integration/health/sync',
    /** POST analyze health and mood patterns */
    HEALTH_ANALYZE: '/api/integration/health/analyze',
    /** POST check health alerts */
    HEALTH_CHECK_ALERTS: '/api/integration/health/check-alerts',
    /** POST update alert settings */
    HEALTH_ALERT_SETTINGS: '/api/integration/health/alert-settings',
    
    // Auto-sync settings
    /** POST toggle auto-sync for provider - append /{provider}/auto-sync */
    AUTO_SYNC_TOGGLE: '/api/integration/oauth',
    /** GET all auto-sync settings */
    AUTO_SYNC_SETTINGS: '/api/integration/oauth/auto-sync/settings',
    
    // Wearable endpoints (legacy - use OAuth instead)
    /** GET wearable status - DEPRECATED */
    WEARABLE_STATUS: '/api/integration/wearable/status',
    /** POST disconnect wearable - DEPRECATED */
    WEARABLE_DISCONNECT: '/api/integration/wearable/disconnect',
    /** POST sync wearable data - DEPRECATED */
    WEARABLE_SYNC: '/api/integration/wearable/sync',
    /** GET wearable details with insights */
    WEARABLE_DETAILS: '/api/integration/wearable/details',
    /** POST sync Google Fit data */
    GOOGLE_FIT_SYNC: '/api/integration/wearable/google-fit/sync',
    /** POST sync Apple Health data (iOS only) */
    APPLE_HEALTH_SYNC: '/api/integration/wearable/apple-health/sync',
    
    // FHIR Healthcare integration
    /** GET FHIR patient data */
    FHIR_PATIENT: '/api/integration/fhir/patient',
    /** GET FHIR observations */
    FHIR_OBSERVATIONS: '/api/integration/fhir/observation',
    
    // Crisis support
    /** POST create crisis referral */
    CRISIS_REFERRAL: '/api/integration/crisis/referral',
    
    // Test endpoint (development only)
    /** GET test integration blueprint */
    TEST: '/api/integration/test',
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