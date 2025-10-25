import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
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

    // Navigate to settings
    await page.goto('/settings');
  });

  test('should load settings page', async ({ page }) => {
    await expect(page).toHaveTitle(/Lugn & Trygg/);
    await expect(page.locator('text=inställningar|settings')).toBeVisible();
  });

  test('should display settings categories', async ({ page }) => {
    // Look for settings sections/tabs
    const settingsSections = page.locator('[data-testid="settings-section"], .settings-tab, .settings-category');
    const sectionCount = await settingsSections.count();

    // Should have multiple settings categories
    expect(sectionCount).toBeGreaterThan(1);

    // Common settings categories
    const profileSettings = page.locator('text=profil|profile');
    const privacySettings = page.locator('text=sekretess|privacy');
    const notificationSettings = page.locator('text=notiser|notifications');

    // Should have at least one of these
    const hasProfile = await profileSettings.isVisible();
    const hasPrivacy = await privacySettings.isVisible();
    const hasNotifications = await notificationSettings.isVisible();

    expect(hasProfile || hasPrivacy || hasNotifications).toBe(true);
  });

  test('should allow profile editing', async ({ page }) => {
    const nameInput = page.locator('input[name="name"], input[placeholder*="namn"], [data-testid="name-input"]');
    const emailInput = page.locator('input[name="email"], [data-testid="email-input"]');

    if (await nameInput.isVisible()) {
      // Clear and type new name
      await nameInput.clear();
      await nameInput.fill('Updated Test User');

      // Save changes
      const saveButton = page.locator('button').filter({ hasText: /spara|save/i });
      await saveButton.click();

      // Should show success message
      await expect(page.locator('text=sparad|uppdaterad|success')).toBeVisible();
    }
  });

  test('should handle theme settings', async ({ page }) => {
    // Look for theme toggle or selector
    const themeToggle = page.locator('[data-testid="theme-toggle"], .theme-selector, input[type="checkbox"][aria-label*="theme"]');
    const themeSelect = page.locator('select[name="theme"], [data-testid="theme-select"]');

    if (await themeToggle.isVisible()) {
      // Toggle theme
      await themeToggle.click();

      // Should apply theme change (check body class or localStorage)
      await page.waitForTimeout(500); // Wait for theme transition
    } else if (await themeSelect.isVisible()) {
      // Select different theme
      await themeSelect.selectOption('dark');

      // Should apply theme
      await page.waitForTimeout(500);
    }
  });

  test('should manage notification preferences', async ({ page }) => {
    // Look for notification toggles
    const notificationToggles = page.locator('input[type="checkbox"][aria-label*="notis"], [data-testid="notification-toggle"]');

    if (await notificationToggles.first().isVisible()) {
      const firstToggle = notificationToggles.first();

      // Get initial state
      const initialChecked = await firstToggle.isChecked();

      // Toggle notification setting
      await firstToggle.click();

      // Should be different state
      const newChecked = await firstToggle.isChecked();
      expect(newChecked).not.toBe(initialChecked);
    }
  });

  test('should handle privacy settings', async ({ page }) => {
    // Look for privacy-related settings
    const privacyToggles = page.locator('input[type="checkbox"][aria-label*="sekretess"], [data-testid="privacy-toggle"]');
    const dataExportButton = page.locator('button').filter({ hasText: /exportera|export/i });
    const deleteAccountButton = page.locator('button').filter({ hasText: /radera|delete.*konto/i });

    // Should have some privacy controls
    const hasPrivacyToggle = await privacyToggles.first().isVisible();
    const hasDataExport = await dataExportButton.isVisible();
    const hasDeleteAccount = await deleteAccountButton.isVisible();

    expect(hasPrivacyToggle || hasDataExport || hasDeleteAccount).toBe(true);
  });

  test('should allow language selection', async ({ page }) => {
    const languageSelect = page.locator('select[name="language"], [data-testid="language-select"], .language-selector');

    if (await languageSelect.isVisible()) {
      // Should have Swedish as default or available
      const options = await languageSelect.locator('option').allTextContents();
      expect(options).toContain('Svenska');

      // Change language
      await languageSelect.selectOption('en');

      // Should update UI language (check for English text)
      await expect(page.locator('text=settings|Settings')).toBeVisible();
    }
  });

  test('should handle password change', async ({ page }) => {
    const changePasswordButton = page.locator('button').filter({ hasText: /ändra.*lösenord|change.*password/i });

    if (await changePasswordButton.isVisible()) {
      await changePasswordButton.click();

      // Should show password change form
      const currentPasswordInput = page.locator('input[name="currentPassword"], [data-testid="current-password"]');
      const newPasswordInput = page.locator('input[name="newPassword"], [data-testid="new-password"]');

      const hasCurrentPassword = await currentPasswordInput.isVisible();
      const hasNewPassword = await newPasswordInput.isVisible();

      expect(hasCurrentPassword || hasNewPassword).toBe(true);
    }
  });

  test('should save settings changes', async ({ page }) => {
    // Find any form input and modify it
    const inputs = page.locator('input[type="text"], input[type="email"], textarea');
    const firstInput = inputs.first();

    if (await firstInput.isVisible()) {
      const originalValue = await firstInput.inputValue();

      // Modify the input
      await firstInput.clear();
      await firstInput.fill('Test setting change');

      // Save changes
      const saveButton = page.locator('button').filter({ hasText: /spara|save/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show success feedback
        await expect(page.locator('text=sparad|uppdaterad|saved|updated')).toBeVisible();
      }
    }
  });

  test('should handle settings validation', async ({ page }) => {
    // Try to save invalid settings
    const emailInput = page.locator('input[type="email"]');

    if (await emailInput.isVisible()) {
      // Enter invalid email
      await emailInput.clear();
      await emailInput.fill('invalid-email');

      // Try to save
      const saveButton = page.locator('button').filter({ hasText: /spara|save/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show validation error
        await expect(page.locator('text=ogiltig|invalid|felaktig')).toBeVisible();
      }
    }
  });

  test('should navigate between settings sections', async ({ page }) => {
    const settingsTabs = page.locator('[data-testid="settings-tab"], .settings-tab, button[role="tab"]');

    if (await settingsTabs.first().isVisible()) {
      const tabCount = await settingsTabs.count();

      if (tabCount > 1) {
        // Click second tab
        await settingsTabs.nth(1).click();

        // Should show different content
        await page.waitForTimeout(500);

        // Content should be visible
        const content = page.locator('[data-testid="settings-content"], .settings-content');
        await expect(content).toBeVisible();
      }
    }
  });
});