import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MoodLogger from '../MoodLogger';

/**
 * MoodLogger is now a thin shim around SuperMoodLogger.
 * These tests verify the shim renders SuperMoodLogger correctly.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'sv' },
  }),
}));

vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: () => {},
    isReducedMotion: false,
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { user_id: 'test-user-123', email: 'test@example.com' },
    token: 'test-token',
  }),
}));

vi.mock('../../services/analytics', () => ({
  analytics: {
    track: () => {},
    identify: () => {},
    page: () => {},
  },
}));

vi.mock('../../services/offlineStorage', () => ({
  default: {
    addOfflineMoodLog: () => {},
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
  },
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    subscription: { plan: 'free' },
    isSubscribed: false,
    checkUsageLimit: () => true,
    canLogMood: () => true,
    canSendMessage: () => true,
    incrementMoodLog: () => {},
    incrementChatMessage: () => {},
    getRemainingMoodLogs: () => 10,
    getRemainingMessages: () => 10,
    plan: {
      tier: 'free',
      limits: { moodLogsPerDay: 5, chatMessagesPerDay: 10, memoriesPerDay: 3 },
      features: {
        voiceInput: false,
        aiChat: false,
        analytics: false,
        export: false,
        themes: false,
        prioritySupport: false,
      },
      name: 'Free',
      price: 0,
      currency: 'SEK',
      interval: 'month',
    },
    refreshSubscription: () => Promise.resolve(),
    hasFeature: () => true,
    usage: { moodLogs: 0, chatMessages: 0, lastResetDate: '' },
    loading: false,
    isPremium: false,
    isTrial: false,
  }),
}));

vi.mock('../../api/api', () => ({
  logMood: () => Promise.resolve({ data: { success: true } }),
  getMoods: () => Promise.resolve([]),
  API_BASE_URL: 'http://localhost:5001',
  default: { post: () => Promise.resolve({}), get: () => Promise.resolve({}) },
}));

vi.mock('../../config/env', () => ({
  getBackendUrl: () => 'http://localhost:5001',
}));

vi.mock('axios', () => {
  const mockInstance = {
    get: () => Promise.resolve({ data: {} }),
    post: () => Promise.resolve({ data: {} }),
    put: () => Promise.resolve({ data: {} }),
    delete: () => Promise.resolve({ data: {} }),
    patch: () => Promise.resolve({ data: {} }),
    interceptors: {
      request: { use: () => {}, eject: () => {} },
      response: { use: () => {}, eject: () => {} },
    },
  };
  return {
    default: {
      create: () => mockInstance,
      ...mockInstance,
    },
  };
});

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function renderMoodLogger(props: Partial<React.ComponentProps<typeof MoodLogger>> = {}) {
  let result: ReturnType<typeof render>;
  act(() => {
    result = render(
      <BrowserRouter future={routerFutureFlags}>
        <MoodLogger {...props} />
      </BrowserRouter>,
    );
  });
  return result!;
}

describe('MoodLogger (deprecated shim)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders SuperMoodLogger (delegates mood logging)', () => {
    renderMoodLogger();
    // SuperMoodLogger renders the circumplex mood selector
    // Verify it renders without crashing
    expect(screen.getByText(/humör/i)).toBeInTheDocument();
  });

  test('renders with onMoodLogged callback', () => {
    const onMoodLogged = vi.fn();
    renderMoodLogger({ onMoodLogged });
    expect(screen.getByText(/humör/i)).toBeInTheDocument();
  });
});
