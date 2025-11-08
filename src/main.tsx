// React imports - MUST be first for global availability
import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createRoot } from "react-dom/client";

// Expose React globally BEFORE any other imports
if (typeof window !== 'undefined') {
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
}

// Now import everything else
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
import "./config/chartConfig"; // Initialize Chart.js

// Import styles
import "./styles/styles.css";
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

// Service Worker disabled to prevent MIME type errors in production
// if ('serviceWorker' in navigator && import.meta.env.PROD) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js', { scope: '/' })
//       .then((registration) => {
//         console.log('✅ Service Worker registered successfully:', registration.scope);
//       })
//       .catch((error) => {
//         console.warn('⚠️ Service Worker registration failed:', error);
//       });
//   });
// }

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
