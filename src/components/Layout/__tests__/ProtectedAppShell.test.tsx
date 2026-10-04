import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * The shell wraps every app route, so it — not the route's own flag — decides
 * who gets redirected.
 *
 * /crisis was marked `protected: false`, the change shipped, and production
 * still answered a logged-out person with a login form. The flag only reached
 * renderRouteElement one level further in; the shell above it redirected
 * regardless. Verified against the live site, not inferred.
 *
 * The page carries 112, Självmordslinjen 90101, Mind, 1177 and BRIS. These
 * tests exist so it cannot quietly go behind a login again.
 */

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => authMock.useAuth(),
}));

// The shared setup's i18n stub has no dir(); the shell calls it for the
// document direction.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { dir: () => 'ltr', language: 'sv' } }),
}));

vi.mock('../../WorldClassDashboardSkeleton', () => ({
  default: () => <div>Loading skeleton</div>,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// The chrome is not what these tests are about, and it drags in the whole app.
vi.mock('../Navigation', () => ({ default: () => <nav>nav</nav> }));
vi.mock('../Sidebar', () => ({ default: () => <aside>sidebar</aside> }));
vi.mock('../BottomNav', () => ({ default: () => <nav>bottom</nav> }));
vi.mock('../../AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ProtectedAppShell from '../ProtectedAppShell';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedAppShell />}>
          <Route path="/crisis" element={<div>112 · Självmordslinjen 90101</div>} />
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedAppShell', () => {
  beforeEach(() => {
    authMock.useAuth.mockReset();
  });

  it('shows the crisis page to someone who is not logged in', () => {
    authMock.useAuth.mockReturnValue({ isLoggedIn: false, isInitialized: true });

    renderAt('/crisis');

    expect(screen.getByText(/112/)).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('still redirects a protected route when not logged in', () => {
    authMock.useAuth.mockReturnValue({ isLoggedIn: false, isInitialized: true });

    renderAt('/dashboard');

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('shows the crisis page to a logged-in user too', () => {
    authMock.useAuth.mockReturnValue({ isLoggedIn: true, isInitialized: true });

    renderAt('/crisis');

    expect(screen.getByText(/112/)).toBeInTheDocument();
  });

  it('waits for auth to initialise before deciding anything', () => {
    authMock.useAuth.mockReturnValue({ isLoggedIn: false, isInitialized: false });

    renderAt('/crisis');

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
