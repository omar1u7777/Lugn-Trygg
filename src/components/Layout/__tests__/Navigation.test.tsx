import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const mockUseSubscription = vi.fn();

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    logout: vi.fn(),
    user: { email: 'test@example.com' },
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  __esModule: true,
  default: () => <div data-testid="language-switcher" />,
}));

describe('Navigation', () => {
  beforeEach(() => {
    mockUseSubscription.mockReset();
  });

  const renderNavigation = () =>
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navigation />
      </MemoryRouter>
    );

  it('hides premium links for free plans', () => {
    mockUseSubscription.mockReturnValue({
      plan: { tier: 'free' },
      loading: false,
      hasFeature: () => false,
    });

    renderNavigation();

    expect(screen.getByText('Översikt')).toBeInTheDocument();
    expect(screen.queryByText('Välmående')).toBeNull();
    expect(screen.queryByText('Insikter')).toBeNull();
  });

  it('shows premium links when features unlocked', () => {
    mockUseSubscription.mockReturnValue({
      plan: { tier: 'premium' },
      loading: false,
      hasFeature: () => true,
    });

    renderNavigation();

    expect(screen.getByText('Välmående')).toBeInTheDocument();
    expect(screen.getByText('Insikter')).toBeInTheDocument();
  });
});
