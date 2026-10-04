import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from '../NotFoundPage';

const i18n = vi.hoisted(() => ({
  t: (key: string) => ({ 'common.pageNotFound': 'Sidan hittades inte!', 'common.back': 'Tillbaka', 'bottomNav.home': 'Hem' } as Record<string, string>)[key] ?? key,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => i18n }));

describe('NotFoundPage', () => {
  it('always offers a way home, even when opened directly', () => {
    window.history.replaceState({ idx: 0 }, '');
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Sidan hittades inte!' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hem/ })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: /Tillbaka/ })).toBeNull();
  });

  it('offers Back when there is an in-app page to return to', () => {
    window.history.replaceState({ idx: 2 }, '');
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Tillbaka/ })).toBeInTheDocument();
  });

  it('shows no untranslated hard-coded Swedish under another language', () => {
    window.history.replaceState({ idx: 0 }, '');
    const { container } = render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(container.textContent).not.toMatch(/Sidan du letar efter finns inte/);
  });
});
