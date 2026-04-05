/**
 * [DB1] Zod runtime validators for every Firestore collection read on the
 * frontend.  Import the relevant schema and call `.safeParse(doc.data())` —
 * or use the typed `parse*` helpers below — before using Firestore data in
 * application logic.
 *
 * All schemas use `.passthrough()` so unknown fields added in future
 * migrations do not cause parse failures.
 *
 * Example:
 *   const snap = await getDoc(doc(db, 'moods', moodId));
 *   const result = MoodEntrySchema.safeParse({ id: snap.id, ...snap.data() });
 *   if (!result.success) { logger.error(result.error); return; }
 *   const entry = result.data; // fully typed MoodEntry
 */

import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────────────────

const timestampLike = z.union([z.string(), z.date(), z.object({ toDate: z.function() })]).optional().nullable();
const safeStr = (max = 2000) => z.string().max(max).default('');
const safeStrOpt = (max = 2000) => z.string().max(max).optional().nullable();
const safeList = (itemMax = 100) =>
  z.array(z.string().max(itemMax)).max(200).default([]);

// ─── users ───────────────────────────────────────────────────────────────────

export const UserDocSchema = z.object({
  id: safeStr(128),
  email: safeStr(320),
  display_name: safeStrOpt(256),
  avatar_url: safeStrOpt(2048),
  language: z.enum(['sv', 'en', 'no']).default('sv'),
  timezone: safeStr(64),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  subscription_tier: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
  email_verified: z.boolean().default(false),
  onboarding_completed: z.boolean().default(false),
  created_at: timestampLike,
  updated_at: timestampLike,
  last_login: timestampLike,
}).passthrough();

export type UserDoc = z.infer<typeof UserDocSchema>;

// ─── moods ───────────────────────────────────────────────────────────────────

export const MoodEntrySchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  mood_value: z.number().int().min(1).max(10),
  valence: z.number().int().min(1).max(10).optional().nullable(),
  arousal: z.number().int().min(1).max(10).optional().nullable(),
  category: safeStrOpt(64),
  note: z.string().max(1000).optional().nullable(),
  triggers: safeList(),
  activities: safeList(),
  tags: safeList(),
  timestamp: timestampLike,
  created_at: timestampLike,
}).passthrough();

export type MoodEntry = z.infer<typeof MoodEntrySchema>;

// ─── memories ────────────────────────────────────────────────────────────────

export const MemoryDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  title: safeStr(256),
  content: z.string().max(10_000).default(''),
  audio_url: safeStrOpt(2048),
  tags: safeList(),
  is_encrypted: z.boolean().default(false),
  created_at: timestampLike,
  updated_at: timestampLike,
}).passthrough();

export type MemoryDoc = z.infer<typeof MemoryDocSchema>;

// ─── ai_stories ──────────────────────────────────────────────────────────────

export const AIStoryDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  title: safeStr(256),
  content: z.string().max(50_000).default(''),
  mood_context: z.record(z.unknown()).default({}),
  model: safeStr(64),
  generated_at: timestampLike,
}).passthrough();

export type AIStoryDoc = z.infer<typeof AIStoryDocSchema>;

// ─── peer_chat_messages ──────────────────────────────────────────────────────

export const PeerChatMessageSchema = z.object({
  id: safeStr(128),
  sender_id: z.string().min(1).max(128),
  room_id: z.string().min(1).max(128),
  room_participants: z.array(z.string().max(128)).max(50).default([]),
  content: z.string().max(5000).default(''),
  is_encrypted: z.boolean().default(false),
  created_at: timestampLike,
  edited_at: timestampLike,
}).passthrough();

export type PeerChatMessage = z.infer<typeof PeerChatMessageSchema>;

// ─── challenges ──────────────────────────────────────────────────────────────

export const ChallengeDocSchema = z.object({
  id: safeStr(128),
  title: safeStr(256),
  description: z.string().max(5000).default(''),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).default('medium'),
  category: safeStr(64),
  max_participants: z.number().int().positive().optional().nullable(),
  start_date: timestampLike,
  end_date: timestampLike,
  reward_xp: z.number().int().min(0).max(10_000).default(0),
  created_by: safeStrOpt(128),
  created_at: timestampLike,
}).passthrough();

export type ChallengeDoc = z.infer<typeof ChallengeDocSchema>;

// ─── user_challenges ─────────────────────────────────────────────────────────

export const UserChallengeDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  challenge_id: z.string().min(1).max(128),
  status: z.enum(['joined', 'in_progress', 'completed', 'abandoned']).default('joined'),
  progress: z.number().int().min(0).max(100).default(0),
  completed_at: timestampLike,
  joined_at: timestampLike,
}).passthrough();

export type UserChallengeDoc = z.infer<typeof UserChallengeDocSchema>;

// ─── reward_profiles ─────────────────────────────────────────────────────────

export const RewardProfileDocSchema = z.object({
  id: safeStr(128),
  user_id: safeStr(128),
  total_xp: z.number().int().min(0).default(0),
  level: z.number().int().min(1).default(1),
  badges: z.array(z.string().max(64)).max(200).default([]),
  streak_days: z.number().int().min(0).default(0),
  updated_at: timestampLike,
}).passthrough();

export type RewardProfileDoc = z.infer<typeof RewardProfileDocSchema>;

// ─── user_devices ────────────────────────────────────────────────────────────

export const UserDeviceDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  provider: safeStr(64),
  device_name: safeStrOpt(256),
  scopes: z.array(z.string().max(256)).max(50).default([]),
  connected_at: timestampLike,
  last_synced_at: timestampLike,
  is_active: z.boolean().default(true),
}).passthrough();

export type UserDeviceDoc = z.infer<typeof UserDeviceDocSchema>;

// ─── journal_entries ─────────────────────────────────────────────────────────

export const JournalEntryDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  content_encrypted: safeStr(100_000),
  title: safeStr(256),
  mood_snapshot: z.record(z.unknown()).default({}),
  tags: safeList(),
  word_count: z.number().int().min(0).max(100_000).default(0),
  created_at: timestampLike,
  updated_at: timestampLike,
}).passthrough();

export type JournalEntryDoc = z.infer<typeof JournalEntryDocSchema>;

// ─── onboarding_data ─────────────────────────────────────────────────────────

export const OnboardingDataDocSchema = z.object({
  id: safeStr(128),
  user_id: safeStr(128),
  selected_goals: safeList(128),
  wellbeing_baseline: z.number().int().min(1).max(10).optional().nullable(),
  primary_concern: safeStrOpt(256),
  preferred_language: z.enum(['sv', 'en', 'no']).default('sv'),
  notifications_enabled: z.boolean().default(true),
  completed_at: timestampLike,
}).passthrough();

export type OnboardingDataDoc = z.infer<typeof OnboardingDataDocSchema>;

// ─── usage ───────────────────────────────────────────────────────────────────

export const UsageDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(''),
  ai_requests: z.number().int().min(0).max(100_000).default(0),
  mood_logs: z.number().int().min(0).max(100_000).default(0),
  journal_entries: z.number().int().min(0).max(100_000).default(0),
  voice_sessions: z.number().int().min(0).max(100_000).default(0),
  last_updated: timestampLike,
}).passthrough();

export type UsageDoc = z.infer<typeof UsageDocSchema>;

// ─── chat_history ────────────────────────────────────────────────────────────

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  content: z.string().max(10_000).default(''),
  timestamp: timestampLike,
}).passthrough();

export const ChatHistoryDocSchema = z.object({
  id: safeStr(128),
  user_id: z.string().min(1).max(128),
  session_id: safeStr(128),
  messages: z.array(ChatMessageSchema).max(500).default([]),
  total_tokens: z.number().int().min(0).default(0),
  created_at: timestampLike,
  updated_at: timestampLike,
}).passthrough();

export type ChatHistoryDoc = z.infer<typeof ChatHistoryDocSchema>;

// ─── Typed parse helpers ──────────────────────────────────────────────────────

/**
 * Parse a Firestore document snapshot into a typed schema result.
 * Returns `null` on validation failure and logs the error.
 *
 * @example
 *   const mood = parseFirestoreDoc(MoodEntrySchema, snap);
 */
export function parseFirestoreDoc<T extends z.ZodTypeAny>(
  schema: T,
  snap: { id: string; data: () => Record<string, unknown> | undefined },
): z.infer<T> | null {
  const raw = snap.data();
  if (!raw) return null;
  const result = schema.safeParse({ id: snap.id, ...raw });
  if (!result.success) {
    // Log in development; silent in production to avoid log flooding
    if (import.meta.env.DEV) {
      console.warn('[DB1] Firestore schema validation failed:', result.error.flatten());
    }
    return null;
  }
  return result.data;
}
