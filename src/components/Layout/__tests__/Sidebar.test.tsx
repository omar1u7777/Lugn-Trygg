import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

const mockUseSubscription = vi.fn();

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
}));

const renderSidebar = (route = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar />
    </MemoryRouter>
  );

describe('Sidebar', { timeout: 20000 }, () => {
  beforeEach(() => {
    mockUseSubscription.mockReset();
  });

  it('renders main navigation links and marks active route', () => {
    mockUseSubscription.mockReturnValue({ isPremium: false });
    const { container } = renderSidebar('/dashboard');

    const dashboardLink = container.querySelector('a[href="/dashboard"]');
    expect(dashboardLink?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('a[href="/mood-basic"]')).toBeTruthy();
    expect(container.querySelector('a[href="/ai-chat"]')).toBeTruthy();
    expect(container.querySelector('a[href="/profile"]')).toBeTruthy();
  });

  it('links to the crisis support page for free users', () => {
    // /crisis was a registered route that nothing in the UI linked to, so
    // the crisis resources (Sjalvmordslinjen, BRIS, 1177) were reachable
    // only by typing the URL. It must stay reachable, and on the free plan.
    mockUseSubscription.mockReturnValue({ isPremium: false });
    const { container } = renderSidebar('/dashboard');

    expect(container.querySelector('a[href="/crisis"]')).toBeTruthy();
  });

  it('shows upgrade card for free users', () => {
    mockUseSubscription.mockReturnValue({ isPremium: false });
    const { container } = renderSidebar();

    expect(container.textContent).toContain('Uppgradera');
    expect(container.querySelector('a[href="/upgrade"]')).toBeTruthy();
  });

  it('hides upgrade card for premium users', () => {
    mockUseSubscription.mockReturnValue({ isPremium: true });
    const { container } = renderSidebar();

    expect(container.textContent).not.toContain('Uppgradera');
    expect(container.querySelector('a[href="/upgrade"]')).toBeNull();
  });
});
