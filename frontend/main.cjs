const { app, BrowserWindow, session } = require('electron');
const path = require('path');

let mainWindow; //  Huvudfönstret för applikationen

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000, // 📏 Standardbredd för fönstret
        height: 700, // 📏 Standardhöjd för fönstret
        webPreferences: {
            nodeIntegration: false, //  Förhindrar åtkomst till Node.js-moduler i frontend
            contextIsolation: true, //  Aktiverar isolering mellan renderer- och main-process
            preload: path.join(__dirname, 'preload.js'), //  Laddar en preload-fil för säker IPC-kommunikation
        },
    });

    //  Dynamiskt bestäm frontend-URL beroende på om appen körs i dev- eller produktionsläge
    const isDev = !app.isPackaged;
    const frontendURL = isDev
        ? 'http://localhost:3000'  //  Dev: Ansluter till utvecklingsservern (standard Vite port)
        : `file://${path.join(__dirname, '../dist/index.html')}`; //  Prod: Laddar byggda filer

    mainWindow.loadURL(frontendURL).catch((err) => {
        console.error("❌ Kunde inte ladda frontend:", err);
    });

    mainWindow.on('closed', () => {
        mainWindow = null; //  Rensar referensen när fönstret stängs
    });

    //  Förbättrad Content Security Policy (CSP) för säkerhet
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        let cspRules = [
            "default-src 'self' data: blob: filesystem:;",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:5001 http://localhost:5001 https://www.googletagmanager.com https://apis.google.com;",
            "connect-src 'self' http://127.0.0.1:5001 ws://127.0.0.1:5001 https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://region1.google-analytics.com https://identitytoolkit.googleapis.com;", // Allow Firebase and Google APIs
            "img-src 'self' data: https://*.cloudinary.com;", // Allow Cloudinary images if used
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;", // Allow Font Awesome
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;", // Allow fonts from CDNs
            "frame-src 'self' https://lugn-trygg-53d75.firebaseapp.com;" // Allow Firebase sign-in popup
        ];

        //  Striktare CSP i produktion
        if (app.isPackaged) {
            // Using a placeholder for the production backend URL. This should be updated with the actual deployed backend domain.
            const productionBackendUrl = process.env.FRONTEND_URL || 'https://your-frontend.com'; // Assuming FRONTEND_URL from backend .env.example
            cspRules = [
                "default-src 'self' data: blob: filesystem:;",
                "script-src 'self';",
                `connect-src 'self' ${productionBackendUrl};`, //  Begränsar API-anrop till en säker domän
                "img-src 'self' data:;",
                "style-src 'self' https://fonts.googleapis.com;",
                "font-src 'self' https://fonts.gstatic.com;"
            ];
        }

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [cspRules.join(" ")], //  Sätter CSP-riktlinjer för alla webbförfrågningar
            },
        });
    });
}

//  Förhindrar oändliga omstarter och hanterar macOS-funktionalitet
app.whenReady().then(() => {
    if (!mainWindow) createWindow();

    app.on('activate', () => {
        //  macOS-specifik hantering: Skapa nytt fönster om inga finns öppna
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch((err) => {
    console.error("❌ Electron kunde inte starta:", err);
});

// Stänger bara appen om det **inte** är macOS (darwin)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit(); //  Avslutar programmet om det inte är macOS
    }
});
