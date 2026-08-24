/**
 * BUG-04: the arrow on a dashboard goal card navigated to "/".
 *
 * "/" is the public marketing and login page, so a signed-in user tapping
 * "Logga ditt humör idag" was shown the logged-out sales screen while the
 * header still displayed them as signed in. Two separate faults produced that:
 * the mood step resolved to "/" instead of the mood logger, and "/" rendered
 * LoginForm without ever checking whether a session existed.
 *
 * The aria-label on that same button read " Öppna Humörloggning" — with a
 * leading space, straight from the translation files.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { getFeatureLinkForStep } from '../../utils/goalStepLinks';
import sv from '../../i18n/locales/sv.json';
import en from '../../i18n/locales/en.json';
import no from '../../i18n/locales/no.json';

const identity = (key: string) => key;

describe('a goal step resolves to a page the user can actually use', () => {
  it.each([
    ['Logga ditt humör idag', '/mood-basic'],
    ['Skriv i din journal', '/journal'],
    ['Gör en andningsövning', '/recommendations'],
  ])('sends %s to %s', (step, expected) => {
    expect(getFeatureLinkForStep(step, identity)?.route).toBe(expected);
  });

  it('never sends a signed-in user to the public landing page', () => {
    // The property, not the instance: any step resolving to "/" is this bug.
    const steps = [
      'Logga ditt humör idag', 'Skriv i din journal', 'Gör en andningsövning',
      'Meditation i 10 minuter', 'Sömn: lägg dig i tid', 'Ta en promenad',
    ];
    const landingPage = steps.filter((s) => getFeatureLinkForStep(s, identity)?.route === '/');
    expect(landingPage).toEqual([]);
  });
});

describe('translation values are not padded with whitespace', () => {
  const flatten = (obj: Record<string, unknown>, prefix = ''): [string, string][] =>
    Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return flatten(value as Record<string, unknown>, path);
      }
      return typeof value === 'string' ? [[path, value] as [string, string]] : [];
    });

  it.each([['sv', sv], ['en', en], ['no', no]])(
    'has no leading or trailing space in %s',
    (_lang, bundle) => {
      // Broader than the three keys BUG-04 named. A padded aria-label is read
      // aloud with the pause, and the padding is invisible in review.
      const padded = flatten(bundle as Record<string, unknown>)
        .filter(([, value]) => value !== value.trim())
        .map(([path]) => path);
      expect(padded).toEqual([]);
    }
  );
});

describe('the login page turns a signed-in user away', () => {
  const renderAt = (isLoggedIn: boolean) => {
    vi.doMock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isLoggedIn }) }));
    return isLoggedIn;
  };

  it('redirects to the dashboard instead of showing the sales page', async () => {
    vi.resetModules();
    vi.doMock('../../contexts/AuthContext', () => ({
      useAuth: () => ({ isLoggedIn: true, user: { user_id: 'u1' } }),
    }));
    vi.doMock('../Layout/Navigation', () => ({ default: () => <nav /> }));

    const { default: AuthEntryLayout } = await import('../Layout/AuthEntryLayout');

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AuthEntryLayout />}>
            <Route path="/" element={<div>login form</div>} />
          </Route>
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.queryByText('login form')).not.toBeInTheDocument();
    renderAt(false);
  });
});
