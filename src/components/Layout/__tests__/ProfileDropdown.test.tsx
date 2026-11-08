import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'sv' } }),
}));
let currentUser: Record<string, unknown> = { user_id: 'u1', email: 'a@b.se', name: 'Test' };
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, logout: vi.fn() }),
}));

import ProfileDropdown from '../ProfileDropdown';

// The menu named people after their e-mail address: "omaralhaek97@…"
// became "Omaralhaek".
describe('ProfileDropdown name', () => {
  const renderMenu = (user: Record<string, unknown>) => {
    currentUser = user;
    render(
      <MemoryRouter>
        <ProfileDropdown />
      </MemoryRouter>,
    );
    return screen.getAllByRole('button')[0];
  };

  it('shows the stored name', () => {
    expect(renderMenu({ user_id: 'u1', email: 'omaralhaek97@gmail.com', name: 'Omar Alhaek' }).textContent)
      .toContain('Omar Alhaek');
  });

  it('shows the e-mail address, not a name made from it, when none is stored', () => {
    const button = renderMenu({ user_id: 'u1', email: 'omaralhaek97@gmail.com', name: 'Okänd' });

    expect(button.textContent).toContain('omaralhaek97@gmail.com');
    expect(button.textContent).not.toContain('Omaralhaek');
  });
});

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
