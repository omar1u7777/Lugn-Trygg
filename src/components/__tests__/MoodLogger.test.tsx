import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MoodLogger from '../MoodLogger';

// ── Mocks (use plain functions inside factories to avoid vi.fn() hoisting issues) ──

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

// Mock UsageLimitBanner so we don't pull in its own complex deps (Link, heroicons, etc.)
vi.mock('../UsageLimitBanner', () => ({
  UsageLimitBanner: () => <div data-testid="usage-limit-banner">UsageLimitBanner</div>,
}));

// ── Helper ──

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

// ── Tests ──

describe('MoodLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the heading', () => {
    renderMoodLogger();
    expect(screen.getByText('Hur känns det idag?')).toBeInTheDocument();
  });

  test('renders all six mood emojis', () => {
    renderMoodLogger();

    const emojis = ['😢', '😟', '😐', '🙂', '😊', '🤩'];
    for (const emoji of emojis) {
      expect(screen.getByText(emoji)).toBeInTheDocument();
    }
  });

  test('renders mood labels', () => {
    renderMoodLogger();

    const labels = ['Ledsen', 'Orolig', 'Neutral', 'Bra', 'Glad', 'Super'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  test('selects a mood when clicking an emoji button', () => {
    renderMoodLogger();

    const gladButton = screen.getByLabelText(/Glad/);
    fireEvent.click(gladButton);

    expect(screen.getByText(/Valt humör: Glad/)).toBeInTheDocument();
  });

  test('shows note textarea after selecting a mood', () => {
    renderMoodLogger();

    // No textarea initially
    expect(screen.queryByPlaceholderText(/Vad får dig att känna/)).not.toBeInTheDocument();

    // Select a mood
    const neutralButton = screen.getByLabelText(/Neutral/);
    fireEvent.click(neutralButton);

    // Textarea should appear
    expect(screen.getByPlaceholderText(/Vad får dig att känna/)).toBeInTheDocument();
  });

  test('shows log button after selecting a mood', () => {
    renderMoodLogger();

    // No log button initially
    expect(screen.queryByText('Logga humör')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Bra/));

    expect(screen.getByText('Logga humör')).toBeInTheDocument();
  });

  test('does not show a back button when no mood is selected', () => {
    const onMoodLogged = vi.fn();
    renderMoodLogger({ onMoodLogged });

    // No standalone back button — onMoodLogged is invoked after successful log, not via extra button
    expect(screen.queryByText('Tillbaka till Dashboard')).not.toBeInTheDocument();
  });

  test('renders usage limit banner', () => {
    renderMoodLogger();
    expect(screen.getByTestId('usage-limit-banner')).toBeInTheDocument();
  });

  test('does not show stale empty-moods message on initial render', () => {
    renderMoodLogger();
    // Component no longer renders a misleading persistent "no moods" message
    expect(screen.queryByText('Inga humör loggade ännu')).not.toBeInTheDocument();
  });

  test('typing in note textarea updates character count', () => {
    renderMoodLogger();
    fireEvent.click(screen.getByLabelText(/Super/));

    const textarea = screen.getByPlaceholderText(/Vad får dig att känna/);
    fireEvent.change(textarea, { target: { value: 'Bra dag!' } });

    expect(screen.getByText('8/200 tecken')).toBeInTheDocument();
  });
});
