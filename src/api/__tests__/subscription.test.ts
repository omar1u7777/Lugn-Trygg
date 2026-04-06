/**
 * Tests for subscription API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    SUBSCRIPTION: {
      CREATE_SESSION: '/api/v1/subscription/create-session',
      STATUS: '/api/v1/subscription/status',
      PLANS: '/api/v1/subscription/plans',
      PURCHASE_CBT_MODULE: '/api/v1/subscription/purchase-cbt',
      PURCHASES: '/api/v1/subscription/purchases',
      CANCEL: '/api/v1/subscription/cancel',
    },
  },
}));

import { api } from '../client';
import {
  createCheckoutSession,
  getSubscriptionStatus,
  getAvailablePlans,
  purchaseCBTModule,
  getUserPurchases,
  cancelSubscription,
} from '../subscription';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

describe('createCheckoutSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts correct body and returns session data', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { sessionId: 'sess_123', url: 'https://stripe.com/pay/123' } } });

    const result = await createCheckoutSession('user@test.com', 'premium', 'monthly');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      { email: 'user@test.com', plan: 'premium', billing_cycle: 'monthly' }
    );
    expect(result.sessionId).toBe('sess_123');
    expect(result.url).toBe('https://stripe.com/pay/123');
  });

  it('uses default plan and billingCycle', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { sessionId: 'sess_456', url: 'https://stripe.com/456' } } });

    await createCheckoutSession('user@test.com');
    expect(mockApi.post).toHaveBeenCalledWith(expect.any(String), {
      email: 'user@test.com',
      plan: 'premium',
      billing_cycle: 'monthly',
    });
  });

  it('throws on error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Payment failed'));
    await expect(createCheckoutSession('user@test.com')).rejects.toThrow();
  });
});

describe('getSubscriptionStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  const fullData = {
    plan: 'premium',
    status: 'active',
    isPremium: true,
    isTrial: false,
    expiresAt: '2025-01-01',
    trialEndsAt: null,
    limits: { moodLogsPerDay: 99, chatMessagesPerDay: 999, historyDays: 365 },
    features: {
      voiceChat: true,
      sounds: true,
      analytics: true,
      insights: true,
      journal: true,
      gamification: true,
      social: true,
      export: true,
      aiStories: true,
      recommendations: true,
      wellness: true,
    },
    usage: { date: '2024-01-01', moodLogs: 5, chatMessages: 10 },
    name: 'Premium',
    price: 9.99,
    currency: 'SEK',
    interval: 'month',
  };

  it('returns full subscription status', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: fullData } });

    const result = await getSubscriptionStatus('user1');
    expect(result.plan).toBe('premium');
    expect(result.isPremium).toBe(true);
    expect(result.features.voiceChat).toBe(true);
  });

  it('defaults plan to free when missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getSubscriptionStatus('user1');
    expect(result.plan).toBe('free');
  });

  it('defaults status to inactive when missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getSubscriptionStatus('user1');
    expect(result.status).toBe('inactive');
  });

  it('defaults features to false when missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getSubscriptionStatus('user1');
    expect(result.features.voiceChat).toBe(false);
  });

  it('defaults limits when missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getSubscriptionStatus('user1');
    expect(result.limits.moodLogsPerDay).toBe(3);
    expect(result.limits.chatMessagesPerDay).toBe(10);
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getSubscriptionStatus('user1')).rejects.toThrow();
  });
});

describe('getAvailablePlans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns array directly when data.plans is an array', async () => {
    const plans = [{ id: 'free' }, { id: 'premium' }];
    mockApi.get.mockResolvedValueOnce({ data: { data: { plans } } });

    const result = await getAvailablePlans();
    expect(result).toEqual(plans);
  });

  it('converts object to array when no plans array', async () => {
    const data = {
      free: { name: 'Free', price: 0 },
      premium: { name: 'Premium', price: 9.99 },
    };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getAvailablePlans();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('free');
    expect(ids).toContain('premium');
  });

  it('returns plans from flat object when no plans key', async () => {
    const flatData = { free: { name: 'Free', price: 0 }, premium: { name: 'Premium', price: 9 } };
    mockApi.get.mockResolvedValueOnce({ data: { data: flatData } });

    const result = await getAvailablePlans();
    expect(result.length).toBe(2);
    expect(result.some((p) => p.id === 'free')).toBe(true);
    expect(result.some((p) => p.id === 'premium')).toBe(true);
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Server error'));
    await expect(getAvailablePlans()).rejects.toThrow();
  });
});

describe('purchaseCBTModule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts correct body and returns checkout session', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { sessionId: 'cbt_sess', url: 'https://stripe.com/cbt' } } });

    const result = await purchaseCBTModule('user@test.com', 'cbt-module-1');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      { email: 'user@test.com', module: 'cbt-module-1' }
    );
    expect(result.sessionId).toBe('cbt_sess');
  });

  it('throws on error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Payment failed'));
    await expect(purchaseCBTModule('user@test.com', 'mod')).rejects.toThrow();
  });
});

describe('getUserPurchases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns purchases list', async () => {
    const data = { purchases: [{ id: 'p1', module: 'cbt' }] };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getUserPurchases('user1');
    expect(result.purchases).toHaveLength(1);
  });

  it('defaults to empty purchases array when field missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    const result = await getUserPurchases('user1');
    expect(result.purchases).toEqual([]);
  });

  it('throws on error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getUserPurchases('user1')).rejects.toThrow();
  });
});

describe('cancelSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cancellation message', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { message: 'Prenumeration avbruten' } } });

    const result = await cancelSubscription('user1');
    expect(result.message).toBe('Prenumeration avbruten');
  });

  it('uses default message when response has no message', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: {} } });

    const result = await cancelSubscription('user1');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('throws on error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(cancelSubscription('user1')).rejects.toThrow();
  });
});
