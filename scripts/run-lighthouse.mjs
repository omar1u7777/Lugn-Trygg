import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const lighthouseModule = require('lighthouse');
const chromeLauncherModule = require('chrome-launcher');
const handlerModule = require('serve-handler');
const lighthouse = lighthouseModule.default || lighthouseModule;
const chromeLauncher = chromeLauncherModule.default || chromeLauncherModule;
const handler = handlerModule.default || handlerModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const reportsDir = path.join(projectRoot, 'reports', 'lighthouse');
const DEFAULT_PORT = 4173;

async function ensureBuild() {
  const distExists = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));
  if (distExists) {
    return;
  }

  console.log('🏗️  Building production bundle via `npm run build`...');
  await runCommand('npm', ['run', 'build']);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function startStaticServer(port = DEFAULT_PORT) {
  await fsp.mkdir(distDir, { recursive: true });
  const server = http.createServer((request, response) => {
    handler(request, response, {
      public: distDir,
      cleanUrls: true,
      rewrites: [{ source: '**', destination: '/index.html' }],
    });
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server;
}

const HEADLESS_MODE = process.env.LH_HEADLESS?.trim().toLowerCase() || 'legacy';

async function runLighthouse(url) {
  const chromeFlags = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
    '--window-size=1365,900',
    '--force-color-profile=sRGB',
  ];

  if (HEADLESS_MODE !== 'off') {
    if (HEADLESS_MODE === 'new' || HEADLESS_MODE === 'chrome') {
      chromeFlags.push('--headless=new');
    } else if (HEADLESS_MODE === 'legacy' || HEADLESS_MODE === 'old') {
      chromeFlags.push('--headless');
    } else {
      chromeFlags.push('--headless');
    }
  }

  console.log(`🧪 Launching Chrome (${HEADLESS_MODE}) with flags: ${chromeFlags.join(' ')}`);

  const chrome = await chromeLauncher.launch({
    chromeFlags,
  });

  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      logLevel: 'info',
      output: ['json', 'html'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    return runnerResult;
  } finally {
    await chrome.kill();
  }
}

async function saveReports(reports, lhr, timestamp) {
  await fsp.mkdir(reportsDir, { recursive: true });
  const [jsonReport, htmlReport] = Array.isArray(reports) ? reports : [reports];
  const jsonPath = path.join(reportsDir, `lighthouse-${timestamp}.json`);
  const htmlPath = path.join(reportsDir, `lighthouse-${timestamp}.html`);

  await fsp.writeFile(jsonPath, typeof jsonReport === 'string' ? jsonReport : JSON.stringify(jsonReport, null, 2));
  if (htmlReport) {
    await fsp.writeFile(htmlPath, htmlReport, 'utf8');
  }

  console.log(`📦  Reports saved to:\n  - ${jsonPath}\n  - ${htmlPath}`);

  const categories = lhr.categories || {};
  const summary = Object.entries(categories).map(([key, value]) => ({
    category: key,
    score: Math.round((value.score || 0) * 100),
  }));

  console.table(summary);
}

async function main() {
  try {
    await ensureBuild();
    const server = await startStaticServer();
    const url = `http://127.0.0.1:${DEFAULT_PORT}`;
    console.log(`🚀  Serving dist from ${distDir} at ${url}`);

    try {
      const runnerResult = await runLighthouse(url);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await saveReports(runnerResult.report, runnerResult.lhr, timestamp);
    } finally {
      server.close();
    }
  } catch (error) {
    console.error('❌ Lighthouse run failed:', error);
    process.exitCode = 1;
  }
}

main();
