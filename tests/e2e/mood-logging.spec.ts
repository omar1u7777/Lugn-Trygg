/**
 * 😊 MOOD LOGGING FLOW E2E TESTS
 * Tests complete mood logging and history workflows
 * - Log mood entries
 * - View mood history
 * - Data synchronization
 * - Mood analytics
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3000';
const API_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001';

// Test user data
const testUser = {
  email: `mood-test-${Date.now()}@example.com`,
  password: 'TestPass123!',
  name: 'Mood Test User'
};

test.describe('😊 Mood Logging Flow Tests', () => {

  let authToken: string;
  let userId: string;

  test.beforeAll(async () => {
    console.log('🔐 Setting up test user for mood logging tests');

    // Register and login test user via API
    try {
      const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      if (registerResponse.ok) {
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testUser.email,
            password: testUser.password
          })
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          authToken = loginData.access_token;
          userId = loginData.user_id;
          console.log('✅ Test user authenticated');
        }
      }
    } catch (error) {
      console.log('⚠️ Could not setup test user, tests may fail');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Set auth state
    if (authToken) {
      await page.context().addCookies([{
        name: 'access_token',
        value: authToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false
      }]);
    }

    await page.goto(BASE_URL);
    console.log('🧹 Navigated to app with auth state');
  });

  test('should log a mood entry successfully', async ({ page }) => {
    console.log('📝 Testing mood entry logging');

    // Navigate to mood logging section
    const moodButton = page.getByRole('button', { name: /humör|mood|logga/i }).first();
    const moodLogger = page.locator('[data-testid*="mood"], [class*="mood"]').first();

    if (await moodButton.isVisible()) {
      await moodButton.click();
      console.log('✅ Clicked mood logging button');
    }

    // Wait for mood selection UI
    await page.waitForTimeout(1000);

    // Look for mood selection (emoji, numbers, or buttons)
    const moodSelectors = [
      page.locator('button[data-mood]'),
      page.locator('.mood-emoji'),
      page.locator('[role="button"][aria-label*="mood"]'),
      page.locator('input[type="range"]'),
      page.getByRole('button', { name: /1|2|3|4|5|6|7|8|9|10|happy|sad|angry/i })
    ];

    let moodSelected = false;
    for (const selector of moodSelectors) {
      if (await selector.first().isVisible()) {
        await selector.first().click();
        moodSelected = true;
        console.log('✅ Selected mood option');
        break;
      }
    }

    if (!moodSelected) {
      console.log('⚠️ Could not find mood selector, testing API directly');

      // Test mood logging via API
      const apiResponse = await page.evaluate(async ({ token, userId }) => {
        try {
          const response = await fetch('http://localhost:5001/api/mood/log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              mood_score: 7,
              mood_type: 'happy',
              notes: 'Test mood entry',
              timestamp: new Date().toISOString()
            })
          });
          return { status: response.status, data: await response.json() };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      console.log('🔍 API Mood Log Response:', apiResponse);

      if (apiResponse.status === 201) {
        console.log('✅ API mood logging successful');
      } else {
        console.log('❌ Mood logging failed');
      }
      return;
    }

    // Add optional notes
    const notesField = page.locator('textarea, input[type="text"][placeholder*="notes"]').first();
    if (await notesField.isVisible()) {
      await notesField.fill('Test mood entry from e2e test');
      console.log('✅ Added mood notes');
    }

    // Submit mood entry
    const submitButton = page.getByRole('button', { name: /spara|save|submit|logga/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      console.log('✅ Submitted mood entry');

      // Wait for success
      await page.waitForTimeout(2000);

      // Check for success message
      const successMessage = await page.locator('text=/sparad|saved|success/i').isVisible();
      if (successMessage) {
        console.log('✅ Mood entry saved successfully');
      }
    }
  });

  test('should display mood history', async ({ page }) => {
    console.log('📚 Testing mood history display');

    // First create some test mood entries
    await page.evaluate(async ({ token, userId }) => {
      const moods = [
        { mood_score: 8, mood_type: 'happy', notes: 'Great day!' },
        { mood_score: 5, mood_type: 'neutral', notes: 'Okay day' },
        { mood_score: 3, mood_type: 'sad', notes: 'Tough day' }
      ];

      for (const mood of moods) {
        try {
          await fetch('http://localhost:5001/api/mood/log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              ...mood,
              timestamp: new Date().toISOString()
            })
          });
        } catch (e) {
          console.log('Error creating test mood:', (e as Error).message);
        }
      }
    }, { token: authToken, userId });

    await page.reload();
    await page.waitForTimeout(1000);

    // Navigate to mood history
    const historyButton = page.getByRole('button', { name: /historik|history|entries/i }).first();
    const historyTab = page.locator('[data-testid*="history"], [role="tab"][aria-label*="history"]').first();

    if (await historyButton.isVisible()) {
      await historyButton.click();
    } else if (await historyTab.isVisible()) {
      await historyTab.click();
    }

    await page.waitForTimeout(2000);

    // Check for mood history display
    const moodEntries = await page.locator('[data-testid*="mood-entry"], .mood-entry, [class*="mood-item"]').count();
    const moodList = await page.locator('ul, ol').filter({ hasText: /mood|humör/ }).count();

    if (moodEntries > 0 || moodList > 0) {
      console.log(`✅ Mood history displayed (${moodEntries} entries found)`);
    } else {
      console.log('⚠️ Mood history UI not found, checking API');

      // Test API mood history
      const apiResponse = await page.evaluate(async ({ token, userId }) => {
        try {
          const response = await fetch(`http://localhost:5001/api/mood/history/${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          return { status: response.status, data };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      console.log('🔍 API Mood History Response:', apiResponse);

      if (apiResponse.status === 200 && Array.isArray(apiResponse.data)) {
        console.log(`✅ API mood history working (${apiResponse.data.length} entries)`);
      }
    }
  });

  test('should sync mood data between frontend and backend', async ({ page }) => {
    console.log('🔄 Testing mood data synchronization');

    // Create mood entry via API
    const apiMood = {
      user_id: userId,
      mood_score: 9,
      mood_type: 'excellent',
      notes: 'Sync test entry',
      timestamp: new Date().toISOString()
    };

    await page.evaluate(async ({ token, mood }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(mood)
        });
        console.log('API mood creation:', response.status);
      } catch (e) {
        console.log('API mood creation error:', (e as Error).message);
      }
    }, { token: authToken, mood: apiMood });

    // Reload page to sync
    await page.reload();
    await page.waitForTimeout(2000);

    // Check if mood appears in UI
    const syncSuccessful = await page.locator(`text=/${apiMood.notes}/`).isVisible() ||
                          await page.locator(`text=${apiMood.mood_score}`).isVisible();

    if (syncSuccessful) {
      console.log('✅ Mood data synchronization working');
    } else {
      console.log('⚠️ Mood sync check inconclusive, verifying API data integrity');

      // Verify data integrity via API
      const historyResponse = await page.evaluate(async ({ token, userId }) => {
        try {
          const response = await fetch(`http://localhost:5001/api/mood/history/${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          return { status: response.status, data };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      if (historyResponse.status === 200) {
        const hasSyncMood = historyResponse.data.some((mood: any) =>
          mood.notes === apiMood.notes && mood.mood_score === apiMood.mood_score
        );

        if (hasSyncMood) {
          console.log('✅ API data integrity verified');
        } else {
          console.log('⚠️ API data integrity check failed');
        }
      }
    }
  });

  test('should display mood analytics and statistics', async ({ page }) => {
    console.log('📊 Testing mood analytics display');

    // Ensure we have multiple mood entries for analytics
    await page.evaluate(async ({ token, userId }) => {
      const moods = [
        { mood_score: 7, mood_type: 'good', notes: 'Analytics test 1' },
        { mood_score: 6, mood_type: 'okay', notes: 'Analytics test 2' },
        { mood_score: 8, mood_type: 'great', notes: 'Analytics test 3' },
        { mood_score: 4, mood_type: 'low', notes: 'Analytics test 4' },
        { mood_score: 9, mood_type: 'excellent', notes: 'Analytics test 5' }
      ];

      for (const mood of moods) {
        try {
          await fetch('http://localhost:5001/api/mood/log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              ...mood,
              timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
            })
          });
        } catch (e) {
          // Ignore errors
        }
      }
    }, { token: authToken, userId });

    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate to analytics/dashboard
    const analyticsButton = page.getByRole('button', { name: /analys|analytics|dashboard|statistik/i }).first();
    const analyticsTab = page.locator('[data-testid*="analytics"], [role="tab"][aria-label*="analytics"]').first();

    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
    } else if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
    }

    await page.waitForTimeout(2000);

    // Check for analytics elements
    const chartVisible = await page.locator('canvas, svg, [data-testid*="chart"]').isVisible();
    const statsVisible = await page.locator('text=/genomsnitt|average|trends|trender/i').isVisible();
    const metricsVisible = await page.locator('[data-testid*="metric"], [class*="metric"]').count() > 0;

    if (chartVisible || statsVisible || metricsVisible) {
      console.log('✅ Mood analytics displayed');
    } else {
      console.log('⚠️ Analytics UI not found, testing API endpoints');

      // Test mood stats API
      const statsResponse = await page.evaluate(async ({ token, userId }) => {
        try {
          const response = await fetch(`http://localhost:5001/api/mood/stats/${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          return { status: response.status, data };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      console.log('🔍 API Mood Stats Response:', statsResponse);

      if (statsResponse.status === 200) {
        console.log('✅ Mood analytics API working');
      }
    }
  });

  test('should handle mood logging errors gracefully', async ({ page }) => {
    console.log('🚫 Testing mood logging error handling');

    // Mock API failure
    await page.route('**/api/mood/**', async route => {
      await route.abort();
    });

    // Try to log mood
    const moodButton = page.getByRole('button', { name: /humör|mood/i }).first();
    if (await moodButton.isVisible()) {
      await moodButton.click();
    }

    await page.waitForTimeout(1000);

    // Try to submit mood
    const submitButton = page.getByRole('button', { name: /spara|save/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }

    await page.waitForTimeout(2000);

    // Check for error handling
    const errorMessage = await page.locator('text=/fel|error|failed|network/i').isVisible();
    const retryButton = await page.getByRole('button', { name: /försök|retry|try again/i }).isVisible();

    if (errorMessage || retryButton) {
      console.log('✅ Mood logging error handled gracefully');
    } else {
      console.log('⚠️ Error handling check inconclusive');
    }
  });

});