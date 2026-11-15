import { test, expect } from '@playwright/test';

/**
 * The terms and the privacy policy open for someone who is not signed in.
 *
 * /privacy redirected to a tab of the signed-in profile and /terms did not
 * exist, so the two documents a new user is asked to accept could not be read.
 */
test.use({ serviceWorkers: 'block' });

for (const [path, heading] of [['/privacy', 'Integritetspolicy'], ['/terms', 'Användarvillkor']] as const) {
  test(`${path} is readable without signing in`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
  });
}

test('the registration form opens both documents', async ({ page }) => {
  await page.goto('/register');

  await expect(page.getByRole('link', { name: 'användarvillkoren' })).toHaveAttribute('href', '/terms');
  await expect(page.getByRole('link', { name: 'integritetspolicyn' })).toHaveAttribute('href', '/privacy');
});
