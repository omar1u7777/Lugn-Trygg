import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'sv' } }),
}));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { user_id: 'u1', email: 'a@b.se', name: 'Test' }, logout: vi.fn() }),
}));

import ProfileDropdown from '../ProfileDropdown';

describe('ProfileDropdown', () => {
  it('sends "Inställningar" to the settings tab, not the same page as "Profil" (UI audit N-3)', () => {
    render(
      <MemoryRouter>
        <ProfileDropdown isPremium={false} planLabel="Free" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);

    const profile = screen.getByRole('menuitem', { name: /navigation.profile/ });
    const settings = screen.getByRole('menuitem', { name: /navigation.settings/ });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(settings).toHaveAttribute('href', '/profile?tab=appearance');
  });

  it('holds account actions only; theme and language live under Inställningar (UI audit Dup-6)', () => {
    render(
      <MemoryRouter>
        <ProfileDropdown />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);

    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim());
    expect(items).toEqual(['navigation.profile', 'navigation.settings', 'navigation.logout']);
  });
});
