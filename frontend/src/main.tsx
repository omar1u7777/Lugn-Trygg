import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./i18n/i18n"; // Initialize i18n
import i18n from "./i18n/i18n";

/**
 *  Huvudstartfil för Lugn & Trygg Desktop-App
 * -------------------------------------------------
 * - Använder React 18:s `createRoot` för optimerad rendering.
 * - Inkluderar `StrictMode` för att upptäcka eventuella problem i utvecklingsläge.
 * - `BrowserRouter` möjliggör navigation och skyddade rutter.
 * - `AuthProvider` hanterar global autentisering.
 */

const rootElement = document.getElementById("root");

//  Kontrollera att root-elementet finns i `index.html`
if (!rootElement) {
  console.error("❌ Root-elementet saknas i index.html! Kontrollera att <div id='root'></div> finns.");
  throw new Error("Root-element saknas i index.html!");
}

// Register Service Worker for PWA (only in production)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

//  Skapa en React 18 root-instans och rendera appen
createRoot(rootElement).render(
  <ErrorBoundary> {/* 🛡️ Fångar och hanterar applikationsfel */}
    <I18nextProvider i18n={i18n}> {/* 🌐 Tillhandahåller i18n-kontext */}
      <BrowserRouter> {/* 🔗 Hanterar navigering i appen */}
        <ThemeProvider> {/* 🌙 Tillhandahåller tema-kontext */}
          <AuthProvider> {/* 🔒 Tillhandahåller global autentisering */}
            <App /> {/* 🎉 Rendera huvudapplikationen */}
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </I18nextProvider>
  </ErrorBoundary>
);
