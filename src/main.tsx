// React imports - MUST be first for global availability
import React from "react";
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
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { initializeAnalytics } from "./services/analytics";
import { initPerformanceMonitoring, type ResourceHint, type PreloadAsset } from "./utils/performance";
import { loadPolyfills } from "./utils/loadPolyfills";
import { scheduleIdleTask } from "./utils/scheduleIdleTask";
import App from "./App";
import "./i18n/i18n"; // Initialize i18n
import i18n from "./i18n/i18n";
// Hero image IDs and Cloudinary URL builder moved to individual route components
import { logger } from "./utils/logger";

// Import Tailwind CSS - REPLACES MUI
const tailwindStylesPromise: Promise<unknown> = typeof window !== 'undefined'
  ? import("./index.css").catch((error) => {
      if ((import.meta as any).env?.DEV) {
        logger.warn("Failed to load Tailwind bundle immediately", { error });
      }
    })
  : Promise.resolve();

declare global {
  interface Window {
    __removeInitialLoader?: () => void;
    __removeInlineHero?: () => void;
    __tailwindReady?: boolean;
  }
}

const releaseInitialOverlays = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const timeoutFallback = new Promise((resolve) => {
    window.setTimeout(resolve, 2400);
  });

  Promise.race([tailwindStylesPromise, timeoutFallback])
    .catch(() => undefined)
    .finally(() => {
      window.__tailwindReady = true;
      window.__removeInitialLoader?.();
      window.requestAnimationFrame(() => {
        window.__removeInlineHero?.();
      });
    });
};

/**
 *  Huvudstartfil för Lugn & Trygg Desktop-App
 * -------------------------------------------------
 * - Använder React 18:s `createRoot` för optimerad rendering.
 * - Inkluderar `StrictMode` för att upptäcka eventuella problem i utvecklingsläge.
 * - `BrowserRouter` möjliggör navigation och skyddade rutter.
 * - `AuthProvider` hanterar global autentisering.
 * - Analytics för att spåra användarbeteende.
 */

// Hero image preloads removed from startup to avoid "preloaded but not used" warnings.
// Images are loaded on-demand when their respective route components mount.
const CRITICAL_PRELOADS: PreloadAsset[] = [];

const RESOURCE_HINTS: ResourceHint[] = [
  { rel: 'preconnect', href: 'https://www.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: 'https://www.googleapis.com', crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: 'https://res.cloudinary.com', crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: 'https://api.lugntrygg.se' },
  { rel: 'dns-prefetch', href: '//www.gstatic.com' },
  { rel: 'dns-prefetch', href: '//fonts.gstatic.com' },
  { rel: 'dns-prefetch', href: '//res.cloudinary.com' },
  { rel: 'dns-prefetch', href: '//api.lugntrygg.se' },
];

const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

type TelemetryModules = {
  Analytics?: React.ComponentType;
  SpeedInsights?: React.ComponentType;
};

const TelemetryPortal = () => {
  const [modules, setModules] = React.useState<TelemetryModules>({});

  React.useEffect(() => {
    let cancelled = false;

    const lazyLoadTelemetry = async () => {
      const [{ Analytics }, { SpeedInsights }] = await Promise.all([
        import("@vercel/analytics/react"),
        import("@vercel/speed-insights/react"),
      ]);

      if (!cancelled) {
        setModules({ Analytics, SpeedInsights });
      }
    };

    scheduleIdleTask(() => {
      lazyLoadTelemetry().catch((telemetryError) => {
        if ((import.meta as any).env?.DEV) {
          logger.warn("Failed to load telemetry modules", { error: telemetryError });
        }
      });
    }, 1800);

    return () => {
      cancelled = true;
    };
  }, []);

  const AnalyticsComponent = modules.Analytics;
  const SpeedInsightsComponent = modules.SpeedInsights;

  if (!AnalyticsComponent && !SpeedInsightsComponent) {
    return null;
  }

  return (
    <>
      {AnalyticsComponent ? <AnalyticsComponent /> : null}
      {SpeedInsightsComponent ? <SpeedInsightsComponent /> : null}
    </>
  );
};

const startApp = async () => {
  if (import.meta.env.DEV) {
    await import('./utils/memoryLeakDetector');
  }

  await loadPolyfills();

  const rootElement = document.getElementById("root");

  if (!rootElement) {
    logger.error("Root-elementet saknas i index.html! Kontrollera att <div id='root'></div> finns.");
    throw new Error("Root-element saknas i index.html!");
  }

  if (typeof window !== 'undefined') {
    initPerformanceMonitoring({
      preloadAssets: CRITICAL_PRELOADS,
      resourceHints: RESOURCE_HINTS,
    });
  }

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          if ((import.meta as any).env?.DEV) {
            logger.debug('Service Worker registered successfully', { scope: registration.scope });
            logger.debug('Offline support activated for 1000 users');
          }
        })
        .catch((error) => {
          if ((import.meta as any).env?.DEV) {
            logger.warn('Service Worker registration failed', { error });
          }
        });
    });
  }

  const bootstrap = () => {
    createRoot(rootElement).render(
      <ErrorBoundary>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter future={ROUTER_FUTURE_FLAGS}>
            <ThemeProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <App />
                  <TelemetryPortal />
                </SubscriptionProvider>
              </AuthProvider>
            </ThemeProvider>
          </BrowserRouter>
        </I18nextProvider>
      </ErrorBoundary>
    );

    if (typeof window !== 'undefined') {
      releaseInitialOverlays();
    }
  };

  bootstrap();

  if (typeof window !== 'undefined') {
    scheduleIdleTask(() => {
      initializeAnalytics();
    }, 1200);
  }
};

startApp().catch((error) => {
  logger.error('Failed to bootstrap application', error);
});
