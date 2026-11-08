/**
 * The account flows on /profile: tabs, e-mail and password changes, 2FA,
 * notification toggles and sign-out.
 */
import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import i18n from '../../i18n';

const api = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  setup2FA: vi.fn(),
  verify2FASetup: vi.fn(),
  deleteAccount: vi.fn(),
  getUserProfile: vi.fn(),
  getUserStats: vi.fn(),
  updateUserPreferences: vi.fn(),
  setUser: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  changeEmail: api.changeEmail,
  changePassword: api.changePassword,
  setup2FA: api.setup2FA,
  verify2FASetup: api.verify2FASetup,
  deleteAccount: api.deleteAccount,
}));
vi.mock('../../api/users', () => ({
  getUserProfile: api.getUserProfile,
  getUserStats: api.getUserStats,
  updateUserPreferences: api.updateUserPreferences,
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { user_id: 'u1', email: 'old@example.se' },
    setUser: api.setUser,
    logout: api.logout,
  }),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    plan: { tier: 'premium', limits: { moodLogsPerDay: -1, chatMessagesPerDay: -1, historyDays: -1 } },
    isPremium: true,
    isTrial: false,
    usage: { moodLogs: 0, chatMessages: 0, lastResetDate: '2026-11-08' },
    getRemainingMoodLogs: () => -1,
    getRemainingMessages: () => -1,
  }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: vi.fn() }),
}));

// jsdom has none; the 2FA QR code is an OptimizedImage, which lazy-loads with it.
class StubIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.IntersectionObserver = StubIntersectionObserver as unknown as typeof IntersectionObserver;

import ProfileHub from '../ProfileHub';

const renderProfile = async () => {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfileHub />
      </MemoryRouter>
    </I18nextProvider>,
  );
  await waitFor(() => expect(api.getUserProfile).toHaveBeenCalled());
};

const openDialog = async (trigger: string) => {
  fireEvent.click(screen.getByRole('button', { name: trigger }));
  return within(await screen.findByRole('dialog'));
};

describe('ProfileHub account flows', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.getUserProfile.mockResolvedValue({ preferences: { emailNotifications: false, pushNotifications: false } });
    api.getUserStats.mockResolvedValue({ totalMoods: 1, totalConversations: 0, totalMemories: 0, accountAge: 2, activeDays: 1 });
  });

  it('switches tabs', async () => {
    await renderProfile();

    fireEvent.click(screen.getByRole('tab', { name: /Notiser/ }));

    expect(await screen.findByText('E-postnotiser')).toBeInTheDocument();
  });

  describe('changing e-mail', () => {
    it('validates the address and the password before calling the server', async () => {
      await renderProfile();
      const dialog = await openDialog('Ändra e-post');
      const submit = () => fireEvent.click(dialog.getByRole('button', { name: 'Ändra e-post' }));

      submit();
      expect(await dialog.findByText('E-postadress krävs')).toBeInTheDocument();

      fireEvent.change(dialog.getByLabelText(/Ny e-postadress/), { target: { value: 'inte-en-adress' } });
      submit();
      expect(await dialog.findByText('Ogiltig e-postadress')).toBeInTheDocument();

      fireEvent.change(dialog.getByLabelText(/Ny e-postadress/), { target: { value: 'new@example.se' } });
      submit();
      expect(await dialog.findByText('Nuvarande lösenord krävs')).toBeInTheDocument();
      expect(api.changeEmail).not.toHaveBeenCalled();
    });

    it('changes the address and updates the signed-in user', async () => {
      api.changeEmail.mockResolvedValue({});
      await renderProfile();
      const dialog = await openDialog('Ändra e-post');

      fireEvent.change(dialog.getByLabelText(/Ny e-postadress/), { target: { value: 'new@example.se' } });
      fireEvent.change(dialog.getByLabelText(/Nuvarande lösenord/), { target: { value: 'hemligt' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Ändra e-post' }));

      await waitFor(() => expect(api.changeEmail).toHaveBeenCalledWith('new@example.se', 'hemligt'));
      await waitFor(() => expect(api.setUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.se' })));
    });

    it('closes without saving on cancel', async () => {
      await renderProfile();
      const dialog = await openDialog('Ändra e-post');

      fireEvent.click(dialog.getByRole('button', { name: 'Avbryt' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(api.changeEmail).not.toHaveBeenCalled();
    });
  });

  describe('changing password', () => {
    const fill = (dialog: ReturnType<typeof within>, current: string, next: string, confirm: string) => {
      fireEvent.change(dialog.getByLabelText(/Nuvarande lösenord/), { target: { value: current } });
      fireEvent.change(dialog.getByLabelText(/^Nytt lösenord/), { target: { value: next } });
      fireEvent.change(dialog.getByLabelText(/Bekräfta nytt lösenord/), { target: { value: confirm } });
      fireEvent.click(dialog.getByRole('button', { name: 'Ändra lösenord' }));
    };

    it('rejects a missing current password, a weak one and a mismatch', async () => {
      await renderProfile();
      const dialog = await openDialog('Ändra lösenord');

      fill(dialog, '', 'Starkt1!lösen', 'Starkt1!lösen');
      expect(await dialog.findByText('Nuvarande lösenord krävs')).toBeInTheDocument();

      fill(dialog, 'gammalt', 'kort', 'kort');
      expect(await dialog.findByText('Lösenord måste vara minst 8 tecken')).toBeInTheDocument();

      fill(dialog, 'gammalt', 'Starkt1!lösen', 'Annat1!lösen');
      expect(await dialog.findByText('Lösenorden matchar inte')).toBeInTheDocument();
      expect(api.changePassword).not.toHaveBeenCalled();
    });

    it('changes a valid password', async () => {
      api.changePassword.mockResolvedValue({});
      await renderProfile();
      const dialog = await openDialog('Ändra lösenord');

      fill(dialog, 'gammalt', 'Starkt1!lösen', 'Starkt1!lösen');

      await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith('gammalt', 'Starkt1!lösen'));
    });
  });

  describe('two-factor authentication', () => {
    it('asks for a six-digit code and verifies it', async () => {
      api.setup2FA.mockResolvedValue({ qr_code: 'data:image/png;base64,AAAA', secret: 'ABC', provisioning_uri: 'otpauth://x' });
      api.verify2FASetup.mockResolvedValue({});
      await renderProfile();

      fireEvent.click(screen.getByRole('button', { name: 'Aktivera 2FA' }));
      const dialog = within(await screen.findByRole('dialog'));
      const verify = () => fireEvent.click(dialog.getByRole('button', { name: 'Aktivera 2FA' }));

      fireEvent.change(dialog.getByLabelText(/Verifieringskod/), { target: { value: '12a' } });
      verify();
      expect(await dialog.findByText('Ange en giltig 6-siffrig kod')).toBeInTheDocument();

      fireEvent.change(dialog.getByLabelText(/Verifieringskod/), { target: { value: '123456' } });
      verify();

      await waitFor(() => expect(api.verify2FASetup).toHaveBeenCalledWith('123456'));
      await waitFor(() => expect(api.setUser).toHaveBeenCalledWith(expect.objectContaining({ twoFactorEnabled: true })));
    });

    it('says so when setup fails', async () => {
      api.setup2FA.mockRejectedValue(new Error('nope'));
      await renderProfile();

      fireEvent.click(screen.getByRole('button', { name: 'Aktivera 2FA' }));

      await waitFor(() => expect(api.setup2FA).toHaveBeenCalled());
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('notification settings', () => {
    it('refuses to change a setting when the saved ones never loaded', async () => {
      api.getUserProfile.mockRejectedValue(new Error('down'));
      await renderProfile();
      fireEvent.click(screen.getByRole('tab', { name: /Notiser/ }));

      fireEvent.click(await screen.findByRole('checkbox', { name: /E-postnotiser/ }));

      expect(await screen.findAllByText(/Kunde inte hämta dina sparade inställningar/)).not.toHaveLength(0);
      expect(screen.queryByText('Osparade ändringar')).toBeNull();
    });

    it('marks a changed setting as unsaved', async () => {
      await renderProfile();
      fireEvent.click(screen.getByRole('tab', { name: /Notiser/ }));

      fireEvent.click(await screen.findByRole('checkbox', { name: /E-postnotiser/ }));

      expect(await screen.findByText('Osparade ändringar')).toBeInTheDocument();
    });

    it('leaves push off when the browser blocks notifications', async () => {
      const requestPermission = vi.fn().mockResolvedValue('denied');
      vi.stubGlobal('Notification', { permission: 'default', requestPermission });
      await renderProfile();
      fireEvent.click(screen.getByRole('tab', { name: /Notiser/ }));

      fireEvent.click(await screen.findByRole('checkbox', { name: /Push-notiser/ }));

      expect(await screen.findByText(/Webbläsaren blockerar notiser/)).toBeInTheDocument();
      expect(requestPermission).toHaveBeenCalled();
      expect(screen.queryByText('Osparade ändringar')).toBeNull();
      vi.unstubAllGlobals();
    });
  });

  it('deletes the account with the password and then signs out', async () => {
    api.deleteAccount.mockResolvedValue({});
    await renderProfile();

    fireEvent.click(screen.getByRole('button', { name: 'Radera konto' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Fortsätt' }));
    fireEvent.change(screen.getByLabelText(/Skriv "RADERA"/), { target: { value: 'RADERA' } });
    fireEvent.change(screen.getByLabelText(/lösenord/i), { target: { value: 'hemligt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Radera kontot' }));

    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledWith('u1', 'hemligt'));
    const closed = within(await screen.findByRole('dialog'));
    expect(closed.getByText('Ditt konto är stängt')).toBeInTheDocument();
    fireEvent.click(closed.getByRole('button', { name: 'Logga ut' }));
    expect(api.logout).toHaveBeenCalled();
  });

  it('closes account deletion on cancel without deleting', async () => {
    await renderProfile();

    fireEvent.click(screen.getByRole('button', { name: 'Radera konto' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Avbryt' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fortsätt' })).toBeNull());
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('signs out after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderProfile();

    fireEvent.click(screen.getByRole('button', { name: /Logga ut/ }));

    expect(api.logout).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
