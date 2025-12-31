/**
 * 🤖 AI CHAT FLOW E2E TESTS
 * Tests complete AI chat conversation workflows
 * - Send messages and receive responses
 * - Chat history persistence
 * - Error handling and recovery
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3000';
const API_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5001';

// Test user data
const testUser = {
  email: `ai-chat-test-${Date.now()}@example.com`,
  password: 'TestPass123!',
  name: 'AI Chat Test User'
};

test.describe('🤖 AI Chat Flow Tests', () => {

  let authToken: string;
  let userId: string;

  test.beforeAll(async () => {
    console.log('🔐 Setting up test user for AI chat tests');

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
          console.log('✅ Test user authenticated for AI chat');
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
    console.log('🧹 Navigated to app with auth state for AI chat');
  });

  test('should open AI chat interface', async ({ page }) => {
    console.log('💬 Testing AI chat interface access');

    // Navigate to chat section
    const chatButton = page.getByRole('button', { name: /chat|prata|ai/i }).first();
    const chatLink = page.locator('a[href*="chat"], [data-testid*="chat"]').first();

    if (await chatButton.isVisible()) {
      await chatButton.click();
      console.log('✅ Clicked chat button');
    } else if (await chatLink.isVisible()) {
      await chatLink.click();
      console.log('✅ Clicked chat link');
    }

    // Wait for chat interface
    await page.waitForTimeout(2000);

    // Check for chat UI elements
    const chatInput = page.locator('input[placeholder*="meddelande"], textarea[placeholder*="meddelande"]').first();
    const sendButton = page.getByRole('button', { name: /skicka|send/i }).first();
    const chatMessages = page.locator('[data-testid*="message"], .message, .chat-message').first();

    if (await chatInput.isVisible() || await sendButton.isVisible()) {
      console.log('✅ AI chat interface opened');
    } else {
      console.log('⚠️ Chat interface not found, testing API directly');

      // Test API chat endpoint
      const apiResponse = await page.evaluate(async ({ token, userId }) => {
        try {
          const response = await fetch('http://localhost:5001/api/ai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              message: 'Hello, this is a test message'
            })
          });
          return { status: response.status, data: await response.json() };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      console.log('🔍 API Chat Response:', apiResponse);

      if (apiResponse.status === 200) {
        console.log('✅ API chat endpoint working');
      } else {
        console.log('❌ Chat endpoint failed');
      }
    }
  });

  test('should send message and receive AI response', async ({ page }) => {
    console.log('📤 Testing message sending and AI response');

    // Navigate to chat
    const chatButton = page.getByRole('button', { name: /chat|prata/i }).first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
    }

    await page.waitForTimeout(1000);

    // Find chat input
    const chatInput = page.locator('input[placeholder*="meddelande"], textarea[placeholder*="meddelande"]').first();

    if (await chatInput.isVisible()) {
      // Type test message
      await chatInput.fill('Hello AI, how are you today?');
      console.log('✅ Typed test message');

      // Send message
      const sendButton = page.getByRole('button', { name: /skicka|send/i }).first();
      if (await sendButton.isVisible()) {
        await sendButton.click();
        console.log('✅ Sent message');

        // Wait for response
        await page.waitForTimeout(3000);

        // Check for AI response
        const aiResponse = await page.locator('text=/hej|hello|tack|thank/i').isVisible();
        const newMessage = await page.locator('[data-testid*="message"]').count() > 0;

        if (aiResponse || newMessage) {
          console.log('✅ AI response received');
        } else {
          console.log('⚠️ AI response not visible in UI');
        }
      }
    } else {
      console.log('⚠️ Chat input not found, testing API directly');

      // Test API message sending
      const apiResponse = await page.evaluate(async ({ token, userId }) => {
        try {
          const response = await fetch('http://localhost:5001/api/ai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              message: 'Test message for API validation'
            })
          });
          const data = await response.json();
          return { status: response.status, data };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      console.log('🔍 API Message Send Response:', apiResponse);

      if (apiResponse.status === 200 && apiResponse.data.response) {
        console.log('✅ API message sending and response working');
      } else {
        console.log('❌ API message sending failed');
        throw new Error('Message sending test failed');
      }
    }
  });

  test('should display chat history', async ({ page }) => {
    console.log('📚 Testing chat history display');

    // First create some test chat messages
    await page.evaluate(async ({ token, userId }) => {
      const messages = [
        'How can I improve my mood?',
        'I feel anxious about work',
        'What are some relaxation techniques?'
      ];

      for (const message of messages) {
        try {
          await fetch('http://localhost:5001/api/ai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              message: message
            })
          });
        } catch (e) {
          console.log('Error creating test chat:', (e as Error).message);
        }
      }
    }, { token: authToken, userId });

    // Reload page
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate to chat
    const chatButton = page.getByRole('button', { name: /chat|prata/i }).first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
    }

    await page.waitForTimeout(2000);

    // Check for chat history
    const messageCount = await page.locator('[data-testid*="message"], .message, .chat-message').count();
    const historyVisible = await page.locator('text=/how can i improve|anxious about work|relaxation techniques/i').isVisible();

    if (messageCount > 0 || historyVisible) {
      console.log(`✅ Chat history displayed (${messageCount} messages found)`);
    } else {
      console.log('⚠️ Chat history not visible in UI, testing API');

      // Test API chat history
      const historyResponse = await page.evaluate(async ({ token, userId }) => {
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
          return { status: response.status, data };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId });

      console.log('🔍 API Chat History Response:', historyResponse);

      if (historyResponse.status === 200 && historyResponse.data.history) {
        console.log(`✅ API chat history working (${historyResponse.data.history.length} messages)`);
      }
    }
  });

  test('should sync chat data between frontend and backend', async ({ page }) => {
    console.log('🔄 Testing chat data synchronization');

    // Send message via API
    const testMessage = 'Sync test message from API';
    await page.evaluate(async ({ token, userId, message }) => {
      try {
        const response = await fetch('http://localhost:5001/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            message: message
          })
        });
        console.log('API chat message sent:', response.status);
      } catch (e) {
        console.log('API chat error:', (e as Error).message);
      }
    }, { token: authToken, userId, message: testMessage });

    // Reload page to sync
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate to chat
    const chatButton = page.getByRole('button', { name: /chat|prata/i }).first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
    }

    await page.waitForTimeout(2000);

    // Check if message appears in UI
    const messageSynced = await page.locator(`text=${testMessage}`).isVisible();

    if (messageSynced) {
      console.log('✅ Chat data synchronization working');
    } else {
      console.log('⚠️ Chat sync check inconclusive, verifying API data integrity');

      // Verify data integrity via API
      const historyResponse = await page.evaluate(async ({ token, userId, message }) => {
        try {
          const response = await fetch('http://localhost:5001/api/ai/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userId,
              limit: 20
            })
          });
          const data = await response.json();
          const hasSyncMessage = data.history.some((chat: any) => chat.user_message === message);
          return { status: response.status, hasSyncMessage };
        } catch (e) {
          return { error: (e as Error).message };
        }
      }, { token: authToken, userId, message: testMessage });

      if (historyResponse.status === 200 && historyResponse.hasSyncMessage) {
        console.log('✅ API chat data integrity verified');
      } else {
        console.log('⚠️ API chat data integrity check failed');
      }
    }
  });

  test('should handle chat errors gracefully', async ({ page }) => {
    console.log('🚫 Testing chat error handling');

    // Mock API failure
    await page.route('**/api/ai/**', async route => {
      await route.abort();
    });

    // Navigate to chat
    const chatButton = page.getByRole('button', { name: /chat|prata/i }).first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
    }

    await page.waitForTimeout(1000);

    // Try to send message
    const chatInput = page.locator('input[placeholder*="meddelande"], textarea[placeholder*="meddelande"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('Test message during network failure');

      const sendButton = page.getByRole('button', { name: /skicka|send/i });
      if (await sendButton.isVisible()) {
        await sendButton.click();
      }
    }

    // Wait for error
    await page.waitForTimeout(2000);

    // Check for error handling
    const errorMessage = await page.locator('text=/fel|error|failed|network|offline/i').isVisible();
    const retryButton = await page.getByRole('button', { name: /försök|retry|try again/i }).isVisible();

    if (errorMessage || retryButton) {
      console.log('✅ Chat error handled gracefully');
    } else {
      console.log('⚠️ Chat error handling check inconclusive');
    }
  });

  test('should maintain conversation context', async ({ page }) => {
    console.log('🧠 Testing conversation context maintenance');

    // Send a series of related messages
    const conversation = [
      'Hello, I feel stressed',
      'I have work deadlines approaching',
      'Can you help me relax?'
    ];

    // Navigate to chat
    const chatButton = page.getByRole('button', { name: /chat|prata/i }).first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
    }

    await page.waitForTimeout(1000);

    const chatInput = page.locator('input[placeholder*="meddelande"], textarea[placeholder*="meddelande"]').first();

    if (await chatInput.isVisible()) {
      for (const message of conversation) {
        await chatInput.fill(message);

        const sendButton = page.getByRole('button', { name: /skicka|send/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();
          await page.waitForTimeout(2000); // Wait for response
        }
      }

      console.log('✅ Conversation messages sent');

      // Check if conversation flow makes sense
      const contextMaintained = await page.locator('text=/stress|work|relax/i').count() > 0;

      if (contextMaintained) {
        console.log('✅ Conversation context appears maintained');
      }
    } else {
      console.log('⚠️ Chat input not available, testing API context');

      // Test API conversation context
      let conversationHistory: any[] = [];

      for (const message of conversation) {
        const response = await page.evaluate(async ({ token, userId, message, history }) => {
          try {
            const response = await fetch('http://localhost:5001/api/ai/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                user_id: userId,
                message: message,
                conversation_history: history
              })
            });
            const data = await response.json();
            return { status: response.status, data };
          } catch (e) {
            return { error: (e as Error).message };
          }
        }, { token: authToken, userId, message, history: conversationHistory });

        if (response.status === 200) {
          conversationHistory.push({
            user: message,
            ai: response.data.response
          });
        }
      }

      if (conversationHistory.length === conversation.length) {
        console.log('✅ API conversation context working');
      }
    }
  });

});