import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import LanguageSwitcher from '../LanguageSwitcher';

// Mock i18next
const changeLanguageMock = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'sv',
      changeLanguage: changeLanguageMock,
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    changeLanguageMock.mockClear();
  });

  test('renders language selector with options', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Check that all language options are present
    expect(screen.getByText('🇸🇪 Svenska')).toBeInTheDocument();
    expect(screen.getByText('🇺🇸 English')).toBeInTheDocument();
    expect(screen.getByText('🇳🇴 Norsk')).toBeInTheDocument();
  });

  test('displays current language as selected', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('sv'); // Default language
  });

  test('has proper accessibility attributes', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-label', 'language.selectLanguage');
  });

  test('language options have correct values', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options);

    expect(options).toHaveLength(3);
    expect(options[0]?.value).toBe('sv');
    expect(options[1]?.value).toBe('en');
    expect(options[2]?.value).toBe('no');
  });

  test('language switcher has correct CSS class', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    const container = screen.getByRole('combobox').parentElement;
    expect(container).toHaveClass('language-switcher');
  });

  test('calls changeLanguage when language is selected', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });

    expect(changeLanguageMock).toHaveBeenCalledWith('en');
  });
});