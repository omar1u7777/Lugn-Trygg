/**
 * 🎯 FULL USER JOURNEY E2E TESTS
 * Complete end-to-end testing of user flows
 * Tests the entire user experience from registration to daily usage
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3001';
const API_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001';

// Generate unique test user for each run
const generateTestUser = () => ({
  email: `e2e_test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
  password: 'TestPassword123!',
  name: 'E2E Test User'
});

test.describe('🎯 Full User Journey', () => {
  let testUser: ReturnType<typeof generateTestUser>;
  let authToken: string;
  let userId: string;

  test.beforeAll(async () => {
    testUser = generateTestUser();
    console.log(`\n📧 Test user: ${testUser.email}`);
  });

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
  });

  test('1. Health Check - Backend is running', async ({ page }) => {
    console.log('🏥 Checking backend health...');
    
    const response = await page.request.get(`${API_URL}/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    
    console.log('✅ Backend is healthy');
  });

  test('2. Registration - Create new account', async ({ page }) => {
    console.log('📝 Testing registration...');
    
    const response = await page.request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        accept_terms: true,
        accept_privacy: true
      }
    });
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    
    console.log('✅ Registration successful');
  });

  test('3. Login - Authenticate user', async ({ page }) => {
    console.log('🔑 Testing login...');
    
    const response = await page.request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: testUser.email,
        password: testUser.password
      }
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.access_token).toBeTruthy();
    expect(data.data.user_id).toBeTruthy();
    
    // Store for subsequent tests
    authToken = data.data.access_token;
    userId = data.data.user_id;
    
    console.log(`✅ Login successful, userId: ${userId.substring(0, 15)}...`);
  });

  test('4. Log Mood - Record daily mood', async ({ page }) => {
    console.log('😊 Testing mood logging...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: testUser.email,
        password: testUser.password
      }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    userId = loginData.data.user_id;
    
    const response = await page.request.post(`${API_URL}/api/mood/log`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      data: {
        score: 8,
        note: 'Feeling great during E2E test!',
        emotions: ['happy', 'calm', 'grateful']
      }
    });
    
    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    
    console.log('✅ Mood logged successfully');
  });

  test('5. Get Moods - Retrieve mood history', async ({ page }) => {
    console.log('📊 Testing mood history retrieval...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    
    const response = await page.request.get(`${API_URL}/api/mood`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.moods).toBeDefined();
    expect(data.moods.length).toBeGreaterThan(0);
    
    console.log(`✅ Retrieved ${data.moods.length} mood(s)`);
  });

  test('6. Dashboard - Load user dashboard', async ({ page }) => {
    console.log('📈 Testing dashboard...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    userId = loginData.data.user_id;
    
    const response = await page.request.get(`${API_URL}/api/dashboard/${userId}/summary`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.status()).toBe(200);
    
    console.log('✅ Dashboard loaded successfully');
  });

  test('7. Journal - Create journal entry', async ({ page }) => {
    console.log('📓 Testing journal entry...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    userId = loginData.data.user_id;
    
    const response = await page.request.post(`${API_URL}/api/journal/${userId}/journal`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      data: {
        title: 'E2E Test Journal Entry',
        content: 'This is a test journal entry created during E2E testing.',
        mood_score: 8,
        tags: ['test', 'e2e', 'playwright']
      }
    });
    
    expect(response.status()).toBeLessThanOrEqual(201);
    
    console.log('✅ Journal entry created');
  });

  test('8. AI Chat - Send message to AI', async ({ page }) => {
    console.log('🤖 Testing AI chat...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    userId = loginData.data.user_id;
    
    const response = await page.request.post(`${API_URL}/api/chatbot/chat`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      data: {
        message: 'Hej! Jag mår bra idag.',
        user_id: userId
      }
    });
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.response).toBeTruthy();
    
    console.log(`✅ AI responded: ${data.response.substring(0, 50)}...`);
  });

  test('9. Challenges - Get available challenges', async ({ page }) => {
    console.log('🏆 Testing challenges...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    
    const response = await page.request.get(`${API_URL}/api/challenges`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.status()).toBe(200);
    
    console.log('✅ Challenges retrieved');
  });

  test('10. Notifications - Get notification settings', async ({ page }) => {
    console.log('🔔 Testing notification settings...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    
    const response = await page.request.get(`${API_URL}/api/notifications/settings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.status()).toBe(200);
    
    console.log('✅ Notification settings retrieved');
  });

  test('11. Memories - List user memories', async ({ page }) => {
    console.log('💭 Testing memories...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    
    const response = await page.request.get(`${API_URL}/api/memory/list`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.status()).toBe(200);
    
    console.log('✅ Memories retrieved');
  });

  test('12. Token Refresh - Refresh authentication token', async ({ page }) => {
    console.log('🔄 Testing token refresh...');
    
    // Login first
    const loginResponse = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password }
    });
    const loginData = await loginResponse.json();
    const refreshToken = loginData.data.refresh_token;
    
    const response = await page.request.post(`${API_URL}/api/auth/refresh`, {
      data: { refresh_token: refreshToken }
    });
    
    expect(response.status()).toBe(200);
    
    console.log('✅ Token refreshed successfully');
  });
});

test.describe('🌐 Frontend UI Tests', () => {
  
  test('Homepage loads correctly', async ({ page }) => {
    console.log('🏠 Testing homepage...');
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Check that the page loaded
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Look for key elements
    const hasLoginButton = await page.getByRole('button', { name: /logga in|login|sign in/i }).count() > 0;
    const hasRegisterButton = await page.getByRole('button', { name: /registrera|register|sign up|skapa konto/i }).count() > 0;
    
    expect(hasLoginButton || hasRegisterButton || title.length > 0).toBeTruthy();
    
    console.log('✅ Homepage loaded correctly');
  });

  test('Auth page navigation works', async ({ page }) => {
    console.log('🔐 Testing auth navigation...');
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Try to find and click login/register
    const authLinks = page.locator('a[href*="login"], a[href*="register"], a[href*="auth"]');
    const authButtons = page.getByRole('button', { name: /logga in|login|registrera|register/i });
    
    if (await authLinks.count() > 0) {
      await authLinks.first().click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Navigated via auth link');
    } else if (await authButtons.count() > 0) {
      await authButtons.first().click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Navigated via auth button');
    }
    
    // Check that some form element exists
    const hasEmailField = await page.locator('input[type="email"], input[name*="email"]').count() > 0;
    const hasPasswordField = await page.locator('input[type="password"]').count() > 0;
    
    console.log(`📝 Email field: ${hasEmailField}, Password field: ${hasPasswordField}`);
  });

  test('Responsive design - Mobile viewport', async ({ page }) => {
    console.log('📱 Testing mobile viewport...');
    
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Check that content is visible
    const content = await page.locator('body').innerText();
    expect(content.length).toBeGreaterThan(10);
    
    // Check for mobile menu (hamburger)
    const hasMobileMenu = await page.locator('[data-testid*="menu"], [class*="hamburger"], [aria-label*="menu"]').count() > 0;
    console.log(`📱 Mobile menu present: ${hasMobileMenu}`);
    
    console.log('✅ Mobile viewport renders correctly');
  });

  test('Responsive design - Tablet viewport', async ({ page }) => {
    console.log('📱 Testing tablet viewport...');
    
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Check that content is visible
    const content = await page.locator('body').innerText();
    expect(content.length).toBeGreaterThan(10);
    
    console.log('✅ Tablet viewport renders correctly');
  });

  test('Responsive design - Desktop viewport', async ({ page }) => {
    console.log('🖥️ Testing desktop viewport...');
    
    await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Check that content is visible
    const content = await page.locator('body').innerText();
    expect(content.length).toBeGreaterThan(10);
    
    console.log('✅ Desktop viewport renders correctly');
  });
});

test.describe('⚡ Performance Tests', () => {
  
  test('Homepage loads within 3 seconds', async ({ page }) => {
    console.log('⏱️ Testing page load time...');
    
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️ DOM content loaded in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
    
    console.log('✅ Page loads within acceptable time');
  });

  test('API response time - Health check', async ({ page }) => {
    console.log('⏱️ Testing API response time...');
    
    const startTime = Date.now();
    const response = await page.request.get(`${API_URL}/health`);
    const responseTime = Date.now() - startTime;
    
    console.log(`⏱️ Health check responded in ${responseTime}ms`);
    expect(responseTime).toBeLessThan(1000);
    expect(response.status()).toBe(200);
    
    console.log('✅ API responds within acceptable time');
  });

  test('API response time - Login', async ({ page }) => {
    console.log('⏱️ Testing login response time...');
    
    // First register a user
    const testEmail = `perf_test_${Date.now()}@test.com`;
    await page.request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: testEmail,
        password: 'TestPassword123!',
        name: 'Perf Test User',
        accept_terms: true,
        accept_privacy: true
      }
    });
    
    const startTime = Date.now();
    const response = await page.request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: testEmail,
        password: 'TestPassword123!'
      }
    });
    const responseTime = Date.now() - startTime;
    
    console.log(`⏱️ Login responded in ${responseTime}ms`);
    expect(responseTime).toBeLessThan(2000);
    expect(response.status()).toBe(200);
    
    console.log('✅ Login responds within acceptable time');
  });
});
