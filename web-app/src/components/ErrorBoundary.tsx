import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Log error to external service in production
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <div className="error-boundary-content">
            <h2>🚨 Något gick fel</h2>
            <p>Vi är ledsna, men något oväntat hände. Vårt team har fått information om felet.</p>

            <div className="error-actions">
              <button
                onClick={() => window.location.reload()}
                className="retry-button"
                aria-label="Ladda om sidan för att försöka igen"
              >
                🔄 Ladda om sidan
              </button>

              <button
                onClick={() => this.setState({ hasError: false })}
                className="reset-button"
                aria-label="Försök återställa applikationen"
              >
                🔧 Försök återställa
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Tekniska detaljer (för utvecklare)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-support">
              <p>Om problemet kvarstår, kontakta vår support:</p>
              <a href="mailto:support@lugntrygg.se" aria-label="Skicka e-post till support">
                📧 support@lugntrygg.se
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;