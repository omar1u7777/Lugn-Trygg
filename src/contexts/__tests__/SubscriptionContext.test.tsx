/**
 * SubscriptionContext Tests
 * Covers: tier normalization, usage tracking, provider rendering.
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
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
});
