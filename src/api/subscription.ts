/**
 * Subscription API Client
 * Handles subscription management, Stripe checkout, and plan operations
 */

import { api } from './client';
import { API_ENDPOINTS } from './constants';

/**
 * Subscription status from backend
 */
export interface SubscriptionStatus {
  plan: 'free' | 'premium' | 'trial' | 'enterprise';
  status: 'active' | 'canceled' | 'canceling' | 'expired' | 'inactive';
  isPremium: boolean;
  isTrial: boolean;
  expiresAt?: string; // ISO date
  trialEndsAt?: string; // ISO date
  limits: {
    moodLogsPerDay: number;
    chatMessagesPerDay: number;
    historyDays: number;
  };
  features: {
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
  };
  usage?: {
    date: string;
    moodLogs: number;
    chatMessages: number;
  };
  name?: string;
  price?: number;
  currency?: string;
  interval?: string;
}

/**
 * Stripe checkout session response
 */
export interface CheckoutSession {
  sessionId: string;
  url: string;
}

/**
 * Subscription plan details
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  limits: {
    moodLogsPerDay: number;
    chatMessagesPerDay: number;
    historyDays: number;
  };
  features: {
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
  };
  description?: string;
}

/**
 * User purchases (CBT modules, etc.)
 */
export interface UserPurchases {
  purchases: string[];
}

/**
 * Cancellation result
 */
export interface CancellationResult {
  message: string;
}

/**
 * Create Stripe checkout session for subscription
 * 
 * @param email - User's email
 * @param plan - Subscription plan ('premium' | 'enterprise')
 * @param billingCycle - Billing cycle ('monthly' | 'yearly')
 * @returns Checkout session with redirect URL
 */
export async function createCheckoutSession(
  email: string,
  plan: 'premium' | 'enterprise' = 'premium',
  billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<CheckoutSession> {
  const response = await api.post(API_ENDPOINTS.SUBSCRIPTION.CREATE_SESSION, {
    email,
    plan,
    billing_cycle: billingCycle,
  });

  return {
    sessionId: response.data.data.sessionId,
    url: response.data.data.url,
  };
}

/**
 * Get user's subscription status
 * 
 * @param userId - User ID
 * @returns Subscription status and usage
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const response = await api.get(`${API_ENDPOINTS.SUBSCRIPTION.STATUS}/${userId}`);
  
  const data = response.data.data;
  
  return {
    plan: data.plan || 'free',
    status: data.status || 'inactive',
    isPremium: data.isPremium || false,
    isTrial: data.isTrial || false,
    expiresAt: data.expiresAt,
    trialEndsAt: data.trialEndsAt,
    limits: data.limits || {
      moodLogsPerDay: 3,
      chatMessagesPerDay: 10,
      historyDays: 7,
    },
    features: data.features || {
      voiceChat: false,
      sounds: false,
      analytics: false,
      insights: false,
      journal: false,
      gamification: false,
      social: false,
      export: false,
      aiStories: false,
      recommendations: false,
      wellness: false,
    },
    usage: data.usage ? {
      date: data.usage.date,
      moodLogs: data.usage.moodLogs || 0,
      chatMessages: data.usage.chatMessages || 0,
    } : undefined,
    name: data.name,
    price: data.price,
    currency: data.currency,
    interval: data.interval,
  };
}

/**
 * Get available subscription plans
 * 
 * @returns List of available plans
 */
export async function getAvailablePlans(): Promise<SubscriptionPlan[]> {
  const response = await api.get(API_ENDPOINTS.SUBSCRIPTION.PLANS);
  const data = response.data?.data || response.data;
  // Backend returns plans as an object { free: {...}, premium: {...}, ... }
  if (Array.isArray(data.plans)) {
    return data.plans;
  }
  // Convert plans object to array
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return Object.entries(data)
      .filter(([key]) => key !== 'message' && key !== 'success')
      .map(([key, value]: [string, any]) => ({
        id: key,
        ...value,
      }));
  }
  return [];
}

/**
 * Purchase CBT module (one-time payment)
 * 
 * @param email - User's email
 * @param module - Module identifier
 * @returns Checkout session with redirect URL
 */
export async function purchaseCBTModule(
  email: string,
  module: string
): Promise<CheckoutSession> {
  const response = await api.post(API_ENDPOINTS.SUBSCRIPTION.PURCHASE_CBT_MODULE, {
    email,
    module,
  });

  return {
    sessionId: response.data.data.sessionId,
    url: response.data.data.url,
  };
}

/**
 * Get user's purchased items (CBT modules, etc.)
 * 
 * @param userId - User ID
 * @returns List of purchased items
 */
export async function getUserPurchases(userId: string): Promise<UserPurchases> {
  const response = await api.get(`${API_ENDPOINTS.SUBSCRIPTION.PURCHASES}/${userId}`);
  
  return {
    purchases: response.data.data.purchases || [],
  };
}

/**
 * Cancel user's subscription (at period end)
 * 
 * @param userId - User ID
 * @returns Cancellation confirmation message
 */
export async function cancelSubscription(userId: string): Promise<CancellationResult> {
  const response = await api.post(`${API_ENDPOINTS.SUBSCRIPTION.CANCEL}/${userId}`);
  
  return {
    message: response.data.data.message || 'Subscription canceled successfully',
  };
}
