#!/usr/bin/env node

/**
 * Lugn & Trygg Production Build Script
 * Cross-platform build script using Node.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${color}[${new Date().toLocaleTimeString()}] ${message}${colors.reset}`);
}

function info(message) {
    log(colors.blue, `INFO: ${message}`);
}

function success(message) {
    log(colors.green, `SUCCESS: ${message}`);
}

function error(message) {
    log(colors.red, `ERROR: ${message}`);
}

function warning(message) {
    log(colors.yellow, `WARNING: ${message}`);
}

function runCommand(command, cwd = process.cwd(), description = '') {
    try {
        info(`${description ? description + ' - ' : ''}Running: ${command}`);
        const result = execSync(command, {
            cwd,
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' }
        });
        return true;
    } catch (err) {
        error(`${description ? description + ' - ' : ''}Command failed: ${command}`);
        return false;
    }
}

function buildWeb() {
    info('Building web application...');

    const frontendDir = path.join(__dirname, 'frontend');

    // Skip dependency installation if node_modules exists and seems healthy
    const nodeModulesExists = fs.existsSync(path.join(frontendDir, 'node_modules'));
    const packageLockExists = fs.existsSync(path.join(frontendDir, 'package-lock.json'));

    if (!nodeModulesExists || !packageLockExists) {
        info('Dependencies not found, installing...');

        // Try npm install instead of npm ci if ci fails
        let installSuccess = runCommand('npm ci', frontendDir, 'Installing dependencies');
        if (!installSuccess) {
            info('npm ci failed, trying npm install...');
            installSuccess = runCommand('npm install', frontendDir, 'Installing dependencies (fallback)');
            if (!installSuccess) {
                error('Failed to install dependencies. Try running: cd frontend && rm -rf node_modules package-lock.json && npm install');
                return false;
            }
        }
    } else {
        info('Using existing dependencies');
    }

    if (!runCommand('npm run build', frontendDir, 'Building web app')) {
        return false;
    }

    success('Web build completed');
    return true;
}

function buildElectron() {
    info('Building Electron desktop application...');

    const frontendDir = path.join(__dirname, 'frontend');

    // Skip dependency installation if node_modules exists and seems healthy
    const nodeModulesExists = fs.existsSync(path.join(frontendDir, 'node_modules'));
    const packageLockExists = fs.existsSync(path.join(frontendDir, 'package-lock.json'));

    if (!nodeModulesExists || !packageLockExists) {
        info('Dependencies not found, installing...');

        // Try npm install instead of npm ci if ci fails
        let installSuccess = runCommand('npm ci', frontendDir, 'Installing dependencies');
        if (!installSuccess) {
            info('npm ci failed, trying npm install...');
            installSuccess = runCommand('npm install', frontendDir, 'Installing dependencies (fallback)');
            if (!installSuccess) {
                error('Failed to install dependencies. Try running: cd frontend && rm -rf node_modules package-lock.json && npm install');
                return false;
            }
        }
    } else {
        info('Using existing dependencies');
    }

    if (!runCommand('npm run build', frontendDir, 'Building web assets')) {
        return false;
    }

    // Determine platform and build accordingly
    const platform = process.platform;
    let buildCommand = 'npm run build:electron';

    if (platform === 'win32') {
        buildCommand = 'npm run build:electron:win';
    } else if (platform === 'darwin') {
        buildCommand = 'npm run build:electron:mac';
    } else if (platform === 'linux') {
        buildCommand = 'npm run build:electron:linux';
    }

    if (!runCommand(buildCommand, frontendDir, 'Building Electron app')) {
        return false;
    }

    success('Electron build completed');
    return true;
}

function buildDocker() {
    info('Building Docker containers...');

    if (!runCommand('docker-compose -f docker-compose.prod.yml build', process.cwd(), 'Building Docker images')) {
        return false;
    }

    success('Docker build completed');
    info('To deploy, run: docker-compose -f docker-compose.prod.yml up -d');
    return true;
}

function showResults() {
    console.log('\n📦 Build Results:');

    const distPath = path.join(__dirname, 'frontend', 'dist');
    if (fs.existsSync(distPath)) {
        success(`Web build: frontend/dist/`);
    }

    const releasePath = path.join(__dirname, 'frontend', 'release');
    if (fs.existsSync(releasePath)) {
        success(`Electron build: frontend/release/`);
    }

    console.log('\n🚀 Deployment commands:');
    console.log('  Web: cd frontend && npm run serve');
    console.log('  Electron: Open the executable in frontend/release/');
    console.log('  Docker: docker-compose -f docker-compose.prod.yml up -d');
}

function main() {
    const buildType = process.argv[2] || 'all';

    info('🚀 Starting Lugn & Trygg production build...');

    let success = false;

    switch (buildType) {
        case 'web':
            success = buildWeb();
            break;
        case 'electron':
            success = buildElectron();
            break;
        case 'docker':
            success = buildDocker();
            break;
        case 'all':
            success = buildWeb() && buildElectron() && buildDocker();
            break;
        default:
            error(`Invalid build type: ${buildType}`);
            console.log('Usage: node build.js [web|electron|docker|all]');
            process.exit(1);
    }

    if (success) {
        showResults();
        success('Build completed successfully!');
    } else {
        error('Build failed!');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}