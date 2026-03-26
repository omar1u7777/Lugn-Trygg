import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

const ROUTES = [
  { path: '/login', name: 'login', auth: false },
  { path: '/register', name: 'register', auth: false },
  { path: '/dashboard', name: 'dashboard', auth: true },
  { path: '/upgrade', name: 'upgrade', auth: true },
  { path: '/profile', name: 'profile', auth: true },
];

async function setAuthState(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem(
      'user',
      JSON.stringify({
        user_id: 'visual-test-user',
        email: 'visual@test.example',
        displayName: 'Visual Test User',
      })
    );
  });
}

test.describe('Visual Regression', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route.name} screenshot`, async ({ page }) => {
          if (route.auth) {
            await setAuthState(page);
          }

          await page.goto(route.path, { waitUntil: 'networkidle' });

          await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
            fullPage: true,
            animations: 'disabled',
            maxDiffPixels: 150,
          });
        });
      }
    });
  }
});
