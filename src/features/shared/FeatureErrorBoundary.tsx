/**
 * Feature-level Error Boundary
 * 
 * Provides graceful error handling for individual features
 * without crashing the entire application.
 */

import React, { Component, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';import { logger } from '../../utils/logger';


interface Props {
  children: ReactNode;
  featureName: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log to console in development
    logger.error(`[${this.props.featureName}] Error:`, error);
    logger.error('Error Info:', errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // In production, send to error tracking service
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        extra: {
          feature: this.props.featureName,
          componentStack: errorInfo.componentStack,
        },
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
          </div>
          
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Något gick fel i {this.props.featureName}
          </h3>
          
          <p className="text-sm text-red-600 dark:text-red-300 text-center mb-4 max-w-md">
            Vi kunde inte ladda denna funktion. Detta påverkar inte resten av appen.
          </p>

          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Försök igen
          </button>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 w-full max-w-lg">
              <summary className="cursor-pointer text-sm text-red-500 hover:underline">
                Visa tekniska detaljer
              </summary>
              <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/60 rounded-lg text-xs overflow-auto text-red-800 dark:text-red-200">
                {this.state.error.message}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with FeatureErrorBoundary
 */
export function withFeatureErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <FeatureErrorBoundary featureName={featureName}>
        <WrappedComponent {...props} />
      </FeatureErrorBoundary>
    );
  };
}

export default FeatureErrorBoundary;
