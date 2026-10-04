/**
 * The sidebar is `hidden lg:flex`. Below 1024px it is not rendered at all, and
 * the hamburger menu held only an /upgrade link and the profile dropdown — so
 * eight routes had no reachable entry point on a phone:
 *
 *   /analytics  /crisis  /feedback  /integrations
 *   /mood/advanced  /mood/forecast  /referral  /weekly-analysis
 *
 * /crisis is what makes that a defect rather than an inconvenience: a page
 * whose entire purpose is fast access in an emergency, reachable only by typing
 * the URL, on the device most people would be holding.
 *
 * These assert the property rather than a list, so a route added to the sidebar
 * in future is covered without editing this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../../i18n';
import Navigation from '../Navigation';
import { FREE_NAV_ITEMS, PREMIUM_NAV_ITEMS, SECONDARY_LINKS } from '../../../config/navItems';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true, user: { user_id: 'u1', email: 'a@b.se' }, logout: vi.fn() }),
}));
vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: vi.fn() }),
}));
vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    isPremium: false,
    isLoading: false,
    plan: { tier: 'free' },
    subscription: { tier: 'free' },
  }),
}));
vi.mock('../../../utils/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn() } }));

const renderNav = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    </I18nextProvider>
  );

const openMenu = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: i18n.t('navigation.openMenu') }));
  return user;
};

const hrefsInMenu = () =>
  Array.from(document.querySelectorAll('[role="dialog"] a[href]'))
    .map((a) => a.getAttribute('href'));

beforeEach(async () => {
  await i18n.changeLanguage('sv');
});

describe('the hamburger menu carries the sidebar navigation', () => {
  it('links to /crisis', async () => {
    // The single most important one, asserted on its own so a failure names it.
    renderNav();
    await openMenu();
    expect(hrefsInMenu()).toContain('/crisis');
  });

  it('links to every route the sidebar does', async () => {
    renderNav();
    await openMenu();

    const menu = hrefsInMenu();
    const sidebarPaths = [
      ...FREE_NAV_ITEMS,
      ...PREMIUM_NAV_ITEMS,
      ...SECONDARY_LINKS,
    ].map((i) => i.path);

    const missing = sidebarPaths.filter((p) => !menu.includes(p));
    expect(missing).toEqual([]);
  });

  it('closes itself when a link is followed', async () => {
    // Otherwise the panel covers the page it just navigated to.
    renderNav();
    const user = await openMenu();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const crisis = Array.from(document.querySelectorAll('[role="dialog"] a[href="/crisis"]'))[0];
    await user.click(crisis as Element);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
