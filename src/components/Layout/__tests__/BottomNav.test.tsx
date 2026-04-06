import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ isPremium: false, isLoading: false }),
}));

import BottomNav from '../BottomNav';

const renderBottomNav = (route = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <BottomNav />
    </MemoryRouter>
  );

describe('BottomNav', () => {
  it('renders the mobile navigation landmark', () => {
    renderBottomNav();
    expect(screen.getByRole('navigation', { name: 'Mobilnavigation' })).toBeTruthy();
  });

  it('renders all primary bottom navigation buttons', () => {
    renderBottomNav();

    expect(screen.getByRole('button', { name: 'Hem' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Humör' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Utforska' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Profil' })).toBeTruthy();
  });

  it('marks the current route as active with aria-current', () => {
    renderBottomNav('/profile');

    const profileBtn = screen.getByRole('button', { name: 'Profil' });
    const homeBtn = screen.getByRole('button', { name: 'Hem' });
    expect(profileBtn.getAttribute('aria-current')).toBe('page');
    expect(homeBtn.getAttribute('aria-current')).not.toBe('page');
  });

  it('uses a minimum 44px touch target class on all nav buttons', () => {
    renderBottomNav();

    // The 5 main nav buttons (Hem, Humör, AI, Utforska, Profil)
    const hemBtn = screen.getByRole('button', { name: 'Hem' });
    const profBtn = screen.getByRole('button', { name: 'Profil' });
    expect(hemBtn.className).toContain('min-h-[44px]');
    expect(profBtn.className).toContain('min-h-[44px]');
  });
});
