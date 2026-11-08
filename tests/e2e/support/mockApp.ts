import type { Page, Route } from '@playwright/test';

/**
 * Sign in and stand up a fake API, for specs that need only the frontend.
 *
 * The build calls the API on another origin with credentials, so a mocked
 * response needs what a real one carries: CORS headers, and an answer to the
 * preflight that names the headers the request asked for. Specs using this
 * should also set `serviceWorkers: 'block'`: requests the app's service worker
 * makes are not seen by page.route.
 */
export const fulfil = (route: Route, data: unknown) => {
  const request = route.request();
  const headers = {
    'access-control-allow-origin': 'http://localhost:3000',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? 'authorization, content-type',
  };
  if (request.method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers });
  }
  return route.fulfill({
    status: 200, headers, contentType: 'application/json', body: JSON.stringify({ success: true, data }),
  });
};

/** A premium user, signed in through the loopback-only e2e hooks, and an API that answers `{}`. */
export const signInWithMockApi = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('__e2e_test_auth__', JSON.stringify({
      token: 'e2e-token',
      user: { user_id: 'e2e-user', email: 'e2e@example.com', displayName: 'Ljud Test' },
    }));
    localStorage.setItem('__e2e_test_tier__', 'premium');
    localStorage.setItem('i18nextLng', 'sv');
  });
  await page.route('**/api/**', (route) => fulfil(route, {}));
};
