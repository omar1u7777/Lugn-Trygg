# Frontend → Backend API Call Map

> Auto-generated comprehensive mapping of all API calls from the React frontend to the Flask backend.
> Date: 2026-02-08

## Architecture Overview

- **HTTP Client**: Axios instance (`src/api/client.ts`) with baseURL from `getBackendUrl()`
- **Auth**: Every request auto-attaches `Authorization: Bearer <jwt>` via request interceptor
- **CSRF**: State-changing methods (POST/PUT/DELETE/PATCH) auto-attach `X-CSRFToken` header
- **Retry**: Auto-retry on 408/429/500/502/503/504 (max 3 attempts)
- **Offline**: Network errors on POST/PUT/DELETE queued for later sync
- **Token Refresh**: 401 responses trigger automatic Firebase token refresh → `/api/v1/auth/refresh`

---

## 1. AUTHENTICATION (`src/api/auth.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 1 | `loginUser()` | POST | `/api/v1/auth/login` | `{ email, password }` | `{ accessToken, refreshToken, user, userId }` | No |
| 2 | `registerUser()` | POST | `/api/v1/auth/register` | `{ email, password, name?, referralCode? }` | `{ user, referral? }` | No |
| 3 | `logoutUser()` | POST | `/api/v1/auth/logout` | — | — | Yes |
| 4 | `refreshAccessToken()` | POST | `/api/v1/auth/refresh` | `{ id_token: firebaseToken }` | `{ accessToken, refreshToken? }` | Yes |
| 5 | `resetPassword()` | POST | `/api/v1/auth/reset-password` | `{ email }` | Success message | No |
| 6 | `changeEmail()` | POST | `/api/v1/auth/change-email` | `{ newEmail, password }` | Success response | Yes |
| 7 | `changePassword()` | POST | `/api/v1/auth/change-password` | `{ current_password, new_password }` | Success response | Yes |
| 8 | `setup2FA()` | POST | `/api/v1/auth/setup-2fa` | `{ method: "totp" }` | 2FA setup data (QR code etc.) | Yes |
| 9 | `verify2FASetup()` | POST | `/api/v1/auth/verify-2fa-setup` | `{ code }` | Verification response | Yes |
| 10 | `exportUserData()` | GET | `/api/v1/auth/export-data` | — | Blob (file download) | Yes |
| 11 | `deleteAccount()` | DELETE | `/api/v1/auth/delete-account/{userId}` | — | Deletion response | Yes |
| 12 | `getCsrfToken()` | GET | `/api/v1/dashboard/csrf-token` | — | `{ csrfToken }` | Yes |

### Auth calls in Components/Hooks

| # | File | Function | Method | Endpoint | Notes |
|---|------|----------|--------|----------|-------|
| 13 | `components/Auth/LoginForm.tsx` | `handleGoogleSignIn` | POST | `/api/v1/auth/google-login` | `{ id_token }` — Firebase popup → backend |
| 14 | `hooks/useLoginForm.ts` | `handleGoogleSignIn` | POST | `/api/v1/auth/google-login` | `{ id_token }` — Duplicate of above pattern |

---

## 2. MOOD (`src/api/mood.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 15 | `logMood()` | POST | `/api/v1/mood/log` | `{ user_id, score?, note?, emotions?, activities? }` | Mood log response | Yes |
| 16 | `getMoods()` | GET | `/api/v1/mood` | — | `{ moods: [...] }` | Yes |
| 17 | `getWeeklyAnalysis()` | GET | `/api/v1/mood/weekly-analysis` | — | Weekly analysis (trends, sentiments, counts) | Yes |
| 18 | `getMoodStatistics()` | GET | `/api/v1/mood-stats/statistics` | — | Statistics (streaks, percentages, best/worst days) | Yes |
| 19 | `analyzeText()` | POST | `/api/v1/mood/analyze-text` | `{ text }` | Sentiment analysis result | Yes |

### Mood calls in Components

| # | File | Function | Method | Endpoint | Notes |
|---|------|----------|--------|----------|-------|
| 20 | `components/MoodList.tsx` | delete handler | DELETE | `/api/v1/mood/delete/{moodId}` | Direct `api.delete()` call |
| 21 | `components/MoodAnalytics.tsx` | forecast fetch | GET | `/api/v1/mood/predictive-forecast?days_ahead={n}` | Direct `api.get()` call |

---

## 3. DASHBOARD (`src/api/dashboard.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 22 | `getCSRFToken()` | GET | `/api/v1/dashboard/csrf-token` | — | `{ csrfToken }` | Yes |
| 23 | `getDashboardSummary()` | GET | `/api/v1/dashboard/{userId}/summary` | `?forceRefresh=true` (optional) | Dashboard summary (moods, chats, streaks, goals) | Yes |
| 24 | `getDashboardQuickStats()` | GET | `/api/v1/dashboard/{userId}/quick-stats` | — | `{ totalMoods, totalChats, cached }` | Yes |
| 25 | `getWellnessGoals()` | GET | `/api/v1/users/wellness-goals` | — | `{ wellnessGoals: [...] }` | Yes |
| 26 | `setWellnessGoals()` | POST | `/api/v1/users/wellness-goals` | `{ wellnessGoals: string[] }` | `{ wellnessGoals: [...] }` | Yes |

---

## 4. MEMORIES (`src/api/memories.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 27 | `getMemories()` | GET | `/api/v1/memory/list/{userId}` | — | `{ memories: [...] }` | Yes |
| 28 | `getMemoryUrl()` | GET | `/api/v1/memory/get/{memoryId}` | — | `{ url }` (signed URL) | Yes |
| 29 | `uploadMemory()` | POST | `/api/v1/memory/upload` | FormData: `audio` file + `user_id?` | Upload response | Yes |
| 30 | `deleteMemory()` | DELETE | `/api/v1/memory/list/{memoryId}` | — | `{ deleted: id }` | Yes |

### Memory calls in Components

| # | File | Function | Method | Endpoint | Notes |
|---|------|----------|--------|----------|-------|
| 31 | `components/MemoryRecorder.tsx` | `uploadAudio` | POST | `{BASE_URL}/api/v1/memory/upload` | Uses raw `axios.post()` (not via `api` client) — **⚠️ bypasses interceptors (no auto auth token, no CSRF, no retry)** |

---

## 5. AI CHATBOT (`src/api/ai.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 32 | `chatWithAI()` | POST | `/api/v1/chatbot/chat` | `{ user_id, message }` | ChatResponse (response, emotions, suggestions, crisis detection) | Yes |
| 33 | `getChatHistory()` | GET | `/api/v1/chatbot/history` | — | `{ conversation: [...] }` | Yes |
| 34 | `analyzeMoodPatterns()` | POST | `/api/v1/chatbot/analyze-patterns` | — | Pattern analysis with predictions | Yes |
| 35 | `startExercise()` | POST | `/api/v1/chatbot/exercise` | `{ exerciseType, duration }` | Exercise session with steps/instructions | Yes |
| 36 | `completeExercise()` | POST | `/api/v1/chatbot/exercise/{userId}/{exerciseId}/complete` | — | `{ message }` | Yes |

### AI Features (Stories & Forecasts)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 37 | `generateTherapeuticStory()` | POST | `/api/v1/ai/story` | `{ locale }` | TherapeuticStory | Yes |
| 38 | `getStoryHistory()` | GET | `/api/v1/ai/stories` | — | `{ stories: [...] }` | Yes |
| 39 | `generateMoodForecast()` | POST | `/api/v1/ai/forecast` | `{ daysAhead, useSklearn }` | MoodForecast | Yes |
| 40 | `getForecastHistory()` | GET | `/api/v1/ai/forecasts` | — | `{ forecasts: [...] }` | Yes |

### Voice/Audio AI

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 41 | `transcribeAudio()` (ai.ts) | POST | `/api/v1/voice/transcribe` | FormData: audio blob | `{ text, confidence }` | Yes |
| 42 | `analyzeVoiceEmotion()` (ai.ts) | POST | `/api/v1/voice/analyze-emotion` | FormData: audio blob | `{ emotion, confidence }` | Yes |
| 43 | `analyzeTextSentiment()` | POST | `/api/v1/mood/analyze-text` | `{ text }` | `{ sentiment, emotions, confidence }` | Yes |

### AI calls in Components

| # | File | Method | Endpoint | Notes |
|---|------|--------|----------|-------|
| 44 | `components/AIStories.tsx` | GET | `/api/v1/ai/stories` | Fetch story history |
| 45 | `components/AIStories.tsx` | POST | `/api/v1/ai/story` | Generate new story `{ locale }` |

---

## 6. PEER CHAT (`src/api/chat.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 46 | `getChatRooms()` | GET | `/api/v1/peer-chat/rooms` | — | `{ rooms: [...] }` | Yes |
| 47 | `joinChatRoom()` | POST | `/api/v1/peer-chat/room/{roomId}/join` | `{ user_id }` | ChatSession | Yes |
| 48 | `leaveChatRoom()` | POST | `/api/v1/peer-chat/room/{roomId}/leave` | `{ session_id }` | Leave result | Yes |
| 49 | `getChatMessages()` | GET | `/api/v1/peer-chat/room/{roomId}/messages?session_id=&after=` | — | `{ messages: [...] }` | Yes |
| 50 | `sendChatMessage()` | POST | `/api/v1/peer-chat/room/{roomId}/send` | `{ session_id, message, anonymous_name?, avatar? }` | Sent message | Yes |
| 51 | `toggleMessageLike()` | POST | `/api/v1/peer-chat/message/{messageId}/like` | `{ session_id }` | Toggle result | Yes |
| 52 | `reportChatMessage()` | POST | `/api/v1/peer-chat/message/{messageId}/report` | `{ session_id, reason }` | Report result | Yes |
| 53 | `updateTypingStatus()` | POST | `/api/v1/peer-chat/room/{roomId}/typing` | `{ session_id, is_typing }` | Status update | Yes |
| 54 | `getRoomPresence()` | GET | `/api/v1/peer-chat/room/{roomId}/presence` | — | Presence data | Yes |

---

## 7. JOURNALING (`src/api/journaling.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 55 | `saveJournalEntry()` | POST | `/api/v1/journal/{userId}/journal` | `{ content, mood?, tags? }` | JournalEntry | Yes |
| 56 | `getJournalEntries()` | GET | `/api/v1/journal/{userId}/journal?limit={n}` | — | `{ entries: [...] }` | Yes |
| 57 | `updateJournalEntry()` | PUT | `/api/v1/journal/{userId}/journal/{entryId}` | `{ content?, mood?, tags? }` | Updated JournalEntry | Yes |
| 58 | `deleteJournalEntry()` | DELETE | `/api/v1/journal/{userId}/journal/{entryId}` | — | — | Yes |

---

## 8. MEDITATION (`src/api/meditation.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 59 | `saveMeditationSession()` | POST | `/api/v1/users/meditation-sessions` | `{ type, duration, technique?, completedCycles?, moodBefore?, moodAfter?, notes? }` | Session data | Yes |
| 60 | `getMeditationSessions()` | GET | `/api/v1/users/meditation-sessions?limit={n}` | — | `{ sessions, stats }` | Yes |

---

## 9. NOTIFICATIONS (`src/api/notifications.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 61 | `saveFCMToken()` | POST | `/api/v1/notifications/fcm-token` | `{ fcmToken }` | Success data | Yes |
| 62 | `sendReminder()` | POST | `/api/v1/notifications/send-reminder` | `{ message, type }` | `{ sent, notificationId?, reason? }` | Yes |
| 63 | `scheduleDailyNotifications()` | POST | `/api/v1/notifications/schedule-daily` | `{ enabled, time }` | `{ enabled, time }` | Yes |
| 64 | `disableAllNotifications()` | POST | `/api/v1/notifications/disable-all` | `{}` | `{ allDisabled }` | Yes |
| 65 | `getNotificationSettings()` | GET | `/api/v1/notifications/settings` | — | NotificationSettings | Yes |
| 66 | `updateNotificationSettings()` | POST | `/api/v1/notifications/settings` | `{ dailyRemindersEnabled, reminderTime }` | `{ updated }` | Yes |

---

## 10. ONBOARDING (`src/api/onboarding.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 67 | `saveOnboardingGoals()` | POST | `/api/v1/onboarding/goals/{userId}` | `{ goals: string[] }` | `{ goals, onboardingCompleted }` | Yes |
| 68 | `getOnboardingGoals()` | GET | `/api/v1/onboarding/goals/{userId}` | — | `{ goals: [...] }` | Yes |
| 69 | `updateOnboardingGoals()` | PUT | `/api/v1/onboarding/goals/{userId}` | `{ goals: string[] }` | `{ goals, onboardingCompleted }` | Yes |
| 70 | `getOnboardingStatus()` | GET | `/api/v1/onboarding/status/{userId}` | — | `{ onboardingCompleted, wellnessGoals, goalsCount }` | Yes |
| 71 | `skipOnboarding()` | POST | `/api/v1/onboarding/skip/{userId}` | — | `{ onboardingCompleted, skipped }` | Yes |

---

## 11. REWARDS (`src/api/rewards.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 72 | `getUserRewards()` | GET | `/api/v1/rewards/profile` | — | UserReward (xp, level, badges) | Yes |
| 73 | `getRewardCatalog()` | GET | `/api/v1/rewards/catalog` | — | `{ rewards: [...] }` | Yes |
| 74 | `getAchievements()` | GET | `/api/v1/rewards/achievements` | — | `{ achievements: [...] }` | Yes |
| 75 | `claimReward()` | POST | `/api/v1/rewards/claim` | `{ reward_id }` | ClaimRewardResult | Yes |
| 76 | `addXp()` | POST | `/api/v1/rewards/add-xp` | `{ amount, reason }` | XP result | Yes |
| 77 | `checkAchievements()` | POST | `/api/v1/rewards/check-achievements` | `{ mood_count?, streak?, journal_count?, referral_count?, meditation_count? }` | CheckAchievementsResult | Yes |
| 78 | `getUserBadges()` | GET | `/api/v1/rewards/badges` | — | `{ badges: [...] }` | Yes |

---

## 12. CHALLENGES (`src/api/challenges.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 79 | `getChallenges()` | GET | `/api/v1/challenges` | — | `{ challenges: [...] }` | Yes |
| 80 | `getChallenge()` | GET | `/api/v1/challenges/{challengeId}` | — | `{ challenge }` | Yes |
| 81 | `joinChallenge()` | POST | `/api/v1/challenges/{challengeId}/join` | `{ username? }` | JoinLeaveResponse | Yes |
| 82 | `leaveChallenge()` | POST | `/api/v1/challenges/{challengeId}/leave` | — | JoinLeaveResponse | Yes |
| 83 | `contributeToChallenge()` | POST | `/api/v1/challenges/{challengeId}/contribute` | `{ type, amount }` | ContributeResponse | Yes |
| 84 | `getUserChallenges()` | GET | `/api/v1/challenges/user/{userId}` | — | `{ challenges: [...] }` | Yes |

---

## 13. REFERRAL SYSTEM (Direct calls in `src/components/Referral/`)

| # | File | Method | Endpoint | Data Sent | Auth |
|---|------|--------|----------|-----------|------|
| 85 | `ReferralLeaderboard.tsx` | GET | `/api/v1/referral/leaderboard?limit=20` | — | Yes |
| 86 | `ReferralProgram.tsx` | POST | `/api/v1/referral/generate` | `{ user_id }` | Yes |
| 87 | `ReferralProgram.tsx` | GET | `/api/v1/referral/stats?user_id={id}` | — | Yes |
| 88 | `ReferralHistory.tsx` | GET | `/api/v1/referral/history?user_id={id}` | — | Yes |
| 89 | `EmailInvite.tsx` | POST | `/api/v1/referral/invite` | `{ email, referralCode, ...}` | Yes |
| 90 | `RewardsCatalog.tsx` | GET | `/api/v1/referral/rewards/catalog` | — | Yes |
| 91 | `RewardsCatalog.tsx` | POST | `/api/v1/referral/rewards/redeem` | `{ reward_id, ... }` | Yes |

### Referral in API layer (`src/api/social.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 92 | `getLeaderboard()` | GET | `/api/v1/leaderboard/{type}` | — | `{ leaderboard: [...] }` | Yes |
| 93 | `getReferralStats()` | GET | `/api/v1/referral/stats?user_id={id}` | — | ReferralStats | Yes |

---

## 14. LEADERBOARD (`src/api/leaderboard.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 94 | `getXPLeaderboard()` | GET | `/api/v1/leaderboard/xp?limit={n}&timeframe={t}` | — | Leaderboard data | Yes |
| 95 | `getStreakLeaderboard()` | GET | `/api/v1/leaderboard/streaks?limit={n}` | — | Leaderboard data | Yes |
| 96 | `getMoodLeaderboard()` | GET | `/api/v1/leaderboard/moods?limit={n}` | — | Leaderboard data | Yes |
| 97 | `getUserRanking()` | GET | `/api/v1/leaderboard/user/{userId}` | — | UserRankingsResponse | Yes |
| 98 | `getWeeklyWinners()` | GET | `/api/v1/leaderboard/weekly-winners` | — | WeeklyWinnersResponse | Yes |

---

## 15. FEEDBACK (`src/api/feedback.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 99 | `submitFeedback()` | POST | `/api/v1/feedback/submit` | `{ user_id, rating, category?, message?, ... }` | `{ feedbackId }` | Yes |
| 100 | `getMyFeedback()` | GET | `/api/v1/feedback/my-feedback` | — | `{ feedback: [...], count }` | Yes |
| 101 | `listFeedback()` | GET | `/api/v1/feedback/list?status=&category=&limit=` | — | `{ feedback, count }` | Yes (Admin) |
| 102 | `getFeedbackStats()` | GET | `/api/v1/feedback/stats?days={n}` | — | FeedbackStats | Yes (Admin) |

### Feedback in Components

| # | File | Method | Endpoint | Notes |
|---|------|--------|----------|-------|
| 103 | `Feedback/FeedbackForm.tsx` | POST | `/api/v1/feedback/submit` | Direct `api.post()` |
| 104 | `Feedback/FeedbackHistory.tsx` | GET | `/api/v1/feedback/my-feedback?user_id={id}` | **⚠️ adds `user_id` query param not defined in API layer** |

---

## 16. AUDIO (`src/api/audio.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 105 | `getAudioLibrary()` | GET | `/api/v1/audio/library` | — | `{ library: {...} }` | Yes |
| 106 | `getAudioCategories()` | GET | `/api/v1/audio/categories` | — | `{ categories: [...] }` | Yes |
| 107 | `getAudioCategoryTracks()` | GET | `/api/v1/audio/category/{categoryId}` | — | `{ category, tracks }` | Yes |
| 108 | `searchAudioTracks()` | GET | `/api/v1/audio/search?q={query}` | — | `{ results: [...] }` | Yes |

---

## 17. VOICE (`src/api/voice.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 109 | `transcribeVoiceAudio()` | POST | `/api/v1/voice/transcribe` | `{ audio_data (base64), language }` | `{ transcript, confidence, language }` | Yes |
| 110 | `analyzeVoiceEmotionDetailed()` | POST | `/api/v1/voice/analyze-emotion` | `{ audio_data (base64), transcript? }` | Emotion analysis (emotions, energy, pace) | Yes |
| 111 | `getVoiceServiceStatus()` | GET | `/api/v1/voice/status` | — | `{ googleSpeech, webSpeechFallback, ... }` | Yes |

---

## 18. SUBSCRIPTION (`src/api/subscription.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 112 | `createCheckoutSession()` | POST | `/api/v1/subscription/create-session` | `{ email, plan, billing_cycle }` | `{ sessionId, url }` | Yes |
| 113 | `getSubscriptionStatus()` | GET | `/api/v1/subscription/status/{userId}` | — | SubscriptionStatus | Yes |
| 114 | `getAvailablePlans()` | GET | `/api/v1/subscription/plans` | — | `{ plans: [...] }` | Yes |
| 115 | `purchaseCBTModule()` | POST | `/api/v1/subscription/purchase-cbt-module` | `{ email, module }` | `{ sessionId, url }` | Yes |
| 116 | `getUserPurchases()` | GET | `/api/v1/subscription/purchases/{userId}` | — | `{ purchases: [...] }` | Yes |
| 117 | `cancelSubscription()` | POST | `/api/v1/subscription/cancel/{userId}` | — | `{ message }` | Yes |

### Subscription in Contexts

| # | File | Method | Endpoint | Notes |
|---|------|--------|----------|-------|
| 118 | `contexts/SubscriptionContext.tsx` | — | — | Calls `getSubscriptionStatus(user.user_id)` from API layer |

---

## 19. CONSENT / GDPR (`src/api/consent.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 119 | `grantBulkConsents()` | POST | `/api/v1/consent` | `{ analytics_consent?, marketing_consent?, data_processing_consent?, ... }` | `{ granted, failed, timestamp }` | Yes |
| 120 | `getUserConsents()` | GET | `/api/v1/consent` | — | UserConsents map | Yes |
| 121 | `grantConsent()` | POST | `/api/v1/consent/{consentType}` | `{ version }` | ConsentRecord | Yes |
| 122 | `withdrawConsent()` | DELETE | `/api/v1/consent/{consentType}` | — | ConsentRecord | Yes |
| 123 | `validateFeatureAccess()` | GET | `/api/v1/consent/validate/{feature}` | — | `{ access_granted, required_consents, missing_consents? }` | Yes |
| 124 | `checkConsent()` | GET | `/api/v1/consent/check/{consentType}` | — | ConsentRecord | Yes |

---

## 20. CBT (`src/api/cbt.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 125 | `getCBTModules()` | GET | `/api/v1/cbt/modules` | — | `{ modules: [...] }` | Yes |
| 126 | `getCBTModuleDetail()` | GET | `/api/v1/cbt/modules/{moduleId}` | — | `{ module }` | Yes |
| 127 | `getPersonalizedSession()` | GET | `/api/v1/cbt/session?mood={mood}` | — | `{ session }` | Yes |
| 128 | `updateCBTProgress()` | POST | `/api/v1/cbt/progress` | `ExerciseCompletionData` | CBTProgress | Yes |
| 129 | `getCBTInsights()` | GET | `/api/v1/cbt/insights` | — | `{ insights }` | Yes |
| 130 | `getCBTExercises()` | GET | `/api/v1/cbt/exercises?module=&type=` | — | `{ exercises: [...] }` | Yes |

---

## 21. CRISIS (`src/api/crisis.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 131 | `assessCrisisRisk()` | POST | `/api/v1/crisis/assess` | UserContext (mood history, patterns, triggers) | CrisisAssessment | Yes |
| 132 | `getSafetyPlan()` | GET | `/api/v1/crisis/safety-plan` | — | SafetyPlan | Yes |
| 133 | `updateSafetyPlan()` | PUT | `/api/v1/crisis/safety-plan` | Partial SafetyPlan | SafetyPlan | Yes |
| 134 | `getInterventionProtocol()` | GET | `/api/v1/crisis/protocols/{riskLevel}` | — | InterventionProtocol | Yes |
| 135 | `getAssessmentHistory()` | GET | `/api/v1/crisis/history?limit={n}` | — | AssessmentHistory | Yes |
| 136 | `getCrisisIndicators()` | GET | `/api/v1/crisis/indicators` | — | CrisisIndicatorsResponse | Yes |
| 137 | `checkEscalation()` | POST | `/api/v1/crisis/check-escalation` | `{ previous_assessment_id, current_context }` | EscalationCheck | Yes |

---

## 22. DATA RETENTION / PRIVACY (`src/api/dataRetention.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 138 | `getRetentionStatus()` | GET | `/api/v1/privacy/retention/status/{userId}` | — | RetentionStatus | Yes |
| 139 | `triggerRetentionCleanup()` | POST | `/api/v1/privacy/retention/cleanup/{userId}` | — | RetentionCleanupResult | Yes |
| 140 | `triggerSystemRetentionCleanup()` | POST | `/api/v1/privacy/retention/cleanup-all` | — | RetentionCleanupResult | Yes (Admin) |

---

## 23. ADMIN (`src/api/admin.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 141 | `getPerformanceMetrics()` | GET | `/api/v1/admin/performance-metrics` | — | PerformanceMetrics | Yes (Admin) |
| 142 | `getAdminStats()` | GET | `/api/v1/admin/stats` | — | AdminStats | Yes (Admin) |
| 143 | `getAdminUsers()` | GET | `/api/v1/admin/users?page=&limit=&search=&status=` | — | UsersListResponse | Yes (Admin) |
| 144 | `updateUserStatus()` | PUT | `/api/v1/admin/users/{userId}/status` | `{ status }` | `{ userId, newStatus }` | Yes (Admin) |
| 145 | `getContentReports()` | GET | `/api/v1/admin/reports?status=` | — | ReportsListResponse | Yes (Admin) |
| 146 | `resolveReport()` | POST | `/api/v1/admin/reports/{reportId}/resolve` | `{ action, notes?, content_type?, content_id? }` | `{ reportId, action }` | Yes (Admin) |
| 147 | `getSystemHealth()` | GET | `/api/v1/admin/system/health` | — | SystemHealth | Yes (Admin) |

---

## 24. SECURITY (`src/api/security.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 148 | `getKeyRotationStatus()` | GET | `/api/v1/security/key-rotation/status` | — | ApiKeyRotationStatus | Yes (Admin) |
| 149 | `getTamperEvents()` | GET | `/api/v1/security/tamper/events?limit={n}` | — | `{ events, summary, activeAlerts }` | Yes (Admin) |
| 150 | `getSecurityMetrics()` | GET | `/api/v1/security/monitoring/metrics` | — | SecurityMetrics | Yes (Admin) |

---

## 25. HEALTH MONITORING (`src/api/health.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 151 | `getHealthCheck()` | GET | `/api/health` | — | `{ status, timestamp }` | No |
| 152 | `getReadiness()` | GET | `/api/health/ready` | — | `{ status, checks }` | No |
| 153 | `getLiveness()` | GET | `/api/health/live` | — | `{ status, pid }` | No |
| 154 | `getSystemMetrics()` | GET | `/api/health/metrics` | — | SystemMetrics (CPU, memory, disk) | Yes (Admin) |
| 155 | `getDatabaseHealth()` | GET | `/api/health/db` | — | `{ status, latencyMs }` | Yes |
| 156 | `getAdvancedHealthReport()` | GET | `/api/health/advanced` | — | AdvancedHealthReport | Yes (Admin) |

---

## 26. INTEGRATIONS / OAUTH (`src/api/integrations.ts`)

### OAuth

| # | Function | Method | Endpoint | Data Sent | Auth |
|---|----------|--------|----------|-----------|------|
| 157 | `getOAuthAuthorizeUrl()` | GET | `/api/v1/integration/oauth/{provider}/authorize` | — | Yes |
| 158 | `getOAuthStatus()` | GET | `/api/v1/integration/oauth/{provider}/status` | — | Yes |
| 159 | `disconnectOAuth()` | POST | `/api/v1/integration/oauth/{provider}/disconnect` | — | Yes |

### Health Data Sync

| # | Function | Method | Endpoint | Data Sent | Auth |
|---|----------|--------|----------|-----------|------|
| 160 | `syncHealthDataFromProvider()` | POST | `/api/v1/integration/health/sync/{provider}` | `{ days }` | Yes |
| 161 | `syncHealthDataMulti()` | POST | `/api/v1/integration/health/sync` | `{ sources }` | Yes |
| 162 | `analyzeHealthMoodPatterns()` | POST | `/api/v1/integration/health/analyze` | `{ days }` | Yes |
| 163 | `checkHealthAlerts()` | POST | `/api/v1/integration/health/check-alerts` | `{ provider, health_data }` | Yes |
| 164 | `updateAlertSettings()` | POST | `/api/v1/integration/health/alert-settings` | AlertSettings | Yes |

### Auto-Sync

| # | Function | Method | Endpoint | Data Sent | Auth |
|---|----------|--------|----------|-----------|------|
| 165 | `toggleAutoSync()` | POST | `/api/v1/integration/oauth/{provider}/auto-sync` | `{ enabled, frequency }` | Yes |
| 166 | `getAutoSyncSettings()` | GET | `/api/v1/integration/oauth/auto-sync/settings` | — | Yes |

### Wearables (Legacy)

| # | Function | Method | Endpoint | Data Sent | Auth |
|---|----------|--------|----------|-----------|------|
| 167 | `getWearableStatus()` | GET | `/api/v1/integration/wearable/status` | — | Yes |
| 168 | `disconnectWearable()` | POST | `/api/v1/integration/wearable/disconnect` | `{ device_id }` | Yes |
| 169 | `syncWearable()` | POST | `/api/v1/integration/wearable/sync` | `{ device_id }` | Yes |
| 170 | `getWearableDetails()` | GET | `/api/v1/integration/wearable/details` | — | Yes |
| 171 | `syncGoogleFit()` | POST | `/api/v1/integration/wearable/google-fit/sync` | `{ access_token, date_from?, date_to? }` | Yes |

### FHIR

| # | Function | Method | Endpoint | Data Sent | Auth |
|---|----------|--------|----------|-----------|------|
| 172 | `getFHIRPatient()` | GET | `/api/v1/integration/fhir/patient` | — | Yes |
| 173 | `getFHIRObservations()` | GET | `/api/v1/integration/fhir/observation` | — | Yes |

### Crisis Referral

| # | Function | Method | Endpoint | Data Sent | Auth |
|---|----------|--------|----------|-----------|------|
| 174 | `createCrisisReferral()` | POST | `/api/v1/integration/crisis/referral` | `{ crisis_type, urgency_level, notes? }` | Yes |

---

## 27. SYNC HISTORY (`src/api/sync.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 175 | `getSyncHistory()` | GET | `/api/v1/sync-history/list?provider=&days=&limit=` | — | `{ history: [...] }` | Yes |
| 176 | `logSyncOperation()` | POST | `/api/v1/sync-history/log` | `{ provider, status, data_types, record_count, ... }` | `{ syncId }` | Yes |
| 177 | `getSyncStats()` | GET | `/api/v1/sync-history/stats` | — | SyncStatsResponse | Yes |
| 178 | `retrySyncOperation()` | POST | `/api/v1/sync-history/retry/{syncId}` | — | `{ retryId, message }` | Yes |

---

## 28. USER PROFILE (`src/api/users.ts`)

| # | Function | Method | Endpoint | Data Sent | Response | Auth |
|---|----------|--------|----------|-----------|----------|------|
| 179 | `getUserProfile()` | GET | `/api/v1/users/profile` | — | UserProfile | Yes |
| 180 | `updateUserPreferences()` | PUT | `/api/v1/users/preferences` | Preferences object | Updated preferences | Yes |
| 181 | `updateNotificationPreferences()` | PUT | `/api/v1/users/notification-preferences` | NotificationPreferences | — | Yes |
| 182 | `setNotificationSchedule()` | POST | `/api/v1/users/notification-schedule` | `{ type, time, enabled, message? }` | — | Yes |

---

## 29. DUPLICATE/LEGACY CALLS IN SERVICES

### `src/services/notifications.ts` (hardcoded URLs, duplicating `src/api/notifications.ts`)

| # | Function | Method | Endpoint | Notes |
|---|----------|--------|----------|-------|
| 183 | `saveToken()` | POST | `/api/v1/notifications/fcm-token` | Hardcoded URL (not using constants) |
| 184 | `scheduleNotification()` | POST | `/api/v1/users/{userId}/notification-schedule` | **⚠️ Different URL pattern** — uses `/api/v1/users/{userId}/...` vs API layer's `/api/v1/users/...` |
| 185 | `sendMoodReminder()` | POST | `/api/v1/notifications/send-reminder` | Hardcoded URL |
| 186 | `sendMeditationReminder()` | POST | `/api/v1/notifications/send-reminder` | Hardcoded URL |
| 187 | `scheduleDailyReminder()` | POST | `/api/v1/notifications/schedule-daily` | Hardcoded URL |
| 188 | `getNotificationPreferences()` | GET | `/api/v1/notifications/settings` | Hardcoded URL |
| 189 | `updateNotificationPreferences()` | POST | `/api/v1/notifications/settings` | Hardcoded URL |
| 190 | `disableAllNotifications()` | POST | `/api/v1/notifications/disable-all` | Hardcoded URL |

### `src/services/healthIntegrationService.ts` (hardcoded URLs, duplicating `src/api/integrations.ts`)

| # | Function | Method | Endpoint | Notes |
|---|----------|--------|----------|-------|
| 191 | `getDeviceStatus()` | GET | `/api/v1/integration/wearable/status` | Hardcoded |
| 192 | `getWearableDetails()` | GET | `/api/v1/integration/wearable/details` | Hardcoded |
| 193 | `connectDevice()` | POST | `/api/v1/integration/wearable/connect` | **⚠️ Endpoint not in `API_ENDPOINTS` constants — may not exist on backend** |
| 194 | `disconnectDevice()` | POST | `/api/v1/integration/wearable/disconnect` | Hardcoded |
| 195 | `syncDeviceData()` | POST | `/api/v1/integration/wearable/sync` | Hardcoded |
| 196 | `syncGoogleFit()` | POST | `/api/v1/integration/wearable/google-fit/sync` | Hardcoded |
| 197 | `syncAppleHealth()` | POST | `/api/v1/integration/wearable/apple-health/sync` | Hardcoded |
| 198 | `syncHealthData()` | POST | `/api/v1/integration/health/sync` | Hardcoded |
| 199 | `getFHIRPatient()` | GET | `/api/v1/integration/fhir/patient` | Hardcoded |
| 200 | `getFHIRObservations()` | GET | `/api/v1/integration/fhir/observation` | Hardcoded |
| 201 | `createCrisisReferral()` | POST | `/api/v1/integration/crisis/referral` | Hardcoded |

### `src/services/oauthHealthService.ts` (hardcoded URLs, duplicating `src/api/integrations.ts`)

| # | Function | Method | Endpoint | Notes |
|---|----------|--------|----------|-------|
| 202 | `initiateConnection()` | GET | `/api/v1/integration/oauth/{id}/authorize` | Hardcoded |
| 203 | `checkConnectionStatus()` | GET | `/api/v1/integration/oauth/{id}/status` | Hardcoded |
| 204 | `disconnect()` | POST | `/api/v1/integration/oauth/{id}/disconnect` | Hardcoded |
| 205 | `syncData()` | POST | `/api/v1/integration/health/sync/{id}` | Hardcoded |

---

## SUMMARY STATISTICS

| Category | API Calls | Endpoints |
|----------|-----------|-----------|
| Authentication | 14 | 12 |
| Mood | 7 | 6 |
| Dashboard | 5 | 4 |
| Memories | 5 | 4 |
| AI Chatbot | 12 | 10 |
| Peer Chat | 9 | 8 |
| Journaling | 4 | 3 |
| Meditation | 2 | 2 |
| Notifications | 6 | 5 |
| Onboarding | 5 | 4 |
| Rewards | 7 | 7 |
| Challenges | 6 | 5 |
| Referrals | 9 | 7 |
| Leaderboard | 5 | 5 |
| Feedback | 6 | 4 |
| Audio | 4 | 4 |
| Voice | 3 | 3 |
| Subscription | 7 | 6 |
| Consent/GDPR | 6 | 5 |
| CBT | 6 | 6 |
| Crisis | 7 | 7 |
| Data Retention | 3 | 3 |
| Admin | 7 | 5 |
| Security | 3 | 3 |
| Health Monitoring | 6 | 6 |
| Integrations/OAuth | 18 | 14 |
| Sync History | 4 | 4 |
| User Profile | 4 | 4 |
| Legacy/Duplicate Services | ~23 | — |
| **TOTAL** | **~205** | **~159 unique** |

---

## ⚠️ ISSUES FOUND

### Critical

1. **`MemoryRecorder.tsx` (line 75)**: Uses raw `axios.post()` instead of the `api` client instance. This **bypasses all interceptors** — no automatic auth token, no CSRF token, no retry logic, no error tracking. Should use `uploadMemory()` from `src/api/memories.ts` or at minimum use the `api` instance.

2. **`healthIntegrationService.ts` — `/api/v1/integration/wearable/connect`**: This endpoint is called but does NOT exist in `API_ENDPOINTS` constants and may not exist on the backend. The backend only has status/disconnect/sync endpoints for wearables.

### Moderate

3. **Duplicate service layers**: `src/services/notifications.ts`, `src/services/healthIntegrationService.ts`, and `src/services/oauthHealthService.ts` all use hardcoded URL strings instead of `API_ENDPOINTS` constants. They duplicate functionality already in `src/api/notifications.ts` and `src/api/integrations.ts`. This creates maintenance risk — if URLs change, these won't be updated.

4. **`FeedbackHistory.tsx` (line 31)**: Adds `?user_id={id}` query param to `/api/v1/feedback/my-feedback`. The API layer's `getMyFeedback()` does NOT send this param (backend gets user from JWT). The extra param may be ignored or could cause issues.

5. **`services/notifications.ts` — `scheduleNotification()`**: Uses URL `/api/v1/users/{userId}/notification-schedule` which includes `userId` in the path. The API layer's `users.ts` uses `/api/v1/users/notification-schedule` (no userId in path, from JWT). These are different URLs — one may be broken.

### Minor

6. **`useLoginForm.ts` + `LoginForm.tsx`**: Both contain identical Google login logic calling `/api/v1/auth/google-login`. The hook and the component duplicate the same API call pattern.

7. **snake_case vs camelCase inconsistency**: Some direct component calls send `user_id` (snake_case) while the backend may expect `userId` (camelCase) or vice versa. The API layer handles normalization, but direct calls in components don't always normalize.

8. **`deleteMemory()` URL**: Uses `/api/v1/memory/list/{memoryId}` — the `LIST_MEMORIES` constant. This should probably be a dedicated delete endpoint rather than reusing the list endpoint path.

9. **Two CSRF token endpoints**: `AUTH.CSRF_TOKEN` and `DASHBOARD.CSRF_TOKEN` both point to `/api/v1/dashboard/csrf-token` — redundant but not broken.

10. **Commented-out sync calls**: `useOfflineSync.ts` has commented-out `api.post('/moods')` and `api.post('/memories')` calls that would use incorrect non-versioned URLs if uncommented.
