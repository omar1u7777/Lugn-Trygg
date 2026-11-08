import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signInWithMockApi } from './support/mockApp';

/**
 * The app runs under the Content-Security-Policy it ships with.
 *
 * vercel.json is what Vercel sends, and `vite preview` sends none of it, so
 * each page here is served with the policy read from vercel.json. Any
 * securitypolicyviolation the page raises (a blocked script, stylesheet,
 * font, request or frame) fails the test: a policy that breaks a page would
 * otherwise only be noticed in production.
 */

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };
const POLICY = vercel.headers
  .filter((rule) => new RegExp(`^${rule.source}$`).test('/dashboard'))
  .flatMap((rule) => rule.headers)
  .find((header) => header.key.toLowerCase() === 'content-security-policy')?.value;

const PAGES = ['/', '/register', '/dashboard', '/ai-chat', '/sounds', '/wellness', '/profile', '/crisis'];

test.use({ serviceWorkers: 'block' });

test.describe('Content-Security-Policy', () => {
  test.beforeEach(async ({ page }) => {
    expect(POLICY, 'vercel.json sends no Content-Security-Policy').toBeTruthy();

    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
      document.addEventListener('securitypolicyviolation', (event) => {
        seen.push(`${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} (${event.sourceFile}:${event.lineNumber})`);
      });
    });
    await signInWithMockApi(page);
    await page.route('http://localhost:3000/**', async (route) => {
      if (route.request().resourceType() !== 'document') {
        return route.fallback();
      }
      const response = await route.fetch();
      return route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': POLICY ?? '' },
      });
    });
  });

  for (const path of PAGES) {
    test(`${path} raises no violation`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#root')).not.toBeEmpty();

      const violations = await page.evaluate(
        () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
      );
      expect(violations).toEqual([]);
    });
  }
});
