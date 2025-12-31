import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../api/api';
import planConfigJson from '../../shared/subscription_plans.json';

/**
 * Subscription Plan Types
 * Based on architecture report recommendations
 */
export type SubscriptionTier = 'free' | 'premium' | 'trial' | 'enterprise';

export interface SubscriptionLimits {
  moodLogsPerDay: number;      // Free: 3, Premium: unlimited (-1)
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

const createPlan = (tier: SubscriptionTier): SubscriptionPlan => {
  const config = PLAN_CONFIG[tier] ?? PLAN_CONFIG['free'];
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

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Local storage keys
const USAGE_STORAGE_KEY = 'lugn_trygg_daily_usage';
const SUBSCRIPTION_CACHE_KEY = 'lugn_trygg_subscription_cache';

interface SubscriptionStatusResponse {
  plan?: string;
  status?: string;
  is_premium?: boolean;
  is_trial?: boolean;
  expires_at?: string;
  trial_ends_at?: string;
  limits?: SubscriptionLimits;
  features?: SubscriptionFeatures;
  usage?: {
    date?: string;
    mood_logs?: number;
    chat_messages?: number;
  };
  name?: string;
  price?: number;
  currency?: string;
  interval?: string;
}

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
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed: DailyUsage = JSON.parse(stored);
        if (parsed.lastResetDate === today) {
          setUsage(parsed);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse usage data:', e);
      }
    }
    
    // Reset for new day
    const newUsage: DailyUsage = {
      moodLogs: 0,
      chatMessages: 0,
      lastResetDate: today || '',
    };
    setUsage(newUsage);
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(newUsage));
  }, []);

  // Fetch subscription status from backend
  const fetchSubscription = useCallback(async () => {
    if (!user?.user_id) {
      setPlan(FREE_PLAN);
      setUsage(DEFAULT_USAGE);
      setLoading(false);
      return;
    }

    try {
      // Try to get from cache first
      const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
      if (cached) {
        try {
          const { plan: cachedPlan, usage: cachedUsage, timestamp } = JSON.parse(cached);
          // Cache valid for 5 minutes
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setPlan(cachedPlan);
            if (cachedUsage) {
              setUsage(cachedUsage);
            }
            setLoading(false);
            // Still fetch in background to update
          }
        } catch (e) {
          console.warn('Failed to parse subscription cache:', e);
        }
      }

      // Fetch from backend
      const response = await api.get(`/api/subscription/status/${user.user_id}`);
      const data = response.data as SubscriptionStatusResponse;

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
        ...basePlan,
        tier: resolvedTier,
        limits: data.limits || basePlan.limits,
        features: data.features || basePlan.features,
        name: data.name || basePlan.name,
        price: typeof data.price === 'number' ? data.price : basePlan.price,
        currency: data.currency || basePlan.currency,
        interval: data.interval || basePlan.interval,
        expiresAt: data.expires_at ? new Date(data.expires_at) : basePlan.expiresAt,
        trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : basePlan.trialEndsAt,
      };

      setPlan(newPlan);

      let latestUsage: DailyUsage = {
        moodLogs: data.usage?.mood_logs ?? DEFAULT_USAGE.moodLogs,
        chatMessages: data.usage?.chat_messages ?? DEFAULT_USAGE.chatMessages,
        lastResetDate: data.usage?.date || new Date().toISOString().split('T')[0] || DEFAULT_USAGE.lastResetDate,
      };
      setUsage(latestUsage);
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(latestUsage));
      
      // Cache the result
      localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({
        plan: newPlan,
        usage: latestUsage,
        timestamp: Date.now(),
      }));

    } catch (error) {
      console.warn('Failed to fetch subscription status, defaulting to free:', error);
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
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  }, [usage]);

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
  const incrementMoodLog = useCallback(() => {
    setUsage(prev => ({
      ...prev,
      moodLogs: prev.moodLogs + 1,
    }));
  }, []);

  const incrementChatMessage = useCallback(() => {
    setUsage(prev => ({
      ...prev,
      chatMessages: prev.chatMessages + 1,
    }));
  }, []);

  // Feature check
  const hasFeature = useCallback((feature: keyof SubscriptionFeatures): boolean => {
    return Boolean(plan.features?.[feature]);
  }, [plan.features]);

  // Manual refresh
  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
    await fetchSubscription();
  }, [fetchSubscription]);

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
