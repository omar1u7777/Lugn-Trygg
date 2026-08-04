import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('DailyInsights retry lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.changeLanguage('sv');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-enables the retry button after a cooldown instead of disabling it forever', async () => {
    vi.mocked(getPendingInsights).mockRejectedValue(new Error('network down'));

    renderP(<DailyInsights userId="u" />);

    // Initial load already counts as the first failure (retryCount=1);
    // two more retry clicks reach MAX_RETRIES=3.
    for (let i = 0; i < 2; i++) {
      await waitFor(() => expect(screen.getByText('Försök igen')).toBeInTheDocument());
      await act(async () => {
        await userEvent.click(screen.getByText('Försök igen'), { delay: null });
      });
    }

    // Button is now disabled with the "try later" label
    const laterButton = await screen.findByText('Försök igen senare');
    expect(laterButton).toBeDisabled();

    // After the cooldown elapses, the button re-enables itself with no
    // further user action -- previously this was a permanent dead end.
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await waitFor(() => expect(screen.getByText('Försök igen')).not.toBeDisabled());
  });
});

describe('DailyInsights per-user generate cooldown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.changeLanguage('sv');
  });

  it('does not let one user\'s generate cooldown block a different user on the same browser', async () => {
    vi.mocked(getPendingInsights).mockResolvedValue([]);
    vi.mocked(generateInsights).mockResolvedValue([mkInsight('mindfulness')]);

    const { unmount } = renderP(<DailyInsights userId="user-a" />);
    await waitFor(() => expect(generateInsights).toHaveBeenCalledWith('user-a', expect.anything()));
    unmount();

    vi.mocked(generateInsights).mockClear();
    vi.mocked(getPendingInsights).mockResolvedValue([]);

    // A different user, same browser/localStorage, right after user-a's
    // generate call -- must still be allowed to generate, not silently
    // suppressed by user-a's cooldown timestamp under a shared cache key.
    renderP(<DailyInsights userId="user-b" />);
    await waitFor(() => expect(generateInsights).toHaveBeenCalledWith('user-b', expect.anything()));
  });
});
