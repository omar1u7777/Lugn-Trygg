const { app, BrowserWindow, session, webContents } = require('electron');
const path = require('path');

let mainWindow; // Huvudfönstret för applikationen

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, // 📏 Standardbredd för fönstret
    height: 700, // 📏 Standardhöjd för fönstret
    webPreferences: {
      nodeIntegration: false, // Förhindrar åtkomst till Node.js-moduler i frontend
      contextIsolation: true, // Aktiverar isolering mellan renderer- och main-process
      preload: path.join(__dirname, 'preload.js'), // Laddar preload-fil för säker IPC
    },
  });

  // Dynamiskt bestäm frontend-URL
  const isDev = !app.isPackaged;
  const frontendURL = isDev
    ? 'http://localhost:3000' // Matchar Vite dev server port
    : `file://${path.join(__dirname, '../dist/index.html')}`; // Prod: Laddar byggda filer

  console.log('🚀 Starting Electron app...');
  console.log('📁 App path:', app.getAppPath());
  console.log('📦 Is packaged:', app.isPackaged);
  console.log('🌐 Frontend URL:', frontendURL);

  // Wait for Vite dev server to be ready before loading URL
  if (isDev) {
    const checkServer = (retryCount = 0) => {
      const maxRetries = 30; // 30 seconds max wait time
      const retryDelay = 1000; // 1 second

      if (retryCount >= maxRetries) {
        console.error('❌ Vite dev server did not start within expected time');
        app.quit();
        return;
      }

      require('http').get('http://localhost:3000', (res) => {
        // Accept any successful status code (200, 201, etc.)
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log('✅ Vite dev server is ready, loading frontend...');
          mainWindow.loadURL(frontendURL).catch((err) => {
            console.error('❌ Failed to load frontend URL:', err);
            if (err.code === 'ERR_ABORTED' || err.code === -3) {
              console.log('🔄 Retrying due to ERR_ABORTED, server might still be starting...');
              setTimeout(() => checkServer(retryCount + 1), retryDelay);
            } else {
              app.quit();
            }
          });
        } else {
          console.log(`⏳ Vite server responded with status ${res.statusCode}, retrying...`);
          setTimeout(() => checkServer(retryCount + 1), retryDelay);
        }
      }).on('error', (err) => {
        console.log(`⏳ Waiting for Vite dev server... (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => checkServer(retryCount + 1), retryDelay);
      });
    };
    checkServer();
  } else {
    mainWindow.loadURL(frontendURL).catch((err) => {
      console.error('❌ Kunde inte ladda frontend:', err);
      app.quit();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null; // Rensar referensen när fönstret stängs
  });
}

if (app && app.whenReady) {
  app.whenReady().then(() => {
  // Sätt CSP efter app är redo
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let cspRules = [
      "default-src 'self' data: blob: filesystem:;",
      "script-src 'self' 'unsafe-inline' http://127.0.0.1:54112 http://localhost:54112 https://www.googletagmanager.com https://googletagmanager.com https://apis.google.com https://www.gstatic.com https://region1.google-analytics.com;",
      "connect-src 'self' http://127.0.0.1:54112 http://localhost:54112 ws://127.0.0.1:54112 ws://localhost:54112 ws://localhost:3000 ws://localhost:3001 wss://localhost:3000 wss://localhost:3001 https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://region1.google-analytics.com https://identitytoolkit.googleapis.com https://accounts.google.com https://accounts.youtube.com https://securetoken.googleapis.com https://www.googletagmanager.com https://googletagmanager.com https://*.googleusercontent.com https://*.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com;",
      "img-src 'self' data: https://*.cloudinary.com https://www.googletagmanager.com https://googletagmanager.com;",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://googletagmanager.com;",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;",
      "frame-src 'self' https://lugn-trygg-53d75.firebaseapp.com https://accounts.google.com;"
    ];

    if (app.isPackaged) {
      const productionBackendUrl = process.env.FRONTEND_URL || 'https://lugn-trygg.vercel.app';
      cspRules = [
        "default-src 'self' data: blob: filesystem:;",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://googletagmanager.com https://apis.google.com https://www.gstatic.com;",
        `connect-src 'self' ${productionBackendUrl} https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://region1.google-analytics.com https://identitytoolkit.googleapis.com https://www.googletagmanager.com https://googletagmanager.com;`,
        "img-src 'self' data: https://*.cloudinary.com https://www.googletagmanager.com https://googletagmanager.com;",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://googletagmanager.com;",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;",
        "frame-src 'self' https://lugn-trygg-53d75.firebaseapp.com https://accounts.google.com;"
      ];
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspRules.join(' ')],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  }).catch((err) => {
    console.error('❌ Electron kunde inte starta:', err);
    app.quit();
  });
} else {
  console.error('❌ Electron app object not available');
}

if (app) {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}