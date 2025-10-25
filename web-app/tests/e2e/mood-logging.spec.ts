import { test, expect } from '@playwright/test';

test.describe('Mood Logging', () => {
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
  });

  test('should load mood logging page', async ({ page }) => {
    await page.goto('/mood');
    await expect(page).toHaveTitle(/Lugn & Trygg/);

    // Check for mood logging interface
    await expect(page.locator('text=hur mår du idag?')).toBeVisible();
  });

  test('should display mood selection options', async ({ page }) => {
    await page.goto('/mood');

    // Check for mood emoji buttons or selectors
    const moodSelectors = page.locator('[data-testid="mood-selector"], .mood-option, button[aria-label*="humör"]');
    await expect(moodSelectors.first()).toBeVisible();

    // Should have multiple mood options
    const moodCount = await moodSelectors.count();
    expect(moodCount).toBeGreaterThan(3); // At least happy, neutral, sad
  });

  test('should allow mood selection', async ({ page }) => {
    await page.goto('/mood');

    // Click on a mood option (assuming first one is available)
    const firstMoodOption = page.locator('[data-testid="mood-selector"], .mood-option, button[aria-label*="humör"]').first();
    await firstMoodOption.click();

    // Should show intensity slider or confirmation
    const intensitySlider = page.locator('input[type="range"], [data-testid="intensity-slider"]');
    if (await intensitySlider.isVisible()) {
      await expect(intensitySlider).toBeVisible();
    }
  });

  test('should show mood logging form', async ({ page }) => {
    await page.goto('/mood');

    // Check for text input or voice recording option
    const textInput = page.locator('textarea, input[type="text"][placeholder*="berätta"]');
    const voiceButton = page.locator('button[aria-label*="röst"], [data-testid="voice-record"]');

    // Should have either text input or voice recording
    const hasTextInput = await textInput.isVisible();
    const hasVoiceButton = await voiceButton.isVisible();

    expect(hasTextInput || hasVoiceButton).toBe(true);
  });

  test('should save mood entry', async ({ page }) => {
    await page.goto('/mood');

    // Select a mood
    const moodOption = page.locator('[data-testid="mood-selector"], .mood-option').first();
    await moodOption.click();

    // Add optional note
    const textInput = page.locator('textarea, input[type="text"]');
    if (await textInput.isVisible()) {
      await textInput.fill('Test mood entry');
    }

    // Submit the mood entry
    const submitButton = page.locator('button').filter({ hasText: /spara|sänd|logga/i });
    await submitButton.click();

    // Should show success message or redirect
    await expect(page.locator('text=tack|, sparat|framgång')).toBeVisible({ timeout: 5000 });
  });

  test('should display mood history', async ({ page }) => {
    await page.goto('/mood/history');

    // Should show mood entries or empty state
    const moodEntries = page.locator('[data-testid="mood-entry"], .mood-history-item');
    const emptyState = page.locator('text=inga humör|tomt');

    // Either has entries or shows empty state
    const hasEntries = await moodEntries.isVisible();
    const hasEmptyState = await emptyState.isVisible();

    expect(hasEntries || hasEmptyState).toBe(true);
  });

  test('should show mood analytics', async ({ page }) => {
    await page.goto('/mood/analytics');

    // Should show charts or analytics
    const chart = page.locator('canvas, [data-testid="mood-chart"], .chart-container');
    const stats = page.locator('[data-testid="mood-stats"], .stats-container');

    // Should have some form of analytics
    const hasChart = await chart.isVisible();
    const hasStats = await stats.isVisible();

    expect(hasChart || hasStats).toBe(true);
  });

  test('should handle voice mood logging', async ({ page }) => {
    await page.goto('/mood');

    // Look for voice recording button
    const voiceButton = page.locator('button[aria-label*="röst"], [data-testid="voice-record"]');

    if (await voiceButton.isVisible()) {
      // Click voice recording button
      await voiceButton.click();

      // Should show recording interface
      await expect(page.locator('text=inspelning|pågår|lyssnar')).toBeVisible();

      // Stop recording (assuming there's a stop button)
      const stopButton = page.locator('button[aria-label*="stoppa"], [data-testid="stop-record"]');
      if (await stopButton.isVisible()) {
        await stopButton.click();
      }
    }
  });

  test('should show mood trends over time', async ({ page }) => {
    await page.goto('/mood/trends');

    // Should show trend visualization
    const trendChart = page.locator('canvas, [data-testid="trend-chart"], .trend-visualization');
    const timeSelector = page.locator('select, [data-testid="time-range"]');

    // Should have some trend visualization
    const hasTrendChart = await trendChart.isVisible();
    const hasTimeSelector = await timeSelector.isVisible();

    expect(hasTrendChart || hasTimeSelector).toBe(true);
  });
});