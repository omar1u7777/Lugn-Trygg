/**
 * The crisis page and the crisis contact data — the three findings a QA pass
 * classed as critical, because each of them fails a person in crisis.
 *
 * BUG-01  The same helpline appeared with three different numbers. Mind
 *         Självmordslinjen is 90101; /recommendations showed 0900-011 200 in
 *         four places, one of them a tel: link that dialled it.
 * BUG-45  This page had no useTranslation at all — 298 lines of hardcoded
 *         Swedish. A user who had switched the app to English or Norwegian
 *         reached the one page where clarity matters most and could not read it.
 * BUG-34  112 appeared only inside the body text of the "Jourhavande Präst"
 *         card, below the fold.
 * BUG-35  The Mind card showed a chat link and no number at all.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../i18n';
import CrisisPage from '../CrisisPage';
import { CRISIS_NUMBERS, CRISIS_RESOURCES, CRISIS_TEL } from '../../config/crisisResources';

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn() } }));

const renderPage = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <CrisisPage />
      </MemoryRouter>
    </I18nextProvider>
  );

beforeEach(async () => {
  await i18n.changeLanguage('sv');
});

afterAll(async () => {
  await i18n.changeLanguage('sv');
});

describe('crisis contact data has one source', () => {
  it('states the suicide line as 90101', () => {
    // The number that was wrong in four places. If this ever changes, it
    // changes here and nowhere else.
    expect(CRISIS_NUMBERS.suicideLine).toBe('90101');
    expect(CRISIS_TEL.suicideLine).toBe('tel:90101');
  });

  it('never dials 0900-011 200', () => {
    // That number does not belong to Självmordslinjen. It was on a tel: link,
    // so a tap actually called it.
    const dialled = Object.values(CRISIS_TEL).join(' ');
    expect(dialled).not.toContain('0900');
  });

  it('gives the Mind card a phone number, not only a chat link', () => {
    // BUG-35: on this page Mind used to appear as chat and nothing else, which
    // was the third different presentation of the same service in one app.
    const mind = CRISIS_RESOURCES.find((r) => r.id === 'mindChat');
    expect(mind?.phone).toBe(CRISIS_NUMBERS.suicideLine);
  });
});

describe('the 112 banner is above the fold', () => {
  it('renders before the page heading', () => {
    renderPage();
    const banner = screen.getByRole('alert');
    const heading = screen.getByRole('heading', { level: 1 });

    // Node.compareDocumentPosition: 4 = "heading follows banner".
    expect(banner.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('offers 112 as a link you can tap', () => {
    renderPage();
    const banner = screen.getByRole('alert');
    const call = within(banner).getByRole('link');
    expect(call).toHaveAttribute('href', CRISIS_TEL.emergency);
  });
});

describe('the page follows the chosen language', () => {
  it('renders Swedish when the app is Swedish', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hjälp och Stöd');
  });

  it.each([
    ['en', 'Help and Support'],
    ['no', 'Hjelp og støtte'],
  ])('renders %s when the app is set to it', async (lang, expected) => {
    await i18n.changeLanguage(lang);
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected);
  });

  it('translates the resource cards, not just the chrome', async () => {
    // The QA finding was that EVERY string was Swedish, cards included — so a
    // heading-only assertion would not have caught it.
    await i18n.changeLanguage('en');
    renderPage();
    expect(screen.getByText('You are not alone')).toBeInTheDocument();
    expect(screen.getByText(/Support for children and young people/)).toBeInTheDocument();
  });

  it('keeps the phone numbers identical across languages', async () => {
    // Numbers are data, not copy. A locale that disagrees about who to call is
    // the failure this whole file exists to prevent.
    const numbersIn = async (lang: string) => {
      await i18n.changeLanguage(lang);
      const { container, unmount } = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <CrisisPage />
          </MemoryRouter>
        </I18nextProvider>
      );
      const hrefs = Array.from(container.querySelectorAll('a[href^="tel:"]'))
        .map((a) => a.getAttribute('href'))
        .sort();
      unmount();
      return hrefs;
    };

    const sv = await numbersIn('sv');
    const en = await numbersIn('en');
    const no = await numbersIn('no');

    expect(sv.length).toBeGreaterThan(0);
    expect(en).toEqual(sv);
    expect(no).toEqual(sv);
  });
});
