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

// Import ALL CSS statically so Vite injects them as <link> tags in the HTML.
// Previously, most styles lived inside the lazy-loaded ProtectedAppShell
// and never loaded on auth pages (login / register), leaving them unstyled.
import "./index.css";
import "./styles/styles.css";
import "./styles/responsive.css";
import "./styles/design-system.css";
import "./styles/animations.css";
import "./styles/world-class-design.css";
import "./styles/accessibility.css";

// Kept for the releaseInitialOverlays flow – resolves immediately now.
const tailwindStylesPromise: Promise<unknown> = Promise.resolve();

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
      const isVercelHost = typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app');

      if (isVercelHost) {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .then(() => {
            logger.info('Skipped service worker on vercel.app and removed stale registrations');
          })
          .catch((error) => {
            logger.debug('Could not unregister service workers on vercel.app', { error });
          });
        return;
      }

      const swPath = `${import.meta.env.BASE_URL}sw.js`;

      fetch(swPath, { method: 'GET', cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Service worker script unavailable (${response.status}) at ${swPath}`);
          }
          return navigator.serviceWorker.register(swPath, { scope: import.meta.env.BASE_URL });
        })
        .then((registration) => {
          logger.info('Service Worker registered successfully', { scope: registration.scope, swPath });
        })
        .catch(async (error) => {
          logger.warn('Service Worker registration skipped/failed', { error, swPath });
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
          } catch (unregisterError) {
            logger.debug('Could not unregister stale service workers after registration failure', { unregisterError });
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
