import { test, expect } from '@playwright/test';

test.describe('Wellness flow smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        '__e2e_test_auth__',
        JSON.stringify({
          token: 'wellness-e2e-token',
          user: {
            user_id: 'wellness-smoke-user',
            email: 'wellness-smoke@example.com',
            displayName: 'Wellness Smoke User',
          },
        })
      );
    });

    await page.route('**/api/**/wellness-goals', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { wellnessGoals: ['Självkänsla', 'Energi', 'Emotionell balans'] },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/api/**/meditation-sessions*', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessions: [
                { type: 'guided_meditation', duration: 10, created_at: new Date().toISOString() },
              ],
            },
          }),
        });
        return;
      }
      if (req.method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: 'session-1' } }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/api/**/mood*', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { moods: [{ created_at: new Date().toISOString(), score: 4 }] },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/api/**/subscription/status/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              plan: 'premium',
              status: 'active',
              isPremium: true,
              isTrial: false,
              limits: {
                moodLogsPerDay: -1,
                chatMessagesPerDay: -1,
                historyDays: -1,
              },
              features: {
                voiceChat: true,
                sounds: true,
                analytics: true,
                insights: true,
                journal: true,
                gamification: true,
                social: true,
                export: true,
                aiStories: true,
                recommendations: true,
                wellness: true,
              },
              usage: {
                date: new Date().toISOString().split('T')[0],
                moodLogs: 0,
                chatMessages: 0,
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/wellness', { waitUntil: 'networkidle' });

    await expect.poll(async () => {
      return page.evaluate(() => localStorage.getItem('__e2e_test_auth__'));
    }).toBeTruthy();
  });

  test('renders wellness page core sections and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const wellnessHeading = page.getByRole('heading', { level: 1 });
    await expect(wellnessHeading).toBeVisible();

    await expect(page.locator('[data-testid="wellness-daily-recommendation"]')).toBeVisible();
    await expect(page.locator('[data-testid="wellness-goals-card"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guidade Meditationer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Andningsövningar' })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test('opens goals modal and shows sleep section content', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.locator('[data-testid="wellness-category-sleep"]').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Sömn & Vila' })).toBeVisible();
    const sleepSection = page.locator('[data-testid="wellness-sleep-section"]');
    await expect(sleepSection).toBeVisible();
    await expect(sleepSection.locator('div.group').first()).toBeVisible();

    await page.locator('[data-testid="wellness-goals-card"]').click();
    await expect(page.getByRole('heading', { name: 'Vad vill du fokusera på?' })).toBeVisible();
  });
});
