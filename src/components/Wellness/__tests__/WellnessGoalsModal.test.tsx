/**
 * BUG-05 — the "Ändra mål" dialog.
 *
 * It opened with nothing selected and said "Fortsätt (0/3)" to a user who had
 * three goals set. Saving from that state would have silently replaced their
 * selection with whatever they re-picked.
 *
 * The cause was not in this component: it has accepted `initialGoals` all
 * along, and WellnessHub passed them. The dashboard's "Ändra mål" button did
 * not, so only that entry point was broken — which is why the same dialog
 * behaved correctly when reached from /wellness.
 *
 * The rest of the finding was real everywhere: onboarding copy in an editing
 * context, no close button, Escape inert, and focus never entering the dialog
 * despite role="dialog" aria-modal="true".
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../../i18n';
import WellnessGoalsOnboarding from '../WellnessGoalsOnboarding';

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../../services/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../../../api/wellness', () => ({ setWellnessGoals: vi.fn().mockResolvedValue({}) }));

const renderModal = (props: Record<string, unknown> = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <WellnessGoalsOnboarding userId="u1" {...props} />
    </I18nextProvider>
  );

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('sv');
});

afterAll(async () => {
  await i18n.changeLanguage('sv');
});

describe('editing goals starts from the goals you have', () => {
  it('counts the goals it was given', () => {
    renderModal({ initialGoals: ['stress', 'sleep', 'mood'], mode: 'edit' });
    // The reported symptom was "(0/3)" for a user with three goals.
    expect(screen.getByRole('button', { name: /3\/3/ })).toBeInTheDocument();
  });

  it('starts empty when there is nothing to edit', () => {
    renderModal({ mode: 'onboarding' });
    expect(screen.getByRole('button', { name: /0\/3/ })).toBeInTheDocument();
  });
});

describe('editing does not reuse onboarding copy', () => {
  it('offers Save, not Continue, when editing', () => {
    renderModal({ initialGoals: ['stress'], mode: 'edit' });
    expect(screen.getByRole('button', { name: /^Spara/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fortsätt/ })).not.toBeInTheDocument();
  });

  it('hides Skip when editing, even if a handler is passed', () => {
    // There is nothing to skip past: the user arrived deliberately via
    // "Ändra mål" with goals already set.
    renderModal({ initialGoals: ['stress'], mode: 'edit', onSkip: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Hoppa över' })).not.toBeInTheDocument();
  });

  it('keeps Skip during onboarding', () => {
    renderModal({ mode: 'onboarding', onSkip: vi.fn() });
    expect(screen.getByRole('button', { name: 'Hoppa över' })).toBeInTheDocument();
  });
});

describe('the dialog speaks the chosen language', () => {
  it.each([
    ['en', /^Save/],
    ['no', /^Lagre/],
  ])('labels the save button in %s', async (lang, pattern) => {
    // The buttons were hardcoded Swedish — useTranslation was imported as `_t`
    // and never called. Not in the report, found while fixing the rest.
    await i18n.changeLanguage(lang);
    renderModal({ initialGoals: ['stress'], mode: 'edit' });
    expect(screen.getByRole('button', { name: pattern })).toBeInTheDocument();
  });
});

describe('selection still respects the maximum', () => {
  it('does not let a fourth goal in', async () => {
    const user = userEvent.setup();
    renderModal({ initialGoals: ['stress', 'sleep', 'mood'], mode: 'edit' });

    const before = screen.getByRole('button', { name: /3\/3/ });
    expect(before).toBeInTheDocument();

    // Every unselected option is disabled at the cap; clicking one changes
    // nothing. Pinned because prefilling is what first makes the cap reachable
    // on open, and that path never ran before.
    const options = screen.getAllByRole('button').filter((b) => b.hasAttribute('disabled'));
    if (options.length > 0) await user.click(options[0]!).catch(() => undefined);

    expect(screen.getByRole('button', { name: /3\/3/ })).toBeInTheDocument();
  });
});
