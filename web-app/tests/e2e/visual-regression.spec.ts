import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Set consistent viewport for visual regression
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // UI Components Tests
  test('should match Button component variants visual snapshot', async ({ page }) => {
    await page.goto('/test-components');

    // Wait for components to load
    await page.waitForSelector('[data-testid="button-variants"]');

    // Take visual snapshot of button variants
    const buttonSection = page.locator('[data-testid="button-variants"]');
    await expect(buttonSection).toHaveScreenshot('button-variants.png', {
      threshold: 0.1,
    });
  });

  test('should match Input component states visual snapshot', async ({ page }) => {
    await page.goto('/test-components');

    // Wait for components to load
    await page.waitForSelector('[data-testid="input-states"]');

    // Take visual snapshot of input states
    const inputSection = page.locator('[data-testid="input-states"]');
    await expect(inputSection).toHaveScreenshot('input-states.png', {
      threshold: 0.1,
    });
  });

  test('should match Card component variants visual snapshot', async ({ page }) => {
    await page.goto('/test-components');

    // Wait for components to load
    await page.waitForSelector('[data-testid="card-variants"]');

    // Take visual snapshot of card variants
    const cardSection = page.locator('[data-testid="card-variants"]');
    await expect(cardSection).toHaveScreenshot('card-variants.png', {
      threshold: 0.1,
    });
  });

  test('should match MoodLogger modal visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Find and click mood logger trigger
    const moodTrigger = page.locator('button, [role="button"]').filter({ hasText: /humör|logga|spara/i }).first();
    if (await moodTrigger.count() > 0) {
      await moodTrigger.click();

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]');

      // Take visual snapshot of the modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toHaveScreenshot('mood-logger-modal.png', {
        threshold: 0.1,
      });
    }
  });

  // Authentication Components Tests
  test('should match LoginForm visual snapshot', async ({ page }) => {
    await page.goto('/login');

    // Wait for login form to load
    await page.waitForSelector('form');

    // Take visual snapshot of login form
    const loginForm = page.locator('form');
    await expect(loginForm).toHaveScreenshot('login-form.png', {
      threshold: 0.1,
    });
  });

  test('should match RegisterForm visual snapshot', async ({ page }) => {
    await page.goto('/register');

    // Wait for register form to load
    await page.waitForSelector('form');

    // Take visual snapshot of register form
    const registerForm = page.locator('form');
    await expect(registerForm).toHaveScreenshot('register-form.png', {
      threshold: 0.1,
    });
  });

  test('should match TwoFactorSetup component visual snapshot', async ({ page }) => {
    await page.goto('/settings');

    // Find and click 2FA setup trigger
    const twoFactorTrigger = page.locator('button, [role="button"]').filter({ hasText: /tvåfaktor|2fa|autentisering/i }).first();
    if (await twoFactorTrigger.count() > 0) {
      await twoFactorTrigger.click();

      // Wait for 2FA setup to appear
      await page.waitForSelector('[data-testid="two-factor-setup"]');

      // Take visual snapshot of 2FA setup
      const twoFactorSetup = page.locator('[data-testid="two-factor-setup"]');
      await expect(twoFactorSetup).toHaveScreenshot('two-factor-setup.png', {
        threshold: 0.1,
      });
    }
  });

  test('should match MoodAnalytics charts visual snapshot', async ({ page }) => {
    await page.goto('/analytics');

    // Wait for analytics content to load
    await page.waitForSelector('[data-testid="analytics-charts"]');

    // Take visual snapshot of charts
    const chartsSection = page.locator('[data-testid="analytics-charts"]');
    await expect(chartsSection).toHaveScreenshot('analytics-charts.png', {
      threshold: 0.1,
    });
  });

  // Dashboard Components Tests
  test('should match Dashboard widgets visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for dashboard widgets to load
    await page.waitForSelector('[data-testid="dashboard-widgets"]');

    // Take visual snapshot of dashboard widgets
    const dashboardWidgets = page.locator('[data-testid="dashboard-widgets"]');
    await expect(dashboardWidgets).toHaveScreenshot('dashboard-widgets.png', {
      threshold: 0.1,
    });
  });

  test('should match ActivityFeed component visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for activity feed to load
    await page.waitForSelector('[data-testid="activity-feed"]');

    // Take visual snapshot of activity feed
    const activityFeed = page.locator('[data-testid="activity-feed"]');
    await expect(activityFeed).toHaveScreenshot('activity-feed.png', {
      threshold: 0.1,
    });
  });

  test('should match QuickStatsWidget visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for quick stats widget to load
    await page.waitForSelector('[data-testid="quick-stats-widget"]');

    // Take visual snapshot of quick stats widget
    const quickStatsWidget = page.locator('[data-testid="quick-stats-widget"]');
    await expect(quickStatsWidget).toHaveScreenshot('quick-stats-widget.png', {
      threshold: 0.1,
    });
  });

  // Integration Components Tests
  test('should match HealthDataCharts visual snapshot', async ({ page }) => {
    await page.goto('/integrations');

    // Wait for health data charts to load
    await page.waitForSelector('[data-testid="health-data-charts"]');

    // Take visual snapshot of health data charts
    const healthCharts = page.locator('[data-testid="health-data-charts"]');
    await expect(healthCharts).toHaveScreenshot('health-data-charts.png', {
      threshold: 0.1,
    });
  });

  test('should match OAuthHealthIntegrations visual snapshot', async ({ page }) => {
    await page.goto('/integrations');

    // Wait for OAuth integrations to load
    await page.waitForSelector('[data-testid="oauth-integrations"]');

    // Take visual snapshot of OAuth integrations
    const oauthIntegrations = page.locator('[data-testid="oauth-integrations"]');
    await expect(oauthIntegrations).toHaveScreenshot('oauth-integrations.png', {
      threshold: 0.1,
    });
  });

  // Feedback Components Tests
  test('should match FeedbackForm visual snapshot', async ({ page }) => {
    await page.goto('/feedback');

    // Wait for feedback form to load
    await page.waitForSelector('[data-testid="feedback-form"]');

    // Take visual snapshot of feedback form
    const feedbackForm = page.locator('[data-testid="feedback-form"]');
    await expect(feedbackForm).toHaveScreenshot('feedback-form.png', {
      threshold: 0.1,
    });
  });

  test('should match FeedbackHistory visual snapshot', async ({ page }) => {
    await page.goto('/feedback');

    // Wait for feedback history to load
    await page.waitForSelector('[data-testid="feedback-history"]');

    // Take visual snapshot of feedback history
    const feedbackHistory = page.locator('[data-testid="feedback-history"]');
    await expect(feedbackHistory).toHaveScreenshot('feedback-history.png', {
      threshold: 0.1,
    });
  });

  test('should match login page visual snapshot', async ({ page }) => {
    await page.goto('/login');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      threshold: 0.1, // Allow 0.1% difference
    });
  });

  test('should match dashboard visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for dashboard content to load
    await page.waitForSelector('[role="main"]');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('dashboard-page.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match mood logger modal visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Find and click mood logger trigger
    const moodTrigger = page.locator('button, [role="button"]').filter({ hasText: /humör|logga|spara/i }).first();
    if (await moodTrigger.count() > 0) {
      await moodTrigger.click();

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]');

      // Take visual snapshot of the modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toHaveScreenshot('mood-logger-modal.png', {
        threshold: 0.1,
      });
    }
  });

  test('should match analytics page visual snapshot', async ({ page }) => {
    await page.goto('/analytics');

    // Wait for analytics content to load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('analytics-page.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match integrations page visual snapshot', async ({ page }) => {
    await page.goto('/integrations');

    // Wait for integrations content to load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('integrations-page.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match feedback page visual snapshot', async ({ page }) => {
    await page.goto('/feedback');

    // Wait for feedback content to load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot
    await expect(page).toHaveScreenshot('feedback-page.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match mobile login page visual snapshot', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/login');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot for mobile
    await expect(page).toHaveScreenshot('login-page-mobile.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match mobile dashboard visual snapshot', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');

    // Wait for dashboard content to load
    await page.waitForSelector('[role="main"]');

    // Take visual snapshot for mobile
    await expect(page).toHaveScreenshot('dashboard-page-mobile.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match dark theme login page visual snapshot', async ({ page }) => {
    await page.goto('/login');

    // Try to toggle to dark theme if theme toggle exists
    const themeToggle = page.locator('button').filter({ hasText: /theme|dark|tema/i }).first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition
    }

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot with dark theme
    await expect(page).toHaveScreenshot('login-page-dark-theme.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match error state visual snapshot', async ({ page }) => {
    // Navigate to a non-existent page to trigger error state
    await page.goto('/non-existent-page');

    // Wait for error content to load
    await page.waitForLoadState('networkidle');

    // Take visual snapshot of error page
    await expect(page).toHaveScreenshot('error-page.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match offline indicator visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');

    // Simulate offline state by blocking network requests
    await page.context().setOffline(true);

    // Wait a moment for offline indicator to appear
    await page.waitForTimeout(1000);

    // Take visual snapshot of offline state
    await expect(page).toHaveScreenshot('offline-indicator.png', {
      fullPage: true,
      threshold: 0.1,
    });

    // Restore online state
    await page.context().setOffline(false);
  });
});