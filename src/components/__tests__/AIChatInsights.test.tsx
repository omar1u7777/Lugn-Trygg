import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, f?: unknown) => (typeof f === 'string' ? f : k) }),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'user-1' }, isLoggedIn: true }),
}));

vi.mock('@/api/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { AIChatInsights } from '../AIChatInsights';
import api from '@/api/api';

const frameworkPayload = {
  data: { success: true, data: { framework: 'cognitive_behavioral_therapy', confidence: 0.8, techniques: [] } },
};
const qualityPayload = {
  data: {
    success: true,
    data: {
      metrics: {
        empathy_score: 0.8,
        specificity_score: 0.7,
        collaboration_score: 0.6,
        structure_score: 0.6,
        overall_quality: 0.75,
        safety_assessment: 0.9,
        goal_alignment: 0.7,
      },
    },
  },
};
const progressPayload = {
  data: { success: true, data: { status: 'insufficient_data', sessions_available: 1, sessions_needed: 3 } },
};

const mockEndpoints = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url in overrides) return overrides[url] as never;
    if (url.endsWith('/framework')) return Promise.resolve(frameworkPayload) as never;
    if (url.endsWith('/quality')) return Promise.resolve(qualityPayload) as never;
    return Promise.resolve(progressPayload) as never;
  });
};

describe('AIChatInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the framework analysis when its request succeeds', async () => {
    mockEndpoints();

    render(<AIChatInsights />);

    await waitFor(() => {
      expect(screen.getByText('KBT (Kognitiv Beteendeterapi)')).toBeInTheDocument();
    });
    expect(screen.queryByText('Den här analysen kunde inte hämtas.')).not.toBeInTheDocument();
  });

  it('says the analysis could not be fetched instead of leaving the tab blank', async () => {
    // Each tab renders only when its own data arrived, so one rejected call
    // left an empty panel — indistinguishable from having no insights yet.
    mockEndpoints({ '/chatbot/analysis/framework': Promise.reject(new Error('upstream down')) });

    render(<AIChatInsights />);

    expect(await screen.findByText('Den här analysen kunde inte hämtas.')).toBeInTheDocument();
    expect(screen.getByText(/vi nådde bara inte analysen/)).toBeInTheDocument();
  });

  it('keeps the tabs that did load usable when another one fails', async () => {
    mockEndpoints({ '/chatbot/analysis/framework': Promise.reject(new Error('upstream down')) });

    render(<AIChatInsights />);

    await screen.findByText('Den här analysen kunde inte hämtas.');
    await userEvent.click(screen.getByText('Kvalitetsmått'));

    await waitFor(() => {
      expect(screen.getByText('Övergripande kvalitet')).toBeInTheDocument();
    });
    expect(screen.queryByText('Den här analysen kunde inte hämtas.')).not.toBeInTheDocument();
  });

  it('treats an unsuccessful response body as a failure, not as empty insights', async () => {
    mockEndpoints({
      '/chatbot/analysis/framework': Promise.resolve({ data: { success: false, data: null } }),
    });

    render(<AIChatInsights />);

    expect(await screen.findByText('Den här analysen kunde inte hämtas.')).toBeInTheDocument();
  });
});
