/**
 * BUG-39: every string on the Privacy tab was a t() call with an ENGLISH
 * fallback and no key in any locale file, so it rendered English whatever the
 * app language was — reproduced identically with the app set to Swedish.
 *
 * This is GDPR consent and data-rights text. "The user can understand it" is a
 * legal requirement here, not a nicety, which is why this tab gets its own test
 * rather than riding on the general i18n gate.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../i18n';
import { PrivacySettings } from '../PrivacySettings';

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../services/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../../utils/secureStorage', () => ({
  tokenStorage: { clearTokens: vi.fn() },
  secureStorage: { removeItem: vi.fn() },
  purgeUserScopedStorage: vi.fn(),
}));

const { getPrivacySettingsMock } = vi.hoisted(() => ({ getPrivacySettingsMock: vi.fn() }));

vi.mock('../../utils/encryptionService', () => ({
  getPrivacySettings: getPrivacySettingsMock,
  savePrivacySettings: vi.fn(),
  exportUserData: vi.fn(),
  deleteAllUserData: vi.fn(),
}));

/** The defaults both the frontend and Backend/privacy_settings_service declare. */
const DEFAULT_SETTINGS = {
  encryptLocalStorage: true,
  dataRetentionDays: 365,
  autoDeleteOldData: false,
  allowAnalytics: true,
  shareAnonymizedData: false,
};

const renderTab = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <PrivacySettings userId="u1" />
    </I18nextProvider>
  );

beforeEach(async () => {
  vi.clearAllMocks();
  getPrivacySettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS });
  await i18n.changeLanguage('sv');
});

afterAll(async () => {
  await i18n.changeLanguage('sv');
});

describe('the privacy tab follows the chosen language', () => {
  it.each([
    ['sv', 'Integritet och säkerhet'],
    ['en', 'Privacy & Security'],
    ['no', 'Personvern og sikkerhet'],
  ])('renders its heading in %s', async (lang, expected) => {
    await i18n.changeLanguage(lang);
    renderTab();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: expected })).toBeInTheDocument();
    });
  });

  it('translates the GDPR rights paragraph, not just the headings', async () => {
    // The legally significant string, and the one the report quoted verbatim
    // as evidence the tab was untranslated.
    await i18n.changeLanguage('sv');
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/Enligt GDPR och dataskyddslagstiftningen/)).toBeInTheDocument();
    });
  });

  it('translates the consent toggles', async () => {
    await i18n.changeLanguage('sv');
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Tillåt användningsanalys')).toBeInTheDocument();
      expect(screen.getByText('Dela anonymiserad data')).toBeInTheDocument();
    });
  });

  it('leaves no English string behind in the Swedish view', async () => {
    // A heading-only assertion would have passed on the broken version too:
    // the tab label was translated while everything beneath it was not.
    await i18n.changeLanguage('sv');
    const { container } = renderTab();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument());

    const text = container.textContent ?? '';
    for (const english of [
      'Privacy & Security', 'Data Encryption', 'Data Retention',
      'Analytics & Sharing', 'Your Privacy Rights', 'Export My Data',
      'Delete All My Data', 'Under GDPR and data protection laws',
    ]) {
      expect(text).not.toContain(english);
    }
  });
});

describe('the retention figure reads correctly at every value', () => {
  it.each([
    [30, '1 månad'],
    [365, '12 månader'],
  ])('renders %s days as "%s"', async (days, expected) => {
    // Plural form matters: the slider reaches 1, and "1 månader" is wrong.
    getPrivacySettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS, dataRetentionDays: days });
    await i18n.changeLanguage('sv');
    const { container } = renderTab();
    await waitFor(() => {
      expect(container.textContent).toContain(expected);
    });
  });
});
