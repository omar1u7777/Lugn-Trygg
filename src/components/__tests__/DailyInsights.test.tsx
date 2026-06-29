import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import DailyInsights from '../DailyInsights';

vi.mock('../../api/insights', () => ({
  generateInsights: vi.fn(),
  getPendingInsights: vi.fn(),
  dismissInsight: vi.fn(),
  markInsightActionTaken: vi.fn(),
}));
vi.mock('../../services/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn() } }));

import { generateInsights, getPendingInsights, markInsightActionTaken } from '../../api/insights';

const renderP = (c: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter>{c}</MemoryRouter></I18nextProvider>);

const mkInsight = (d: string) => ({
  insight_id: 'i1', user_id: 'u', insight_type: 'opportunity', domain: d,
  title: 'T', message: 'M', recommendation: 'R', evidence: {}, urgency: 'low' as const,
  suggested_action: 'Do thing', related_memories: [], values_alignment: null,
  behavioral_target: null, created_at: new Date().toISOString(), status: 'pending' as const,
});

describe('DailyInsights i18n (#1-3)', () => {
  beforeEach(() => { vi.clearAllMocks(); i18n.changeLanguage('sv'); });

  it('#1 minMoodsRequired is translated', async () => {
    vi.mocked(getPendingInsights).mockResolvedValue([]);
    vi.mocked(generateInsights).mockResolvedValue([]);
    renderP(<DailyInsights userId="u" />);
    await waitFor(() => expect(screen.getByText(/Minst 3 mood-loggar/)).toBeInTheDocument());
    await act(async () => { i18n.changeLanguage('en'); });
    await waitFor(() => expect(screen.getByText(/At least 3 mood logs/)).toBeInTheDocument());
  });

  it('#2 domain labels are translated', async () => {
    vi.mocked(getPendingInsights).mockResolvedValue([mkInsight('behavioral_activation')]);
    renderP(<DailyInsights userId="u" />);
    await waitFor(() => expect(screen.getByText('Beteendeaktivering')).toBeInTheDocument());
    await act(async () => { i18n.changeLanguage('en'); });
    await waitFor(() => expect(screen.getByText('Behavioral Activation')).toBeInTheDocument());
  });

  it('#3 Klart and Stäng are translated', async () => {
    vi.mocked(getPendingInsights).mockResolvedValue([mkInsight('mindfulness')]);
    vi.mocked(markInsightActionTaken).mockResolvedValue(undefined);
    renderP(<DailyInsights userId="u" />);
    await waitFor(() => expect(screen.getByText('Do thing')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Do thing'));
    await waitFor(() => expect(screen.getByText('Klart!')).toBeInTheDocument());
    expect(screen.getByLabelText('Stäng')).toBeInTheDocument();
    await act(async () => { i18n.changeLanguage('en'); });
    await waitFor(() => expect(screen.getByLabelText('Close')).toBeInTheDocument());
  });
});
