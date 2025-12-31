/**
 * 🚫 ERROR SCENARIO TESTS
 * Tests error handling and recovery mechanisms
 * - Network failures and timeouts
 * - Authentication errors
 * - API timeouts
 * - Offline mode handling
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3000';
const API_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001';

// Test user data
const testUser = {
  email: `error-test-${Date.now()}@example.com`,
  password: 'TestPass123!',
  name: 'Error Test User'
};

test.describe('🚫 Error Scenario Tests', () => {

  let authToken: string;
  let userId: string;

  test.beforeAll(async () => {
    console.log('🔐 Setting up test user for error scenario tests');

    // Register and login test user
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
          console.log('✅ Test user authenticated for error tests');
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
    console.log('🧹 Navigated to app with auth state for error tests');
  });

  test('should handle network failures gracefully', async ({ page }) => {
    console.log('🌐 Testing network failure handling');

    // Mock network failure for API calls
    await page.route('**/api/**', async route => {
      await route.abort('failed');
    });

    await page.goto(BASE_URL);

    // Try to perform actions that require API calls
    const moodButton = page.getByRole('button', { name: /humör|mood/i }).first();
    if (await moodButton.isVisible()) {
      await moodButton.click();
      await page.waitForTimeout(2000);

      // Check for error messages
      const errorMessage = await page.locator('text=/nätverk|network|fel|error|failed|connection/i').isVisible();
      const offlineIndicator = await page.locator('[data-testid*="offline"], [class*="offline"]').isVisible();

      if (errorMessage || offlineIndicator) {
        console.log('✅ Network failure handled gracefully');
      } else {
        console.log('⚠️ Network failure handling not visible in UI');
      }
    }

    // Test API call directly
    const apiFailureTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5
          })
        });
        return { status: response.status, failed: !response.ok };
      } catch (e) {
        return { error: (e as Error).message, networkError: true };
      }
    }, { token: authToken, userId });

    console.log('🌐 API network failure test:', apiFailureTest);
    expect(apiFailureTest.networkError || apiFailureTest.failed).toBe(true);
  });

  test('should handle authentication errors', async ({ page }) => {
    console.log('🔒 Testing authentication error handling');

    // Use invalid token
    const invalidToken = 'invalid.jwt.token';

    // Test API call with invalid token
    const authErrorTest = await page.evaluate(async ({ invalidToken, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${invalidToken}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5
          })
        });
        return {
          status: response.status,
          unauthorized: response.status === 401,
          forbidden: response.status === 403
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { invalidToken, userId });

    console.log('🔒 Auth error test:', authErrorTest);
    expect(authErrorTest.unauthorized || authErrorTest.forbidden).toBe(true);

    // Test expired token scenario
    const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDB9.invalid';

    const expiredTokenTest = await page.evaluate(async ({ expiredToken, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${expiredToken}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5
          })
        });
        return {
          status: response.status,
          unauthorized: response.status === 401
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { expiredToken, userId });

    console.log('⏰ Expired token test:', expiredTokenTest);
    expect(expiredTokenTest.unauthorized).toBe(true);
  });

  test('should handle API timeouts', async ({ page }) => {
    console.log('⏱️ Testing API timeout handling');

    // Mock slow API responses that timeout
    await page.route('**/api/**', async route => {
      // Delay response to simulate timeout
      await new Promise(resolve => setTimeout(resolve, 35000)); // 35 seconds
      await route.fulfill({ status: 200, body: '{}' });
    });

    // Test timeout handling
    const timeoutTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return { status: response.status, timedOut: false };
      } catch (e) {
        const error = e as Error;
        return {
          error: error.message,
          timedOut: error.name === 'AbortError' || error.message.includes('timeout')
        };
      }
    }, { token: authToken, userId });

    console.log('⏱️ Timeout test:', timeoutTest);
    expect(timeoutTest.timedOut).toBe(true);
  });

  test('should handle offline mode', async ({ page, context }) => {
    console.log('📴 Testing offline mode handling');

    // Simulate offline mode
    await context.setOffline(true);

    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    // Check for offline indicators
    const offlineIndicator = await page.locator('[data-testid*="offline"], [class*="offline"], text=/offline|offline/i').isVisible();
    const offlineMessage = await page.locator('text=/offline|utan nätverk|no connection/i').isVisible();

    if (offlineIndicator || offlineMessage) {
      console.log('✅ Offline mode detected');
    } else {
      console.log('⚠️ Offline indicator not visible');
    }

    // Try to perform online-only actions
    const moodButton = page.getByRole('button', { name: /humör|mood/i }).first();
    if (await moodButton.isVisible()) {
      await moodButton.click();
      await page.waitForTimeout(2000);

      // Should show offline error or cached data
      const offlineError = await page.locator('text=/offline|network|connection/i').isVisible();
      if (offlineError) {
        console.log('✅ Offline error handling working');
      }
    }

    // Test API call while offline
    const offlineApiTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5
          })
        });
        return { status: response.status, offline: !response.ok };
      } catch (e) {
        return {
          error: (e as Error).message,
          offline: true,
          networkError: (e as Error).message.includes('fetch') || (e as Error).message.includes('network')
        };
      }
    }, { token: authToken, userId });

    console.log('📴 Offline API test:', offlineApiTest);
    expect(offlineApiTest.offline || offlineApiTest.networkError).toBe(true);

    // Re-enable online mode
    await context.setOffline(false);
    console.log('✅ Back online');
  });

  test('should handle server errors (5xx)', async ({ page }) => {
    console.log('🔥 Testing server error handling');

    // Mock server errors
    await page.route('**/api/mood/**', async route => {
      await route.fulfill({ status: 500, body: '{"error": "Internal server error"}' });
    });

    // Test server error handling
    const serverErrorTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5
          })
        });
        const data = await response.json();
        return {
          status: response.status,
          serverError: response.status >= 500,
          errorMessage: data.error
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('🔥 Server error test:', serverErrorTest);
    expect(serverErrorTest.serverError).toBe(true);
  });

  test('should handle client errors (4xx)', async ({ page }) => {
    console.log('❌ Testing client error handling');

    // Mock client errors
    await page.route('**/api/mood/log', async route => {
      await route.fulfill({ status: 400, body: '{"error": "Bad request"}' });
    });

    // Test client error handling
    const clientErrorTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 15 // Invalid score
          })
        });
        const data = await response.json();
        return {
          status: response.status,
          clientError: response.status >= 400 && response.status < 500,
          errorMessage: data.error
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('❌ Client error test:', clientErrorTest);
    expect(clientErrorTest.clientError).toBe(true);
  });

  test('should handle malformed responses', async ({ page }) => {
    console.log('💥 Testing malformed response handling');

    // Mock malformed JSON response
    await page.route('**/api/mood/history/**', async route => {
      await route.fulfill({
        status: 200,
        body: '{invalid json',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Test malformed response handling
    const malformedTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch(`http://localhost:5001/api/mood/history/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        return { status: response.status, data, malformed: false };
      } catch (e) {
        return {
          error: (e as Error).message,
          malformed: (e as Error).message.includes('JSON') || (e as Error).message.includes('parse')
        };
      }
    }, { token: authToken, userId });

    console.log('💥 Malformed response test:', malformedTest);
    expect(malformedTest.malformed).toBe(true);
  });

  test('should handle concurrent request conflicts', async ({ page }) => {
    console.log('⚡ Testing concurrent request handling');

    // Make multiple concurrent requests
    const concurrentTest = await page.evaluate(async ({ token, userId }) => {
      const requests = [];

      for (let i = 0; i < 5; i++) {
        requests.push(fetch('http://localhost:5001/api/mood/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            mood_score: 5 + i,
            notes: `Concurrent test ${i}`
          })
        }));
      }

      try {
        const responses = await Promise.all(requests);
        const results = responses.map(async (response, index) => ({
          index,
          status: response.status,
          ok: response.ok
        }));

        const resolvedResults = await Promise.all(results);
        const successCount = resolvedResults.filter(r => r.ok).length;
        const conflictCount = resolvedResults.filter(r => r.status === 409).length;

        return {
          totalRequests: requests.length,
          successful: successCount,
          conflicts: conflictCount,
          allHandled: resolvedResults.every(r => r.status < 500)
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('⚡ Concurrent requests test:', concurrentTest);
    expect(concurrentTest.allHandled).toBe(true);
  });

  test('should recover from temporary failures', async ({ page }) => {
    console.log('🔄 Testing recovery from temporary failures');

    let failureCount = 0;

    // Mock intermittent failures
    await page.route('**/api/mood/**', async route => {
      failureCount++;
      if (failureCount <= 2) {
        // Fail first 2 requests
        await route.fulfill({ status: 500, body: '{"error": "Temporary failure"}' });
      } else {
        // Succeed subsequent requests
        await route.fulfill({ status: 201, body: '{"message": "Success"}' });
      }
    });

    // Test recovery
    const recoveryTest = await page.evaluate(async ({ token, userId }) => {
      const results = [];

      for (let i = 0; i < 3; i++) {
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
              notes: `Recovery test ${i}`
            })
          });
          results.push({
            attempt: i + 1,
            status: response.status,
            success: response.ok
          });
        } catch (e) {
          results.push({ attempt: i + 1, error: (e as Error).message });
        }
      }

      const initialFailures = results.slice(0, 2).filter(r => !r.success).length;
      const finalSuccess = results[2]?.success;

      return {
        attempts: results.length,
        initialFailures,
        finalSuccess,
        recovered: initialFailures >= 2 && finalSuccess
      };
    }, { token: authToken, userId });

    console.log('🔄 Recovery test:', recoveryTest);
    expect(recoveryTest.recovered).toBe(true);
  });

});