/**
 * Enhanced Error Boundary - Lugn & Trygg Design System
 * WCAG 2.1 AA compliant error handling with accessibility features
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

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

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Enhanced error tracking with analytics
    import('../services/analytics').then(({ analytics }) => {
      analytics.error(error, {
        component: 'ErrorBoundary',
        action: 'component_error',
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // Log error to external service in production
    if (process.env.NODE_ENV === 'production') {
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
      const showDetails = this.props.showDetails || process.env.NODE_ENV === 'development';

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4 bg-gray-50"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <Card
            title="🚨 Något gick fel"
            className="max-w-md w-full"
            elevation="medium"
          >
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                Vi är ledsna, men något oväntat hände. Vårt team har fått information om felet.
              </p>

              <div className="flex flex-col gap-3">
                {canRetry ? (
                  <Button
                    onClick={this.handleRetry}
                    variant="primary"
                    fullWidth
                    aria-label={`Försök igen (${retryCount + 1}/${this.maxRetries + 1})`}
                  >
                    🔄 Försök igen {retryCount > 0 && `(${retryCount}/${this.maxRetries})`}
                  </Button>
                ) : (
                  <Button
                    onClick={this.handleReload}
                    variant="primary"
                    fullWidth
                    aria-label="Ladda om sidan"
                  >
                    🔄 Ladda om sidan
                  </Button>
                )}

                <Button
                  onClick={() => window.history.back()}
                  variant="outline"
                  fullWidth
                  aria-label="Gå tillbaka"
                >
                  ← Gå tillbaka
                </Button>
              </div>

              {showDetails && error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Tekniska detaljer (för utvecklare)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-40">
                    <div className="font-semibold text-red-600 mb-2">Fel:</div>
                    <div className="text-gray-800 mb-3">{error.toString()}</div>
                    {errorInfo?.componentStack && (
                      <>
                        <div className="font-semibold text-red-600 mb-2">Komponent stack:</div>
                        <pre className="text-gray-700 whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  Om problemet kvarstår, kontakta vår support:
                </p>
                <a
                  href="mailto:support@lugntrygg.se"
                  className="text-primary hover:text-primary-dark underline"
                  aria-label="Skicka e-post till support"
                >
                  📧 support@lugntrygg.se
                </a>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;