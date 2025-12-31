import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import handler from 'serve-handler';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const PORT = 4173;

function ensureDist() {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`dist build missing at ${indexPath}. Run npm run build first.`);
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      handler(request, response, {
        public: distDir,
        rewrites: [{ source: '**', destination: '/index.html' }],
        cleanUrls: true,
      });
    });

    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function run() {
  ensureDist();
  const server = await startServer();
  console.log(`🚀 Serving dist at http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (msg) => {
    console.log(`🧭 console.${msg.type()}:`, msg.text());
    for (const arg of msg.args()) {
      if (arg.remoteObject().preview) {
        console.log('   ', arg.remoteObject().preview?.description);
      }
    }
  });
  page.on('pageerror', (err) => {
    console.error('💥 pageerror:', err);
  });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('❌ Navigation failed', error);
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error('❌ Debug run failed:', error);
  process.exit(1);
});
