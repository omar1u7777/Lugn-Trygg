#!/usr/bin/env node

/**
 * Visual Regression Baseline Update Script
 * Updates baseline screenshots for visual regression testing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎨 Updating Visual Regression Baselines...\n');

// Ensure we're in the web-app directory
const webAppDir = path.join(__dirname, '..');
process.chdir(webAppDir);

try {
  // Install dependencies if needed
  console.log('📦 Ensuring dependencies are installed...');
  execSync('npm ci', { stdio: 'inherit' });

  // Install Playwright browsers
  console.log('🌐 Installing Playwright browsers...');
  execSync('npx playwright install chromium', { stdio: 'inherit' });

  // Build the application
  console.log('🔨 Building application...');
  execSync('npm run build', { stdio: 'inherit' });

  // Start development server in background
  console.log('🚀 Starting development server...');
  const serverProcess = execSync('npm run serve', {
    stdio: 'pipe',
    detached: true
  });

  // Wait for server to be ready
  console.log('⏳ Waiting for server to be ready...');
  execSync('npx wait-on http://localhost:3000 --timeout 60000', { stdio: 'inherit' });

  // Update visual regression baselines
  console.log('📸 Updating visual regression baselines...');
  execSync('npx playwright test visual-regression.spec.ts --update-snapshots --project=visual-regression', {
    stdio: 'inherit'
  });

  // Kill the server process
  try {
    process.kill(-serverProcess.pid);
  } catch (e) {
    // Server might already be killed
  }

  console.log('\n✅ Visual regression baselines updated successfully!');
  console.log('📁 Screenshots saved to: tests/e2e/__screenshots__/');

} catch (error) {
  console.error('\n❌ Error updating visual regression baselines:', error.message);
  process.exit(1);
}