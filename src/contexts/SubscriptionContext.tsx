import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus } from '../api/subscription';
import { getUsageStatus, incrementMoodLog as apiIncrementMoodLog, incrementChatMessage as apiIncrementChatMessage } from '../api/usage';
import planConfigJson from '../../shared/subscription_plans.json';
import { logger } from '../utils/logger';


/**
 * Subscription Plan Types
 * Based on architecture report recommendations
 */
export type SubscriptionTier = 'free' | 'premium' | 'trial' | 'enterprise';

export interface SubscriptionLimits {
  moodLogsPerDay: number;      // Free: 5, Premium: unlimited (-1)
  chatMessagesPerDay: number;  // Free: 10, Premium: unlimited (-1)
  historyDays: number;         // Free: 7, Premium: unlimited (-1)
}

export interface SubscriptionFeatures {
  voiceChat: boolean;
  sounds: boolean;
  analytics: boolean;
  insights: boolean;
  journal: boolean;
  gamification: boolean;
  social: boolean;
  export: boolean;
  aiStories: boolean;
  recommendations: boolean;
  wellness: boolean;
  advancedMood: boolean;
  moodForecast: boolean;
  [key: string]: boolean;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
  name?: string;
  price?: number;
  currency?: string;
  interval?: string;
  expiresAt?: Date;
  trialEndsAt?: Date;
}

export interface DailyUsage {
  moodLogs: number;
  chatMessages: number;
  lastResetDate: string; // ISO date string
}

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  usage: DailyUsage;
  loading: boolean;
  isPremium: boolean;
  isTrial: boolean;
  // Usage tracking
  canLogMood: () => boolean;
  canSendMessage: () => boolean;
  incrementMoodLog: () => void;
  incrementChatMessage: () => void;
  getRemainingMoodLogs: () => number;
  getRemainingMessages: () => number;
  // Feature checks
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  // Upgrade
  refreshSubscription: () => Promise<void>;
}

interface SharedPlanConfig {
  name: string;
  price: number;
  currency: string;
  interval: string;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
}

const PLAN_CONFIG = planConfigJson as Record<string, SharedPlanConfig>;

// Create the context
const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const createPlan = (tier: SubscriptionTier): SubscriptionPlan => {
  const config = PLAN_CONFIG[tier] ?? PLAN_CONFIG['free'];
  if (!config) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  return {
    tier,
    limits: config.limits,
    features: config.features,
    name: config.name,
    price: config.price,
    currency: config.currency,
    interval: config.interval,
  };
};

/**
 * Local-only subscription override, mirroring the `__e2e_test_auth__` escape
 * hatch in AuthContext and gated to loopback the same way.
 *
 * Most of this app sits behind a premium gate, and there was no way to reach
 * those pages on a dev machine — so every change to Belöningar, Dagbok,
 * Insikter or Rekommendationer shipped without anyone having seen it render.
 * "Type-checked but never looked at" is not the same as verified.
 *
 * Returns null anywhere that is not localhost, so this cannot grant a
 * subscription to a real user even if the key somehow ends up in their
 * browser. It is read once per subscription fetch, never written by the app.
 */
const readLocalTierOverride = (): SubscriptionTier | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  const host = window.location.hostname;
  const isLocalLoopback =
    host.includes('localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]';

  if (!isLocalLoopback) {
    return null;
  }

  try {
    const raw = localStorage.getItem('__e2e_test_tier__');
    if (raw === 'premium' || raw === 'trial' || raw === 'enterprise' || raw === 'free') {
      return raw;
    }
  } catch {
    /* localStorage unavailable */
  }
  return null;
};

const FREE_PLAN = createPlan('free');
const PREMIUM_PLAN = createPlan('premium');
const TRIAL_PLAN: SubscriptionPlan = {
  ...createPlan('trial'),
  tier: 'trial',
};
const ENTERPRISE_PLAN = createPlan('enterprise');

const DEFAULT_USAGE: DailyUsage = {
  moodLogs: 0,
  chatMessages: 0,
  lastResetDate: new Date().toISOString().split('T')[0] || '',
};

/**
 * Safely convert a backend date value (ISO string, Firestore timestamp, or Date)
 * to a valid Date object. Returns undefined if the value is invalid.
 */
const normalizeDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  // Firestore timestamp object
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
    const seconds = (value as { seconds: number; nanoseconds?: number }).seconds;
    const nanoseconds = (value as { seconds: number; nanoseconds?: number }).nanoseconds ?? 0;
    const date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
    return !isNaN(date.getTime()) ? date : undefined;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date.getTime()) ? date : undefined;
  }

  return undefined;
};

// Local storage keys — namespaced per user
const getUsageStorageKey = (userId?: string) => `lugn_trygg_daily_usage_${userId || 'anonymous'}`;
const getSubscriptionCacheKey = (userId?: string) => `lugn_trygg_subscription_cache_${userId || 'anonymous'}`;

/**
 * SubscriptionProvider
 * 
 * Manages subscription state, daily limits, and feature access.
 * Persists usage to localStorage with daily reset.
 */
export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isLoggedIn } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan>(FREE_PLAN);
  const [usage, setUsage] = useState<DailyUsage>(DEFAULT_USAGE);
  const [loading, setLoading] = useState(true);

  // Check and reset daily usage if needed
  const checkAndResetDailyUsage = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    let stored: string | null = null;
    try { stored = localStorage.getItem(getUsageStorageKey(user?.user_id)); } catch { /* localStorage unavailable */ }
    
    if (stored) {
      try {
        const parsed: DailyUsage = JSON.parse(stored);
        if (parsed.lastResetDate === today) {
          setUsage(parsed);
          return;
        }
      } catch (e) {
        logger.warn('Failed to parse usage data:', e);
        // Clear corrupted data
        try { localStorage.removeItem(getUsageStorageKey(user?.user_id)); } catch { /* localStorage unavailable */ }
      }
    }
    
    // Reset for new day
    const newUsage: DailyUsage = {
      moodLogs: 0,
      chatMessages: 0,
      lastResetDate: today || '',
    };
    setUsage(newUsage);
    try { localStorage.setItem(getUsageStorageKey(user?.user_id), JSON.stringify(newUsage)); } catch { /* localStorage unavailable */ }
  }, [user?.user_id]);

  // Fetch subscription status from backend
  const fetchSubscription = useCallback(async () => {
    if (!user?.user_id) {
      setPlan(FREE_PLAN);
      setUsage(DEFAULT_USAGE);
      setLoading(false);
      return;
    }

    const tierOverride = readLocalTierOverride();
    if (tierOverride) {
      logger.warn(`Subscription tier overridden locally: ${tierOverride}`);
      setPlan(createPlan(tierOverride));
      setLoading(false);
      return;
    }

    try {
      // Try to get from cache first
      const cached = localStorage.getItem(getSubscriptionCacheKey(user?.user_id));
      if (cached) {
        try {
          const { plan: cachedPlan, usage: cachedUsage, timestamp } = JSON.parse(cached);
          // Cache valid for 5 minutes
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            const restoredPlan: SubscriptionPlan = {
              ...cachedPlan,
              expiresAt: normalizeDate(cachedPlan.expiresAt),
              trialEndsAt: normalizeDate(cachedPlan.trialEndsAt),
            };
            setPlan(restoredPlan);
            if (cachedUsage) {
              setUsage(cachedUsage);
            }
            setLoading(false);
            // Still fetch in background to update
          }
        } catch (e) {
          logger.warn('Failed to parse subscription cache:', e);
        }
      }

      // Fetch subscription from backend
      const data = await getSubscriptionStatus(user.user_id);

      const normalizeTier = (tier?: string): SubscriptionTier => {
        if (tier === 'premium' || tier === 'trial' || tier === 'enterprise' || tier === 'free') {
          return tier;
        }
        return 'free';
      };

      const resolvedTier = normalizeTier(data.plan);

      const basePlan = (() => {
        switch (resolvedTier) {
          case 'premium':
            return PREMIUM_PLAN;
          case 'trial':
            return TRIAL_PLAN;
          case 'enterprise':
            return ENTERPRISE_PLAN;
          default:
            return FREE_PLAN;
        }
      })();

      const newPlan: SubscriptionPlan = {
        tier: resolvedTier,
        limits: data.limits || basePlan.limits,
        features: { ...basePlan.features, ...(data.features || {}) } as SubscriptionFeatures,
      };

      // Only add optional properties if they have values
      if (data.name) newPlan.name = data.name;
      else if (basePlan.name) newPlan.name = basePlan.name;
      
      if (typeof data.price === 'number') newPlan.price = data.price;
      else if (typeof basePlan.price === 'number') newPlan.price = basePlan.price;
      
      if (data.currency) newPlan.currency = data.currency;
      else if (basePlan.currency) newPlan.currency = basePlan.currency;
      
      if (data.interval) newPlan.interval = data.interval;
      else if (basePlan.interval) newPlan.interval = basePlan.interval;
      
      const parsedExpiresAt = normalizeDate(data.expiresAt);
      if (parsedExpiresAt) newPlan.expiresAt = parsedExpiresAt;
      else if (basePlan.expiresAt) newPlan.expiresAt = basePlan.expiresAt;

      const parsedTrialEndsAt = normalizeDate(data.trialEndsAt);
      if (parsedTrialEndsAt) newPlan.trialEndsAt = parsedTrialEndsAt;
      else if (basePlan.trialEndsAt) newPlan.trialEndsAt = basePlan.trialEndsAt;

      setPlan(newPlan);

      // Fetch usage from backend
      const usageData = await getUsageStatus();
      const latestUsage: DailyUsage = {
        moodLogs: usageData.mood_logs,
        chatMessages: usageData.chat_messages,
        lastResetDate: usageData.date,
      };
      setUsage(latestUsage);
      
      // Cache the result
      try { localStorage.setItem(getSubscriptionCacheKey(user?.user_id), JSON.stringify({
        plan: newPlan,
        usage: latestUsage,
        timestamp: Date.now(),
      })); } catch { /* localStorage unavailable */ }

    } catch (error) {
      logger.warn('Failed to fetch subscription status, defaulting to free:', error);
      setPlan(FREE_PLAN);
      setUsage(DEFAULT_USAGE);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  // Initialize on mount and user change
  useEffect(() => {
    checkAndResetDailyUsage();
    if (isLoggedIn && user) {
      fetchSubscription();
    } else {
      setPlan(FREE_PLAN);
      setUsage(DEFAULT_USAGE);
      setLoading(false);
    }
  }, [user, fetchSubscription, checkAndResetDailyUsage, isLoggedIn]);

  // Save usage to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(getUsageStorageKey(user?.user_id), JSON.stringify(usage));
    } catch (e) {
      logger.warn('Failed to save usage to localStorage:', e);
    }
  }, [usage, user?.user_id]);

  // Derived states
  const isPremium = plan.tier === 'premium' || plan.tier === 'enterprise';
  const isTrial = plan.tier === 'trial';

  // Usage checking functions
  const canLogMood = useCallback((): boolean => {
    if (plan.limits.moodLogsPerDay === -1) return true;
    return usage.moodLogs < plan.limits.moodLogsPerDay;
  }, [plan.limits.moodLogsPerDay, usage.moodLogs]);

  const canSendMessage = useCallback((): boolean => {
    if (plan.limits.chatMessagesPerDay === -1) return true;
    return usage.chatMessages < plan.limits.chatMessagesPerDay;
  }, [plan.limits.chatMessagesPerDay, usage.chatMessages]);

  const getRemainingMoodLogs = useCallback((): number => {
    if (plan.limits.moodLogsPerDay === -1) return -1;
    return Math.max(0, plan.limits.moodLogsPerDay - usage.moodLogs);
  }, [plan.limits.moodLogsPerDay, usage.moodLogs]);

  const getRemainingMessages = useCallback((): number => {
    if (plan.limits.chatMessagesPerDay === -1) return -1;
    return Math.max(0, plan.limits.chatMessagesPerDay - usage.chatMessages);
  }, [plan.limits.chatMessagesPerDay, usage.chatMessages]);

  // Usage increment functions
  const incrementMoodLog = useCallback(async () => {
    try {
      const result = await apiIncrementMoodLog();
      if (result.success) {
        setUsage(prev => ({
          ...prev,
          moodLogs: result.mood_logs ?? prev.moodLogs + 1,
        }));
      }
    } catch (error) {
      logger.error('Failed to increment mood log on backend:', error);
      // Fallback to local increment if backend fails
      setUsage(prev => ({
        ...prev,
        moodLogs: prev.moodLogs + 1,
      }));
    }
  }, []);

  const incrementChatMessage = useCallback(async () => {
    try {
      const result = await apiIncrementChatMessage();
      if (result.success) {
        setUsage(prev => ({
          ...prev,
          chatMessages: result.chat_messages ?? prev.chatMessages + 1,
        }));
      }
    } catch (error) {
      // Backend increment failed - using local fallback
      logger.warn('Backend usage increment failed, using local fallback:', error);
      // Fallback to local increment if backend fails
      setUsage(prev => ({
        ...prev,
        chatMessages: prev.chatMessages + 1,
      }));
    }
  }, []);

  // Feature check
  const hasFeature = useCallback((feature: keyof SubscriptionFeatures): boolean => {
    return Boolean(plan.features?.[feature]);
  }, [plan.features]);

  // Manual refresh
  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    try { localStorage.removeItem(getSubscriptionCacheKey(user?.user_id)); } catch { /* localStorage unavailable */ }
    await fetchSubscription();
  }, [fetchSubscription, user?.user_id]);

  const value: SubscriptionContextType = {
    plan,
    usage,
    loading,
    isPremium,
    isTrial,
    canLogMood,
    canSendMessage,
    incrementMoodLog,
    incrementChatMessage,
    getRemainingMoodLogs,
    getRemainingMessages,
    hasFeature,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

/**
 * useSubscription hook
 * Access subscription context from any component
 */
export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;
