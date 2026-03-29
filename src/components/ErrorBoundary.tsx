/**
 * Enhanced Error Boundary - Lugn & Trygg Design System
 * WCAG 2.1 AA compliant error handling with accessibility features
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';


interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  private static recoverFromStaleBundleError() {
    const recoveryKey = 'bundle_recovery_attempt_ts';
    const lastAttemptRaw = sessionStorage.getItem(recoveryKey);
    const now = Date.now();
    const lastAttempt = lastAttemptRaw ? parseInt(lastAttemptRaw, 10) : 0;

    // Avoid infinite reload loops: only recover once every 10 seconds.
    if (lastAttempt && now - lastAttempt <= 10000) {
      return;
    }

    sessionStorage.setItem(recoveryKey, now.toString());

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          reg.unregister();
        });
      });
    }

    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.set('t', now.toString());
    window.location.replace(url.toString());
  }

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Detect ChunkLoadError (Vite/Webpack missing dynamically imported modules on new deployments)
    const isChunkLoadError = error?.name === 'ChunkLoadError' || 
                             (error?.message && /Failed to fetch dynamically imported module/i.test(error.message)) ||
                             (error?.message && /Importing a module script failed/i.test(error.message)) ||
                             (error?.message && /missing/i.test(error.message) && /dynamically imported/i.test(error.message));
    const isInitializationReferenceError =
      error?.name === 'ReferenceError' &&
      !!error?.message &&
      /Cannot access '.*' before initialization/i.test(error.message);

    if (typeof window !== 'undefined' && (isChunkLoadError || isInitializationReferenceError)) {
      ErrorBoundary.recoverFromStaleBundleError();
    }

    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Enhanced error tracking with analytics
    import('../services/analytics.lazy').then(({ analytics }) => {
      analytics.error(error, {
        component: 'ErrorBoundary',
        action: 'component_error',
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // Log error to external service in production
    if (import.meta.env.PROD) {
      // logErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Max retries reached, reload the page
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { retryCount, error, errorInfo } = this.state;
      const canRetry = retryCount < this.maxRetries;
      const showDetails = this.props.showDetails || import.meta.env.DEV;

      return (
        <div className="min-h-screen flex justify-center items-center p-4 bg-gray-50 dark:bg-gray-900"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
            <div className="flex items-center justify-center mb-6">
              <ExclamationTriangleIcon className="w-16 h-16 text-error-500" aria-hidden="true" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
              🚨 Något gick fel
            </h2>

            <div className="flex flex-col text-center space-y-6">
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                Vi är ledsna, men något oväntat hände. Vårt team har fått information om felet.
              </p>
                {this.state.error && (
                  <div className="text-xs text-left p-3 mt-2 mb-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded overflow-auto font-mono w-full break-words max-h-32 shadow-inner">
                    <strong>{this.state.error.name}:</strong> {this.state.error.message}
                  </div>
                )}
              <div className="flex flex-col gap-3">
                {canRetry ? (
                  <button
                    onClick={this.handleRetry}
                    className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
                    aria-label={`Försök igen (${retryCount + 1}/${this.maxRetries + 1})`}
                  >
                    🔄 Försök igen {retryCount > 0 && `(${retryCount}/${this.maxRetries})`}
                  </button>
                ) : (
                  <button
                    onClick={this.handleReload}
                    className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
                    aria-label="Ladda om sidan"
                  >
                    🔄 Ladda om sidan
                  </button>
                )}

                <button
                  onClick={() => window.history.back()}
                  className="w-full px-6 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
                  aria-label="Gå tillbaka"
                >
                  ← Gå tillbaka
                </button>
              </div>

              {showDetails && error && (
                <details className="text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 py-2">
                    Tekniska detaljer (för utvecklare)
                  </summary>
                  <div className="mt-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <p className="block font-semibold text-error-600 dark:text-error-400 text-sm mb-2">
                      Fel:
                    </p>
                    <p className="block text-sm text-gray-900 dark:text-gray-100 mb-4 break-words">
                      {error.toString()}
                    </p>
                    {errorInfo?.componentStack && (
                      <>
                        <p className="block font-semibold text-error-600 dark:text-error-400 text-sm mb-2">
                          Komponent stack:
                        </p>
                        <pre className="m-0 text-xs overflow-x-auto text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                          {errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Om problemet kvarstår, kontakta vår support:
                </p>
                <a
                  href="mailto:support@lugntrygg.se"
                  className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  aria-label="Skicka e-post till support"
                >
                  📧 support@lugntrygg.se
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
