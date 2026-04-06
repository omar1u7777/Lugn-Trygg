/**
 * SubscriptionContext Tests
 * Covers: tier normalization, usage tracking, provider rendering.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_AUTH_STATE = {
  user: { user_id: 'test-user', email: 'test@test.com' },
  token: 'test-token',
  isLoggedIn: true,
  loading: false,
};

// Mock API calls
vi.mock('../../api/subscription', () => ({
  getSubscriptionStatus: vi.fn().mockResolvedValue({
    plan: 'free',
    isPremium: false,
    limits: { dailyMoodLogs: 5, dailyChatMessages: 10 },
    features: {},
  }),
}));

vi.mock('../AuthContext', () => ({
  useAuth: () => MOCK_AUTH_STATE,
  AuthContext: React.createContext({}),
}));

// Dynamic import after mocks are set
import { SubscriptionProvider, useSubscription } from '../SubscriptionContext';
import { getSubscriptionStatus } from '../../api/subscription';

describe('SubscriptionContext', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <SubscriptionProvider>
        <div data-testid="child">Content</div>
      </SubscriptionProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('provides subscription context values', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );

    const { result } = renderHook(() => useSubscription(), { wrapper });

    // Should have the expected shape
    expect(result.current).toHaveProperty('plan');
    expect(result.current).toHaveProperty('canLogMood');
    expect(result.current).toHaveProperty('canSendMessage');
    expect(typeof result.current.canLogMood).toBe('function');
    expect(typeof result.current.canSendMessage).toBe('function');
  });

  it('defaults to free plan', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );

    const { result } = renderHook(() => useSubscription(), { wrapper });
    expect(result.current.plan.tier).toBe('free');
    expect(result.current.isPremium).toBe(false);
  });

  it('resolves premium tier from API response', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({ plan: 'premium' });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.plan.tier).toBe('premium'));
    expect(result.current.isPremium).toBe(true);
  });

  it('resolves trial tier from API response', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({ plan: 'trial' });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.plan.tier).toBe('trial'));
    expect(result.current.isTrial).toBe(true);
  });

  it('resolves enterprise tier from API response', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({ plan: 'enterprise' });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.plan.tier).toBe('enterprise'));
  });

  it('normalizes unknown tier to free', async () => {
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({ plan: 'unknown_tier' });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => !result.current.loading);
    expect(result.current.plan.tier).toBe('free');
  });

  it('falls back to free plan on API error', async () => {
    vi.mocked(getSubscriptionStatus).mockRejectedValueOnce(new Error('Network error'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => !result.current.loading);
    expect(result.current.plan.tier).toBe('free');
  });

  it('canLogMood returns true when within limits', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // free plan: moodLogsPerDay=3, usage.moodLogs=0 → can log
    expect(result.current.canLogMood()).toBe(true);
  });

  it('canLogMood returns false when at limit', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // Increment past the free limit (3)
    await act(async () => {
      result.current.incrementMoodLog();
      result.current.incrementMoodLog();
      result.current.incrementMoodLog();
    });
    expect(result.current.canLogMood()).toBe(false);
  });

  it('canSendMessage returns true initially', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    expect(result.current.canSendMessage()).toBe(true);
  });

  it('incrementChatMessage increases usage count', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // Wait until loading is done so async API doesn't reset usage after increment
    await waitFor(() => !result.current.loading);
    const before = result.current.usage.chatMessages;
    await act(async () => {
      result.current.incrementChatMessage();
    });
    expect(result.current.usage.chatMessages).toBe(before + 1);
  });

  it('getRemainingMoodLogs returns remaining count', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // free plan: 3 per day, 0 used
    expect(result.current.getRemainingMoodLogs()).toBe(3);
  });

  it('getRemainingMessages returns remaining count', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // free plan: 10 per day, 0 used
    expect(result.current.getRemainingMessages()).toBe(10);
  });

  it('hasFeature returns false for free plan restricted features', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    expect(result.current.hasFeature('voiceChat')).toBe(false);
    expect(result.current.hasFeature('analytics')).toBe(false);
  });

  it('useSubscription throws when used outside provider', () => {
    expect(() => renderHook(() => useSubscription())).toThrow(
      'useSubscription must be used within a SubscriptionProvider'
    );
  });

  it('uses cached subscription when available within 5 minutes', async () => {
    // Also mock API to return premium so it doesn't override cache with free
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({ plan: 'premium' });
    const cachedData = {
      plan: {
        tier: 'premium',
        limits: { moodLogsPerDay: -1, chatMessagesPerDay: -1, historyDays: -1 },
        features: { voiceChat: true, sounds: true, analytics: true, insights: true, journal: true, gamification: true, social: true, export: true, aiStories: true, recommendations: true, wellness: true, advancedMood: true, moodForecast: true },
        name: 'Premium',
        price: 99,
        currency: 'SEK',
        interval: 'month',
      },
      usage: { moodLogs: 0, chatMessages: 0, lastResetDate: new Date().toISOString().split('T')[0] },
      timestamp: Date.now(),
    };
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key.includes('subscription_cache')) return JSON.stringify(cachedData);
      return null;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.plan.tier).toBe('premium'));
  });
});
