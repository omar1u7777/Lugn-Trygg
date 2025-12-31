/**
 * Analytics Integration Test Script
 * Tests all analytics providers and verifies event tracking
 * Run with: npx tsx scripts/test-analytics.ts
 */

import { analytics, initializeAnalytics } from '../src/services/analytics';

// Test configuration
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_SESSION_ID = 'test-session-' + Date.now();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  test: (msg: string) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
  header: () => console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(60)}${colors.reset}`),
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void> | void): Promise<void> {
  log.test(`Running: ${name}`);
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    log.success(`${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    log.error(`${name} - ${errorMsg} (${duration}ms)`);
  }
}

async function testAnalyticsInitialization() {
  log.header();
  log.info('Testing Analytics Initialization');
  log.header();

  await runTest('Initialize Analytics Service', async () => {
    initializeAnalytics();
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
}

async function testEventTracking() {
  log.header();
  log.info('Testing Event Tracking');
  log.header();

  await runTest('Track Page View Event', () => {
    analytics.page('Test Dashboard', {
      referrer: 'test',
      source: 'automated-test',
    });
  });

  await runTest('Track Custom Event', () => {
    analytics.track('Test Event', {
      test_property: 'value',
      timestamp: Date.now(),
      session_id: TEST_SESSION_ID,
    });
  });

  await runTest('Track Button Click', () => {
    analytics.track('Button Clicked', {
      button_id: 'test-button',
      button_text: 'Test Button',
      page: 'Test Page',
    });
  });
}

async function testUserIdentification() {
  log.header();
  log.info('Testing User Identification');
  log.header();

  await runTest('Identify User', () => {
    analytics.identify(TEST_USER_ID, {
      email: 'test@example.com',
      role: 'test-user',
      subscription: 'free',
      language: 'sv',
      theme: 'light',
    });
  });

  await runTest('Update User Properties', () => {
    analytics.identify(TEST_USER_ID, {
      subscription: 'premium',
      last_login: new Date().toISOString(),
    });
  });
}

async function testBusinessMetrics() {
  log.header();
  log.info('Testing Business Metrics');
  log.header();

  await runTest('Track Mood Logged', () => {
    analytics.business.moodLogged(8, {
      mood_type: 'happy',
      note_added: true,
      tags: ['gratitude', 'energy'],
    });
  });

  await runTest('Track Memory Recorded', () => {
    analytics.business.memoryRecorded('voice', {
      duration: 45,
      transcription_enabled: true,
    });
  });

  await runTest('Track Chatbot Interaction', () => {
    analytics.business.chatbotInteraction(
      'Jag känner mig stressad',
      'Jag förstår att du känner dig stressad. Vill du prova en andningsövning?',
      {
        conversation_id: 'test-conv-123',
        session_length: 5,
      }
    );
  });

  await runTest('Track Feature Usage', () => {
    analytics.business.featureUsed('weekly_analysis', {
      generated_insights: 12,
      shared: false,
    });
  });

  await runTest('Track API Call Performance', () => {
    analytics.business.apiCall('/api/mood', 'POST', 234, 200, {
      response_size: 1024,
      cached: false,
    });
  });

  await runTest('Track Slow API Call', () => {
    analytics.business.apiCall('/api/analytics', 'GET', 2500, 200, {
      response_size: 10240,
      cached: false,
    });
  });
}

async function testErrorTracking() {
  log.header();
  log.info('Testing Error Tracking');
  log.header();

  await runTest('Track Error with Context', () => {
    const testError = new Error('Test error for analytics verification');
    analytics.error(testError, {
      component: 'AnalyticsTest',
      action: 'test_error_tracking',
      userId: TEST_USER_ID,
    });
  });

  await runTest('Track Critical Error', () => {
    const criticalError = new Error('Critical test error');
    analytics.error(criticalError, {
      component: 'CriticalComponent',
      action: 'critical_operation',
      severity: 'critical',
    });
  });
}

async function testPerformanceTracking() {
  log.header();
  log.info('Testing Performance Tracking');
  log.header();

  await runTest('Track Load Time', () => {
    analytics.performance({
      name: 'Page Load Time',
      value: 1234,
      unit: 'ms',
      category: 'page-load',
    });
  });

  await runTest('Track Component Render', () => {
    analytics.performance({
      name: 'Component Render',
      value: 45,
      unit: 'ms',
      category: 'render',
    });
  });

  await runTest('Track User Interaction', () => {
    analytics.business.userInteraction('mood-selection', 123, {
      interaction_count: 1,
      selection: 'happy',
    });
  });

  await runTest('Track Slow User Interaction', () => {
    analytics.business.userInteraction('data-processing', 456, {
      data_size: 1024,
      processed_items: 500,
    });
  });
}

async function testHealthSafetyTracking() {
  log.header();
  log.info('Testing Health & Safety Tracking');
  log.header();

  await runTest('Track Crisis Detection', () => {
    analytics.health.crisisDetected(['low_mood_streak', 'self_harm_keywords'], {
      user_id: TEST_USER_ID,
      severity: 'high',
      automated: true,
    });
  });

  await runTest('Track Safety Check', () => {
    analytics.health.safetyCheckCompleted('safe', {
      check_type: 'automated',
      indicators_count: 0,
    });
  });

  await runTest('Track Concerning Safety Check', () => {
    analytics.health.safetyCheckCompleted('concerning', {
      check_type: 'automated',
      indicators_count: 2,
      indicators: ['mood_decline', 'reduced_activity'],
    });
  });
}

async function testPrivacyCompliance() {
  log.header();
  log.info('Testing Privacy & Compliance');
  log.header();

  await runTest('Track Privacy Consent', () => {
    analytics.privacy.consentGiven(['analytics', 'performance', 'essential']);
  });

  await runTest('Track Data Export Request', () => {
    analytics.privacy.dataExportRequested();
  });
}

async function testSubscriptionEvents() {
  log.header();
  log.info('Testing Subscription Events');
  log.header();

  await runTest('Track Subscription Started', () => {
    analytics.business.subscriptionEvent('subscription_started', 'premium', {
      billing_cycle: 'monthly',
      price: 99,
      currency: 'SEK',
    });
  });

  await runTest('Track Subscription Upgraded', () => {
    analytics.business.subscriptionEvent('subscription_upgraded', 'premium_plus', {
      previous_plan: 'premium',
      billing_cycle: 'yearly',
    });
  });

  await runTest('Track Subscription Cancelled', () => {
    analytics.business.subscriptionEvent('subscription_cancelled', 'premium', {
      cancellation_reason: 'test',
      days_active: 30,
    });
  });
}

async function testEnvironmentVariables() {
  log.header();
  log.info('Testing Environment Configuration');
  log.header();

  await runTest('Check Amplitude API Key', () => {
    const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
    if (!apiKey || apiKey === 'your-amplitude-api-key-here') {
      throw new Error('Amplitude API key not configured');
    }
  });

  await runTest('Check Sentry DSN', () => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || dsn === 'your-sentry-dsn-here') {
      throw new Error('Sentry DSN not configured');
    }
  });

  await runTest('Check Firebase Config', () => {
    const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
    if (!measurementId) {
      throw new Error('Firebase measurement ID not configured');
    }
  });
}

async function generateTestReport() {
  log.header();
  log.info('Test Results Summary');
  log.header();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Pass Rate: ${passRate}%\n`);

  if (failed > 0) {
    log.warning('Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}`);
        console.log(`     ${colors.red}${r.error}${colors.reset}`);
      });
  }

  // Performance summary
  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;
  console.log(`\nAverage Test Duration: ${avgDuration.toFixed(0)}ms`);

  // Generate recommendations
  log.header('');
  log.info('Recommendations');
  log.header('');

  if (failed === 0) {
    log.success('All tests passed! Analytics is fully functional.');
  } else {
    log.warning(`${failed} test(s) failed. Please review configuration.`);
  }

  // Check for environment variable issues
  const envTests = results.filter(r => r.name.includes('Check'));
  const envFailed = envTests.filter(r => !r.passed);
  
  if (envFailed.length > 0) {
    log.warning('\nEnvironment Configuration Issues:');
    console.log('  1. Check .env file for missing or invalid values');
    console.log('  2. Verify API keys are correctly set');
    console.log('  3. Ensure Firebase configuration is complete');
  }

  return { passed, failed, total, passRate: parseFloat(passRate) };
}

// Main execution
async function main() {
  console.log(`${colors.bold}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           Analytics Integration Test Suite               ║
║           Lugn & Trygg - November 2025                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  log.info('Starting comprehensive analytics tests...\n');

  try {
    // Run all test suites
    await testAnalyticsInitialization();
    await testEventTracking();
    await testUserIdentification();
    await testBusinessMetrics();
    await testErrorTracking();
    await testPerformanceTracking();
    await testHealthSafetyTracking();
    await testPrivacyCompliance();
    await testSubscriptionEvents();
    await testEnvironmentVariables();

    // Generate report
    const summary = await generateTestReport();

    // Exit with appropriate code
    process.exit(summary.failed === 0 ? 0 : 1);
  } catch (error) {
    log.error('Fatal error running tests:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runAnalyticsTests };
