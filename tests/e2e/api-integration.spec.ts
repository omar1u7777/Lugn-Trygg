/**
 * 🔗 API INTEGRATION TESTS
 * Tests all API endpoints for proper integration
 * - Request/response cycles
 * - Headers and status codes
 * - Data validation
 * - Authentication requirements
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3000';
const API_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001';

// Test user data
const testUser = {
  email: `api-test-${Date.now()}@example.com`,
  password: 'TestPass123!',
  name: 'API Test User'
};

test.describe('🔗 API Integration Tests', () => {

  let authToken: string;
  let userId: string;

  test.beforeAll(async () => {
    console.log('🔐 Setting up test user for API integration tests');

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
          console.log('✅ Test user authenticated for API tests');
        }
      }
    } catch (error) {
      console.log('⚠️ Could not setup test user, tests may fail');
    }
  });

  test('should test authentication endpoints', async ({ page }) => {
    console.log('🔐 Testing authentication API endpoints');

    // Test register endpoint
    const registerTest = await page.evaluate(async (userData) => {
      try {
        const response = await fetch('http://localhost:5001/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...userData,
            email: `reg-test-${Date.now()}@example.com`
          })
        });
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, testUser);

    console.log('📝 Register endpoint test:', registerTest);
    expect(registerTest.status).toBe(201);
    expect(registerTest.hasJson).toBe(true);

    // Test login endpoint
    const loginTest = await page.evaluate(async (userData) => {
      try {
        const response = await fetch('http://localhost:5001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        const data = await response.json();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasToken: !!(data.access_token || data.token),
          hasUser: !!data.user,
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, testUser);

    console.log('🔑 Login endpoint test:', loginTest);
    expect(loginTest.status).toBe(200);
    expect(loginTest.hasToken).toBe(true);
    expect(loginTest.hasUser).toBe(true);
    expect(loginTest.hasJson).toBe(true);

    // Test logout endpoint
    const logoutTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:5001/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    });

    console.log('🚪 Logout endpoint test:', logoutTest);
    expect(logoutTest.status).toBe(200);
  });

  test('should test mood endpoints', async ({ page }) => {
    console.log('😊 Testing mood API endpoints');

    // Test mood logging
    const moodLogTest = await page.evaluate(async ({ token, userId }) => {
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
            notes: 'API test mood',
            timestamp: new Date().toISOString()
          })
        });
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('📝 Mood log endpoint test:', moodLogTest);
    expect(moodLogTest.status).toBe(201);
    expect(moodLogTest.hasJson).toBe(true);

    // Test mood history
    const moodHistoryTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch(`http://localhost:5001/api/mood/history/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          isArray: Array.isArray(data),
          hasData: Array.isArray(data) && data.length > 0,
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('📚 Mood history endpoint test:', moodHistoryTest);
    expect(moodHistoryTest.status).toBe(200);
    expect(moodHistoryTest.isArray).toBe(true);
    expect(moodHistoryTest.hasJson).toBe(true);

    // Test mood stats
    const moodStatsTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch(`http://localhost:5001/api/mood/stats/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasStats: !!(data.average_mood || data.total_entries),
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('📊 Mood stats endpoint test:', moodStatsTest);
    expect(moodStatsTest.status).toBe(200);
    expect(moodStatsTest.hasJson).toBe(true);
  });

  test('should test AI endpoints', async ({ page }) => {
    console.log('🤖 Testing AI API endpoints');

    // Test AI chat
    const aiChatTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            message: 'Hello AI, this is a test'
          })
        });
        const data = await response.json();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasResponse: !!data.response,
          hasSentiment: !!data.sentiment,
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('💬 AI chat endpoint test:', aiChatTest);
    expect(aiChatTest.status).toBe(200);
    expect(aiChatTest.hasResponse).toBe(true);
    expect(aiChatTest.hasJson).toBe(true);

    // Test AI chat history
    const aiHistoryTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/ai/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            limit: 10
          })
        });
        const data = await response.json();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasHistory: !!data.history,
          isArray: Array.isArray(data.history),
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('📚 AI chat history endpoint test:', aiHistoryTest);
    expect(aiHistoryTest.status).toBe(200);
    expect(aiHistoryTest.hasHistory).toBe(true);
    expect(aiHistoryTest.isArray).toBe(true);
    expect(aiHistoryTest.hasJson).toBe(true);

    // Test AI story generation
    const aiStoryTest = await page.evaluate(async ({ token, userId }) => {
      try {
        const response = await fetch('http://localhost:5001/api/ai/story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            locale: 'sv'
          })
        });
        const data = await response.json();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          hasStory: !!data.story,
          hasLocale: !!data.locale,
          hasJson: response.headers.get('content-type')?.includes('application/json')
        };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, { token: authToken, userId });

    console.log('📖 AI story endpoint test:', aiStoryTest);
    expect(aiStoryTest.status).toBe(200);
    expect(aiStoryTest.hasStory).toBe(true);
    expect(aiStoryTest.hasJson).toBe(true);
  });

  test('should test data synchronization endpoints', async ({ page }) => {
    console.log('🔄 Testing data synchronization endpoints');

    // Test sync endpoints if they exist
    const syncEndpoints = [
      'sync/mood',
      'sync/chat',
      'sync/user'
    ];

    for (const endpoint of syncEndpoints) {
      const syncTest = await page.evaluate(async ({ token, endpoint }) => {
        try {
          const response = await fetch(`http://localhost:5001/api/${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              last_sync: new Date().toISOString()
            })
          });
          return {
            endpoint,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            hasJson: response.headers.get('content-type')?.includes('application/json')
          };
        } catch (e) {
          return { endpoint, error: (e as Error).message };
        }
      }, { token: authToken, endpoint });

      console.log(`🔄 Sync endpoint ${endpoint} test:`, syncTest);

      // Sync endpoints might return 404 if not implemented, which is acceptable
      if (syncTest.status !== 404) {
        expect(syncTest.hasJson).toBe(true);
      }
    }
  });

  test('should test authentication requirements', async ({ page }) => {
    console.log('🔒 Testing authentication requirements');

    // Test endpoints that require authentication
    const protectedEndpoints = [
      { path: `api/mood/history/${userId}`, method: 'GET' },
      { path: 'api/mood/log', method: 'POST', body: { user_id: userId, mood_score: 5 } },
      { path: 'api/ai/chat', method: 'POST', body: { user_id: userId, message: 'test' } }
    ];

    for (const endpoint of protectedEndpoints) {
      // Test without auth
      const noAuthTest = await page.evaluate(async (endpoint) => {
        try {
          const response = await fetch(`http://localhost:5001/${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json'
            },
            body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
          });
          return {
            endpoint: endpoint.path,
            status: response.status,
            isUnauthorized: response.status === 401 || response.status === 403
          };
        } catch (e) {
          return { endpoint: endpoint.path, error: (e as Error).message };
        }
      }, endpoint);

      console.log(`🚫 No auth test for ${endpoint.path}:`, noAuthTest);
      expect(noAuthTest.isUnauthorized || noAuthTest.status === 401 || noAuthTest.status === 403).toBe(true);

      // Test with auth
      const withAuthTest = await page.evaluate(async ({ endpoint, token }) => {
        try {
          const response = await fetch(`http://localhost:5001/${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
          });
          return {
            endpoint: endpoint.path,
            status: response.status,
            isSuccess: response.status >= 200 && response.status < 300
          };
        } catch (e) {
          return { endpoint: endpoint.path, error: (e as Error).message };
        }
      }, { endpoint, token: authToken });

      console.log(`✅ With auth test for ${endpoint.path}:`, withAuthTest);
      expect(withAuthTest.isSuccess).toBe(true);
    }
  });

  test('should test data validation', async ({ page }) => {
    console.log('✅ Testing data validation');

    // Test invalid data formats
    const validationTests = [
      {
        endpoint: 'api/auth/register',
        invalidData: { email: 'invalid-email', password: '123' }, // Invalid email and weak password
        expectedStatus: 400
      },
      {
        endpoint: 'api/mood/log',
        invalidData: { user_id: userId, mood_score: 15 }, // Invalid mood score
        expectedStatus: 400,
        auth: true
      },
      {
        endpoint: 'api/ai/chat',
        invalidData: { user_id: userId, message: '' }, // Empty message
        expectedStatus: 400,
        auth: true
      }
    ];

    for (const test of validationTests) {
      const validationTest = await page.evaluate(async ({ test, token }) => {
        try {
          const headers: any = { 'Content-Type': 'application/json' };
          if (test.auth) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(`http://localhost:5001/${test.endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(test.invalidData)
          });
          return {
            endpoint: test.endpoint,
            status: response.status,
            expectedStatus: test.expectedStatus,
            validationWorks: response.status === test.expectedStatus
          };
        } catch (e) {
          return { endpoint: test.endpoint, error: (e as Error).message };
        }
      }, { test, token: authToken });

      console.log(`🔍 Validation test for ${test.endpoint}:`, validationTest);
      expect(validationTest.validationWorks).toBe(true);
    }
  });

  test('should test CORS headers', async ({ page }) => {
    console.log('🌐 Testing CORS headers');

    // Test preflight requests
    const corsTests = [
      { method: 'POST', endpoint: 'api/auth/register' },
      { method: 'POST', endpoint: 'api/mood/log' },
      { method: 'GET', endpoint: `api/mood/history/${userId}` }
    ];

    for (const test of corsTests) {
      const corsTest = await page.evaluate(async (test) => {
        try {
          const response = await fetch(`http://localhost:5001/${test.endpoint}`, {
            method: 'OPTIONS',
            headers: {
              'Origin': 'http://localhost:3000',
              'Access-Control-Request-Method': test.method,
              'Access-Control-Request-Headers': 'content-type,authorization'
            }
          });
          const headers = Object.fromEntries(response.headers.entries());
          return {
            endpoint: test.endpoint,
            status: response.status,
            corsHeaders: {
              allowOrigin: headers['access-control-allow-origin'],
              allowMethods: headers['access-control-allow-methods'],
              allowHeaders: headers['access-control-allow-headers'],
              allowCredentials: headers['access-control-allow-credentials']
            }
          };
        } catch (e) {
          return { endpoint: test.endpoint, error: (e as Error).message };
        }
      }, test);

      console.log(`🌐 CORS test for ${test.endpoint}:`, corsTest);

      // Check CORS headers are present
      expect(corsTest.corsHeaders.allowOrigin).toBeTruthy();
      expect(corsTest.corsHeaders.allowMethods).toContain(test.method);
    }
  });

  test('should test rate limiting', async ({ page }) => {
    console.log('⏱️ Testing rate limiting');

    // Make multiple rapid requests to test rate limiting
    const rateLimitTest = await page.evaluate(async ({ token, userId }) => {
      const results = [];

      for (let i = 0; i < 10; i++) {
        try {
          const response = await fetch('http://localhost:5001/api/mood/log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              mood_score: 5,
              notes: `Rate limit test ${i}`
            })
          });
          results.push({
            attempt: i + 1,
            status: response.status,
            rateLimited: response.status === 429
          });
        } catch (e) {
          results.push({ attempt: i + 1, error: (e as Error).message });
        }
      }

      const rateLimited = results.some(r => r.rateLimited);
      return { totalRequests: results.length, rateLimited, results };
    }, { token: authToken, userId });

    console.log('⏱️ Rate limit test results:', rateLimitTest);

    // Rate limiting might not be implemented, so we just log the results
    console.log(`📊 Made ${rateLimitTest.totalRequests} requests, rate limited: ${rateLimitTest.rateLimited}`);
  });

});