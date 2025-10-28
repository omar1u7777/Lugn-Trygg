import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { Analytics } from "./shims/vercel-analytics";
import { SpeedInsights } from "./shims/vercel-speed-insights";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { initializeAnalytics } from "./services/analytics";
import App from "./App";
import "./i18n/i18n"; // Initialize i18n
import i18n from "./i18n/i18n";

// Import accessibility styles
import "./styles/accessibility.css";

/**
 *  Huvudstartfil för Lugn & Trygg Desktop-App
 * -------------------------------------------------
 * - Använder React 18:s `createRoot` för optimerad rendering.
 * - Inkluderar `StrictMode` för att upptäcka eventuella problem i utvecklingsläge.
 * - `BrowserRouter` möjliggör navigation och skyddade rutter.
 * - `AuthProvider` hanterar global autentisering.
 * - Analytics för att spåra användarbeteende.
 */

// Initialize Analytics (Sentry + Amplitude)
initializeAnalytics();

const rootElement = document.getElementById("root");

//  Kontrollera att root-elementet finns i `index.html`
if (!rootElement) {
  console.error("❌ Root-elementet saknas i index.html! Kontrollera att <div id='root'></div> finns.");
  throw new Error("Root-element saknas i index.html!");
}

// Register Service Worker for PWA (only in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);

        // Request background sync permission for mood data
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
          // Background sync is supported
          console.log('✅ Background sync supported');
        }

        // Check for updates periodically (every 6 hours)
        setInterval(() => {
          registration.update().catch((error) => {
            console.warn('⚠️ Service Worker update check failed:', error);
          });
        }, 6 * 60 * 60 * 1000);

        // Listen for service worker messages (for sync status)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SYNC_COMPLETE') {
            console.log('📤 Background sync completed:', event.data);
            // Could trigger UI updates here
          }
        });
      })
      .catch((error) => {
        console.warn('⚠️ Service Worker registration failed:', error);
        console.warn('   (This is normal in development. The app will work without offline support)');
      });
  });
}

//  Skapa en React 18 root-instans och rendera appen
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary> {/* 🛡️ Fångar och hanterar applikationsfel */}
      <I18nextProvider i18n={i18n}> {/* 🌐 Tillhandahåller i18n-kontext */}
        <BrowserRouter> {/* 🔗 Hanterar navigering i appen */}
          <ThemeProvider> {/* 🌙 Tillhandahåller tema-kontext */}
            <AuthProvider> {/* 🔒 Tillhandahåller global autentisering */}
              <App /> {/* 🎉 Rendera huvudapplikationen */}
              <Analytics /> {/* 📊 Vercel Analytics för besökarspårning */}
              <SpeedInsights /> {/* ⚡ Vercel Speed Insights för prestandaspårning */}
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>
);
