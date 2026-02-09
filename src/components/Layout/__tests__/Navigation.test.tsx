import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const mockLogout = vi.fn();
const mockToggleTheme = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSubscription = vi.fn();

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    toggleTheme: mockToggleTheme,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.login': 'Logga in',
        'auth.register': 'Registrera',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  __esModule: true,
  default: () => <div data-testid="language-switcher" />,
}));

describe('Navigation', () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockToggleTheme.mockReset();
    mockUseAuth.mockReset();
    mockUseSubscription.mockReset();
  });

  const renderNavigation = (route = '/dashboard') =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <Navigation />
      </MemoryRouter>
    );

  describe('when logged in (free plan)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isLoggedIn: true,
        logout: mockLogout,
        user: { email: 'test@example.com' },
      });
      mockUseSubscription.mockReturnValue({
        plan: { tier: 'free' },
        loading: false,
      });
    });

    it('renders navigation landmark', () => {
      renderNavigation();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders the brand text "Lugn & Trygg"', () => {
      renderNavigation();
      expect(screen.getByText('Lugn & Trygg')).toBeInTheDocument();
    });

    it('renders a logout button', () => {
      renderNavigation();
      const logoutButton = screen.getByTitle('Logga ut');
      expect(logoutButton).toBeInTheDocument();
    });

    it('calls logout when logout button is clicked', () => {
      renderNavigation();
      const logoutButton = screen.getByTitle('Logga ut');
      fireEvent.click(logoutButton);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('renders theme toggle button', () => {
      renderNavigation();
      const themeButton = screen.getByLabelText('Byt till mörkt läge');
      expect(themeButton).toBeInTheDocument();
    });

    it('calls toggleTheme when theme button is clicked', () => {
      renderNavigation();
      const themeButton = screen.getByLabelText('Byt till mörkt läge');
      fireEvent.click(themeButton);
      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('renders language switcher', () => {
      renderNavigation();
      expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
    });

    it('shows upgrade link for free users', () => {
      renderNavigation();
      expect(screen.getByLabelText('Uppgradera till premium')).toBeInTheDocument();
    });

    it('does not show premium badge for free users', () => {
      renderNavigation();
      expect(screen.queryByText('Premium')).toBeNull();
    });
  });

  describe('when logged in (premium plan)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isLoggedIn: true,
        logout: mockLogout,
        user: { email: 'premium@example.com' },
      });
      mockUseSubscription.mockReturnValue({
        plan: { tier: 'premium' },
        loading: false,
      });
    });

    it('shows premium badge', () => {
      renderNavigation();
      expect(screen.getByText('Premium')).toBeInTheDocument();
    });

    it('does not show upgrade link for premium users', () => {
      renderNavigation();
      expect(screen.queryByLabelText('Uppgradera till premium')).toBeNull();
    });
  });

  describe('when not logged in', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isLoggedIn: false,
        logout: mockLogout,
        user: null,
      });
      mockUseSubscription.mockReturnValue({
        plan: { tier: 'free' },
        loading: false,
      });
    });

    it('renders login and register links', () => {
      renderNavigation('/');
      expect(screen.getByText('Logga in')).toBeInTheDocument();
      expect(screen.getByText('Registrera')).toBeInTheDocument();
    });

    it('does not render logout button', () => {
      renderNavigation('/');
      expect(screen.queryByTitle('Logga ut')).toBeNull();
    });

    it('still renders theme toggle', () => {
      renderNavigation('/');
      expect(screen.getByLabelText('Byt till mörkt läge')).toBeInTheDocument();
    });
  });
});
