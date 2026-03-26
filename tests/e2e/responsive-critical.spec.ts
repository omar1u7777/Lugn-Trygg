import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

test.describe('Responsive Critical Checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem(
        'user',
        JSON.stringify({
          user_id: 'responsive-critical-user',
          email: 'responsive@test.example',
          displayName: 'Responsive Test User',
        })
      );
    });
  });

  const waitForStablePageState = async (page: Page) => {
    const loadingText = page.getByText('Laddar...');
    await loadingText
      .waitFor({ state: 'hidden', timeout: 8000 })
      .catch(() => {
        // Some routes transition quickly or render without this loading text.
      });
  };

  for (const viewport of VIEWPORTS) {
    test(`upgrade table no horizontal overflow (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/upgrade', { waitUntil: 'networkidle' });
      await waitForStablePageState(page);

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });

      expect(hasHorizontalOverflow).toBeFalsy();
    });

    test(`bottom nav touch targets are large enough (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await waitForStablePageState(page);

      if (viewport.width < 1024) {
        const mobileNav = page.locator('nav[aria-label="Mobilnavigation"]');
        const loginButton = page.getByRole('button', { name: /logga in/i }).first();

        await Promise.race([
          mobileNav.first().waitFor({ state: 'visible', timeout: 8000 }),
          loginButton.waitFor({ state: 'visible', timeout: 8000 }),
        ]).catch(() => {
          // Continue to assertions below for clearer failure messages.
        });

        const isMobileNavVisible = (await mobileNav.count()) > 0 && (await mobileNav.first().isVisible());

        if (isMobileNavVisible) {
          const navLinks = mobileNav.locator('a');
          const count = await navLinks.count();
          expect(count).toBeGreaterThan(0);

          for (let i = 0; i < count; i += 1) {
            const box = await navLinks.nth(i).boundingBox();
            expect(box).not.toBeNull();
            if (box) {
              expect(box.height).toBeGreaterThanOrEqual(44);
            }
          }
        } else {
          await expect(loginButton).toBeVisible();
          const box = await loginButton.boundingBox();
          expect(box).not.toBeNull();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });
  }
});
