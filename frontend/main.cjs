const { app, BrowserWindow, session } = require('electron');
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

  mainWindow.loadURL(frontendURL).catch((err) => {
    console.error('❌ Kunde inte ladda frontend:', err);
    app.quit(); // Avsluta om URL-laddning misslyckas
  });

  mainWindow.on('closed', () => {
    mainWindow = null; // Rensar referensen när fönstret stängs
  });
}

app.whenReady().then(() => {
  // Sätt CSP efter app är redo
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let cspRules = [
      "default-src 'self' data: blob: filesystem:;",
      "script-src 'self' 'unsafe-inline' http://127.0.0.1:5001 http://localhost:5001 https://www.googletagmanager.com https://apis.google.com;",
      "connect-src 'self' http://127.0.0.1:5001 ws://127.0.0.1:5001 https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://region1.google-analytics.com https://identitytoolkit.googleapis.com https://accounts.google.com https://accounts.youtube.com https://securetoken.googleapis.com;",
      "img-src 'self' data: https://*.cloudinary.com;",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;",
      "frame-src 'self' https://lugn-trygg-53d75.firebaseapp.com;"
    ];

    if (app.isPackaged) {
      const productionBackendUrl = process.env.FRONTEND_URL || 'https://lugn-trygg.vercel.app';
      cspRules = [
        "default-src 'self' data: blob: filesystem:;",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://apis.google.com;",
        `connect-src 'self' ${productionBackendUrl} https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://region1.google-analytics.com https://identitytoolkit.googleapis.com;`,
        "img-src 'self' data: https://*.cloudinary.com;",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;",
        "frame-src 'self' https://lugn-trygg-53d75.firebaseapp.com;"
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});