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
 * The first fix filled the hamburger with every route, which left two menus on
 * the same phone screen (the drawer and the bottom bar's "Utforska" sheet) that
 * disagreed with each other. The bottom bar is now the only mobile navigation
 * for signed-in users, so these tests hold it to the property: every route the
 * sidebar links to is in the bar or the sheet.
 *
 * They assert the property rather than a list, so a route added to the sidebar
 * in future is covered without editing this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../../i18n';
import BottomNav from '../BottomNav';
import { FREE_NAV_ITEMS, PREMIUM_NAV_ITEMS, SECONDARY_LINKS } from '../../../config/navItems';

const subscription = { isPremium: false, isTrial: false };
vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => subscription,
}));

const renderBottomNav = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    </I18nextProvider>
  );

const openExplore = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: i18n.t('bottomNav.explore', 'Utforska') }));
  return user;
};

/** Paths reachable from the bar itself or from links and tiles in the sheet. */
const reachablePaths = () => {
  const sheet = screen.getByRole('dialog');
  const links = Array.from(sheet.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'));
  return { links, sheet };
};

beforeEach(async () => {
  subscription.isPremium = false;
  subscription.isTrial = false;
  await i18n.changeLanguage('sv');
});

describe('the bottom bar and its "Utforska" sheet carry the sidebar navigation', () => {
  it('links to /crisis', async () => {
    // The single most important one, asserted on its own so a failure names it.
    renderBottomNav();
    await openExplore();
    expect(reachablePaths().links).toContain('/crisis');
  });

  it('reaches every route the sidebar does', async () => {
    renderBottomNav();
    await openExplore();

    const { links, sheet } = reachablePaths();
    const tileLabels = Array.from(sheet.querySelectorAll('button[aria-label]'))
      .map((b) => b.getAttribute('aria-label'));
    const barLabels = ['Hem', 'Humör', 'AI', 'Profil'];
    const barPaths = ['/dashboard', '/mood-basic', '/ai-chat', '/profile'];

    const missing = [...FREE_NAV_ITEMS, ...PREMIUM_NAV_ITEMS, ...SECONDARY_LINKS].filter(
      (item) =>
        !barPaths.includes(item.path) &&
        !links.includes(item.path) &&
        !tileLabels.includes(i18n.t(item.labelKey, item.labelDefault)),
    ).map((item) => item.path);

    expect(missing).toEqual([]);
    expect(barLabels.every((name) => screen.getByRole('button', { name }))).toBe(true);
  });

  it('lists no route twice', async () => {
    renderBottomNav();
    await openExplore();

    const { links, sheet } = reachablePaths();
    const tileLabels = Array.from(sheet.querySelectorAll('button[aria-label]'))
      .map((b) => b.getAttribute('aria-label'))
      .filter((label) => label !== i18n.t('common.close', 'Stäng'));
    const all = [...links.filter((href) => href !== '/upgrade'), ...tileLabels];

    expect(all.length).toBe(new Set(all).size);
    // Nothing in the sheet repeats a bottom-bar destination.
    expect(tileLabels).not.toContain(i18n.t('sidebar.home', 'Hem'));
    expect(links).not.toContain('/dashboard');
  });

  it('closes itself when a link is followed', async () => {
    // Otherwise the sheet covers the page it just navigated to.
    renderBottomNav();
    const user = await openExplore();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const crisis = screen.getByRole('dialog').querySelector('a[href="/crisis"]');
    await user.click(crisis as Element);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('trial accounts (UI audit Dup-11)', () => {
  it('see no PRO badges and no upgrade prompt, since a trial unlocks everything', async () => {
    subscription.isTrial = true;
    renderBottomNav();
    await openExplore();

    const sheet = screen.getByRole('dialog');
    expect(sheet.textContent).not.toContain('PRO');
    expect(sheet.querySelector('a[href="/upgrade"]')).toBeNull();
  });

  it('free accounts still see them', async () => {
    renderBottomNav();
    await openExplore();

    const sheet = screen.getByRole('dialog');
    expect(sheet.textContent).toContain('PRO');
    expect(sheet.querySelector('a[href="/upgrade"]')).not.toBeNull();
  });
});
