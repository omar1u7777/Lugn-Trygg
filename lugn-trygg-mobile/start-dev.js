#!/usr/bin/env node

/**
 * Direct Metro Bundler Starter for Lugn & Trygg Mobile
 * Bypasses Expo CLI validation to avoid network checks
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Lugn & Trygg Mobile Development Server...\n');

// Set environment variables
process.env.NODE_ENV = 'development';
process.env.EXPO_OFFLINE_MODE = '1';
process.env.RCT_NO_LAUNCH_PACKAGER = '0';

const projectRoot = __dirname;
const metroBin = path.join(projectRoot, 'node_modules', '.bin', 'metro');

const args = [
  'start',
  '--config',
  path.join(projectRoot, 'metro.config.js'),
  '--reset-cache',
];

console.log(`📁 Project Root: ${projectRoot}`);
console.log(`⚙️  Metro Config: ${path.join(projectRoot, 'metro.config.js')}`);
console.log(`📦 Metro Binary: ${metroBin}`);
console.log(`🔧 Arguments: ${args.join(' ')}\n`);

const metro = spawn('npx', ['expo', 'start', '--web'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EXPO_OFFLINE_MODE: '1',
  }
});

metro.on('error', (error) => {
  console.error('❌ Metro error:', error);
  process.exit(1);
});

metro.on('exit', (code) => {
  console.log(`⛔ Metro exited with code ${code}`);
  process.exit(code);
});

// Handle signals
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down...');
  metro.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Shutting down...');
  metro.kill();
  process.exit(0);
});

console.log('✅ Development server should start above. Press Ctrl+C to stop.\n');
