/**
 * The terms and the privacy policy can be read before registering.
 *
 * Both links on the registration form went to /privacy, which redirected to a
 * tab of the signed-in profile: someone creating an account was asked to accept
 * two documents they could not open, and there was no terms document at all.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrivacyPolicyPage, TermsPage } from '../LegalPages';
import { SUPPORT_EMAIL } from '../../../config/contact';

const show = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);
const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('PrivacyPolicyPage', () => {
  it('has the policy as its one main heading', () => {
    show(<PrivacyPolicyPage />);

    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Integritetspolicy']);
  });

  it('says what is stored, who processes it, how to get it erased and whom to ask', () => {
    show(<PrivacyPolicyPage />);
    const text = document.body.textContent ?? '';

    for (const stored of ['humör', 'dagbok', 'röstinspelning', 'PHQ-9']) expect(text).toContain(stored);
    for (const processor of ['Google', 'Microsoft', 'Render', 'Vercel', 'Sentry', 'Stripe']) expect(text).toContain(processor);
    expect(text).toMatch(/30 dagar/);
    expect(screen.getAllByRole('link', { name: SUPPORT_EMAIL })[0]).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`);
    expect(text).toContain('Integritetsskyddsmyndigheten');
  });
});

describe('TermsPage', () => {
  it('has the terms as its one main heading', () => {
    show(<TermsPage />);

    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Användarvillkor']);
  });

  it('says the app is not healthcare and where to turn in an emergency', () => {
    show(<TermsPage />);
    const text = document.body.textContent ?? '';

    expect(text).toMatch(/inte .*vård/i);
    expect(text).toContain('112');
    expect(text).toContain('1177');
  });
});

describe('where the links lead', () => {
  it('the registration form links the terms to /terms and the policy to /privacy', () => {
    const form = source('src/components/Auth/RegisterForm.tsx');
    const target = (key: string) => form.slice(0, form.indexOf(key)).match(/<Link to="([^"]+)"[^>]*>\s*\{t\('$/)?.[1]
      ?? form.slice(0, form.indexOf(key)).split('<Link to="').pop()?.split('"')[0];

    expect(target("registerForm.termsLink")).toBe('/terms');
    expect(target("registerForm.privacyLink")).toBe('/privacy');
  });

  it('neither address is a redirect into the signed-in app', () => {
    const app = source('src/App.tsx');

    expect(app).toMatch(/path="\/privacy" element=\{<PrivacyPolicyPage \/>\}/);
    expect(app).toMatch(/path="\/terms" element=\{<TermsPage \/>\}/);
  });
});
