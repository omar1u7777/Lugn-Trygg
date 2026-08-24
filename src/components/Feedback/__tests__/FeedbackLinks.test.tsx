/**
 * BUG-43 — the "Hjälpcenter" card linked to
 * github.com/omar1u7777/Lugn-Trygg/wiki: a PRIVATE repository holding developer
 * documentation ("Home", "Testing", "Utvecklardokumentation"). For anyone who
 * is not the repo owner it is a GitHub login page or a 404, and for anyone who
 * does reach it, it is not consumer help.
 *
 * Found while fixing it, and not in the report: the button beside it went to
 * /chatbot. There is no such route — the only chat is /ai-chat — so "Live Chat"
 * showed the 404 page. It also used window.location.href, forcing a full
 * document load inside a single-page app to go nowhere.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string | { defaultValue?: string }) =>
    typeof fallback === 'string' ? fallback : key;
  return { useTranslation: () => ({ t, i18n: { language: 'sv' } }) };
});
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { user_id: 'u1', email: 'a@b.se' } }),
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../../api/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../../../api/constants', () => ({
  API_ENDPOINTS: { FEEDBACK: { SUBMIT: '/feedback' } },
}));
vi.mock('../FeedbackHistory', () => ({ default: () => <div /> }));

import FeedbackForm from '../FeedbackForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the feedback page does not send users to developer resources', () => {
  it('links to no GitHub repository at all', () => {
    const { container } = render(<FeedbackForm />);
    const github = Array.from(container.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.includes('github.com'));

    expect(github).toEqual([]);
  });

  it('keeps the contact address, which is real', () => {
    // Removing the fake card must not take the working one with it.
    const { container } = render(<FeedbackForm />);
    expect(container.querySelector('a[href^="mailto:"]')).toBeInTheDocument();
  });
});

describe('Live Chat goes to the chat', () => {
  it('navigates to /ai-chat, a route that exists', () => {
    render(<FeedbackForm />);

    fireEvent.click(screen.getByRole('button', { name: /Starta chatt/i }));

    expect(navigateMock).toHaveBeenCalledWith('/ai-chat');
  });

  it('never navigates to /chatbot', () => {
    // The dead route. Asserted by name because it is the kind of string that
    // gets pasted back in from an old branch.
    render(<FeedbackForm />);

    fireEvent.click(screen.getByRole('button', { name: /Starta chatt/i }));

    expect(navigateMock).not.toHaveBeenCalledWith('/chatbot');
  });
});
