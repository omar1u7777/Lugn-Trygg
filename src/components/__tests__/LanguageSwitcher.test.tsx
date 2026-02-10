/**
 * LanguageSwitcher Component Tests
 * Verifies language selection, persistence, and document.lang attribute updates.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mocks ──
const mockChangeLanguage = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'sv',
      changeLanguage: mockChangeLanguage,
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Prevent real i18n init from firing
vi.mock('../../i18n', () => ({
  default: {
    language: 'sv',
    changeLanguage: mockChangeLanguage,
  },
}));

import LanguageSwitcher from '../LanguageSwitcher';

// ── Tests ──
describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders language selector with three options', () => {
    render(<LanguageSwitcher />);

    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeInTheDocument();

    const options = Array.from(selectElement.querySelectorAll('option'));
    expect(options).toHaveLength(3);
    expect(options.some(o => o.textContent?.includes('language.swedish'))).toBe(true);
    expect(options.some(o => o.textContent?.includes('language.english'))).toBe(true);
    expect(options.some(o => o.textContent?.includes('language.norwegian'))).toBe(true);
  });

  test('displays current language as selected', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('sv');
  });

  test('has proper accessibility attributes', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-label', 'language.selectLanguage');
  });

  test('language options have correct values', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options);

    expect(options).toHaveLength(3);
    expect(options[0]?.value).toBe('sv');
    expect(options[1]?.value).toBe('en');
    expect(options[2]?.value).toBe('no');
  });

  test('calls changeLanguage and persists to localStorage when language is selected', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });

    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    expect(localStorage.getItem('i18nextLng')).toBe('en');
  });

  test('updates document lang attribute on language change', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'no' } });

    expect(mockChangeLanguage).toHaveBeenCalledWith('no');
    // 'no' normalises to 'nb' for the HTML lang attribute
    expect(document.documentElement.lang).toBe('nb');
  });
});
