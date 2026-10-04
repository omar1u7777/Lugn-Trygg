/**
 * BUG-03 — deleting a mood entry from "Dina senaste humör".
 *
 * The report says the trash icon deletes immediately, with "ingen dialog, ingen
 * toast, ingen ångra-möjlighet". Two thirds of that does not match the code.
 *
 * A window.confirm guard has been in handleDeleteMood since 2026-08-04, three
 * weeks before the QA pass, and a successful delete announces itself to screen
 * readers. Browser automation auto-accepts window.confirm, which is almost
 * certainly why the tester saw an immediate deletion — the dialog opened and
 * was dismissed before it could be observed.
 *
 * The touch target was real: a 14px icon in 4px of padding is 22x22, half the
 * WCAG 2.5.5 minimum, on a control that permanently destroys data.
 *
 * These pin the guard so that an automation artefact does not lead someone to
 * "fix" it by removing what is already there.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string | { defaultValue?: string }) =>
    typeof fallback === 'string' ? fallback : key;
  return { useTranslation: () => ({ t, i18n: { language: 'sv' } }) };
});
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../services/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({ announceToScreenReader: vi.fn() }),
}));
vi.mock('../../features/mood/utils', () => ({ getMoodLabel: (s: number) => String(s) }));
vi.mock('../mood/CircumplexSliders', () => ({ CircumplexSliders: () => <div /> }));
vi.mock('../mood/TagSelector', () => ({ TagSelector: () => <div /> }));
vi.mock('../ui/tailwind', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../api/client', () => ({ api: { post: vi.fn() } }));
vi.mock('../../api/constants', () => ({ API_ENDPOINTS: { MOOD: { LOG_MOOD: '/x' } } }));

const { getMoodsMock, deleteMoodMock } = vi.hoisted(() => ({
  getMoodsMock: vi.fn(),
  deleteMoodMock: vi.fn(),
}));
vi.mock('../../api/api', () => ({
  logMood: vi.fn(),
  getMoods: getMoodsMock,
  deleteMood: deleteMoodMock,
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'u1', email: 'a@b.se' } }),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    canLogMood: () => true,
    incrementMoodLog: vi.fn(),
    plan: { tier: 'free', limits: {} },
  }),
}));

import { SuperMoodLogger } from '../SuperMoodLogger';

const MOOD = {
  id: 'mood-1', score: 7, timestamp: new Date().toISOString(),
  note: 'En anteckning', tags: ['work'],
};

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  getMoodsMock.mockResolvedValue([MOOD]);
  deleteMoodMock.mockResolvedValue(undefined);
});

afterEach(() => {
  confirmSpy?.mockRestore();
});

const renderAndFindDelete = async () => {
  render(<SuperMoodLogger showRecentMoods />);
  return waitFor(() => screen.getByRole('button', { name: 'Radera' }));
};

describe('deleting a mood entry asks first', () => {
  it('does not delete when the confirmation is declined', async () => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const button = await renderAndFindDelete();

    await act(async () => { button.click(); });

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteMoodMock).not.toHaveBeenCalled();
  });

  it('deletes only after the confirmation is accepted', async () => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const button = await renderAndFindDelete();

    await act(async () => { button.click(); });

    await waitFor(() => expect(deleteMoodMock).toHaveBeenCalledWith('mood-1'));
  });

  it('warns that the deletion cannot be undone', async () => {
    // There is no undo. The wording is the only thing standing between a
    // misplaced tap and permanent data loss, so it is worth pinning.
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const button = await renderAndFindDelete();

    await act(async () => { button.click(); });

    expect(String(confirmSpy.mock.calls[0]?.[0])).toMatch(/inte att ångra/i);
  });
});

describe('the delete control is large enough to hit on purpose', () => {
  it('reserves a 44x44 target around the icon', async () => {
    // WCAG 2.5.5. jsdom does not evaluate Tailwind, so this asserts the classes
    // that produce the size rather than the computed box.
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const button = await renderAndFindDelete();

    expect(button.className).toContain('min-w-[44px]');
    expect(button.className).toContain('min-h-[44px]');
  });
});
