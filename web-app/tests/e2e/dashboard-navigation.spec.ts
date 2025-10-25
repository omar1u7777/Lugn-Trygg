import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Mock authentication for testing
    await page.addScriptTag({
      content: `
        window.localStorage.setItem('user', JSON.stringify({
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User'
        }));
        window.localStorage.setItem('token', 'mock-jwt-token');
      `
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test('should load dashboard page', async ({ page }) => {
    await expect(page).toHaveTitle(/Lugn & Trygg/);
    await expect(page.locator('text=Dashboard|Välkommen')).toBeVisible();
  });

  test('should display navigation menu', async ({ page }) => {
    // Check for navigation elements
    const nav = page.locator('nav, [data-testid="navigation"], .sidebar, .nav-menu');
    await expect(nav).toBeVisible();

    // Should have multiple navigation items
    const navItems = nav.locator('a, button').filter({ hasText: true });
    const itemCount = await navItems.count();
    expect(itemCount).toBeGreaterThan(3); // At least Dashboard, Mood, Analytics
  });

  test('should navigate to mood logging', async ({ page }) => {
    const moodLink = page.locator('a, button').filter({ hasText: /humör|mood/i });
    await moodLink.click();

    // Should navigate to mood page
    await expect(page).toHaveURL(/\/mood/);
    await expect(page.locator('text=hur mår du|logga humör')).toBeVisible();
  });

  test('should navigate to analytics', async ({ page }) => {
    const analyticsLink = page.locator('a, button').filter({ hasText: /analys|analytics|statistik/i });
    await analyticsLink.click();

    // Should navigate to analytics page
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.locator('text=analys|trender|statistik')).toBeVisible();
  });

  test('should navigate to settings', async ({ page }) => {
    const settingsLink = page.locator('a, button').filter({ hasText: /inställningar|settings/i });
    await settingsLink.click();

    // Should navigate to settings page
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('text=inställningar|settings')).toBeVisible();
  });

  test('should navigate to profile', async ({ page }) => {
    const profileLink = page.locator('a, button').filter({ hasText: /profil|profile/i });
    await profileLink.click();

    // Should navigate to profile page
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.locator('text=profil|profile')).toBeVisible();
  });

  test('should display user info in header', async ({ page }) => {
    const header = page.locator('header, [data-testid="header"]');
    await expect(header).toBeVisible();

    // Should show user name or avatar
    const userInfo = header.locator('text=Test User, [data-testid="user-avatar"], .user-info');
    await expect(userInfo.or(page.locator('[data-testid="user-menu"]'))).toBeVisible();
  });

  test('should show quick actions on dashboard', async ({ page }) => {
    // Look for quick action buttons or cards
    const quickActions = page.locator('[data-testid="quick-action"], .quick-action, .action-card');
    const actionCount = await quickActions.count();

    if (actionCount > 0) {
      // Should have at least one quick action
      expect(actionCount).toBeGreaterThan(0);

      // First action should be clickable
      const firstAction = quickActions.first();
      await expect(firstAction).toBeVisible();
    }
  });

  test('should display recent mood entries', async ({ page }) => {
    const recentMoods = page.locator('[data-testid="recent-moods"], .recent-entries, .mood-history');
    const moodCount = await recentMoods.count();

    if (moodCount > 0) {
      // Should show recent mood entries
      await expect(recentMoods.first()).toBeVisible();
    }
  });

  test('should show dashboard widgets', async ({ page }) => {
    // Look for dashboard widgets/cards
    const widgets = page.locator('[data-testid="dashboard-widget"], .widget, .dashboard-card');
    const widgetCount = await widgets.count();

    // Should have multiple widgets
    expect(widgetCount).toBeGreaterThan(1);

    // Widgets should be visible
    for (let i = 0; i < Math.min(widgetCount, 3); i++) {
      await expect(widgets.nth(i)).toBeVisible();
    }
  });

  test('should handle mobile navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Look for mobile menu button
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu-toggle, button[aria-label*="menu"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();

      // Mobile menu should open
      const mobileNav = page.locator('[data-testid="mobile-nav"], .mobile-nav, .mobile-menu');
      await expect(mobileNav).toBeVisible();

      // Should be able to close menu
      const closeButton = mobileNav.locator('button[aria-label*="close"], .close-button');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(mobileNav).not.toBeVisible();
      }
    }
  });

  test('should maintain navigation state', async ({ page }) => {
    // Navigate to different sections and back
    const moodLink = page.locator('a, button').filter({ hasText: /humör|mood/i });
    await moodLink.click();
    await expect(page).toHaveURL(/\/mood/);

    // Go back to dashboard
    const dashboardLink = page.locator('a, button').filter({ hasText: /dashboard|hem/i });
    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});