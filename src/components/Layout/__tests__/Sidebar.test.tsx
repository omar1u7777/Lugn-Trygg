import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Sidebar', () => {
  beforeEach(() => {
    mockUseSubscription.mockReset();
  });

  it('renders main navigation links and marks active route', () => {
    mockUseSubscription.mockReturnValue({ isPremium: false });
    renderSidebar('/dashboard');

    expect(screen.getByRole('link', { name: 'Hem' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Humör' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'AI Stöd' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rekommendationer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profil' })).toBeTruthy();
  });

  it('shows upgrade card for free users', () => {
    mockUseSubscription.mockReturnValue({ isPremium: false });
    renderSidebar();

    expect(screen.getByText('Uppgradera')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se Premium →' })).toBeTruthy();
  });

  it('hides upgrade card for premium users', () => {
    mockUseSubscription.mockReturnValue({ isPremium: true });
    renderSidebar();

    expect(screen.queryByText('Uppgradera')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Se Premium →' })).toBeNull();
  });
});
