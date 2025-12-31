/**
 * Lazy Loading Wrapper Component - Lugn & Trygg Design System
 * Provides consistent lazy loading with error boundaries and loading states
 */

import React, { Suspense, ComponentType, LazyExoticComponent, lazy } from 'react';
import { LoadingSpinner } from './LoadingStates';
import ErrorBoundary from './ErrorBoundary';

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
}

/**
 * Wrapper for lazy-loaded components with consistent loading and error states
 */
export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback,
  errorFallback,
}) => {
  const defaultFallback = (
    <div className="min-h-[200px] flex items-center justify-center">
      <LoadingSpinner isLoading={true} message="Laddar komponent..." />
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback || defaultFallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * Higher-order component for lazy loading with retry functionality
 */
export const withLazyLoading = <P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  chunkName?: string
): LazyExoticComponent<ComponentType<P>> => {
  const LazyComponent = lazy(() =>
    importFunc().catch((error) => {
      console.error(`Failed to load component${chunkName ? ` (${chunkName})` : ''}:`, error);
      // Return a fallback component
      return {
        default: (() => (
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-gray-600">Kunde inte ladda komponenten</p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary mt-4"
              >
                Ladda om sidan
              </button>
            </div>
          </div>
        )) as ComponentType<P>
      };
    })
  );

  return LazyComponent;
};

/**
 * Preload function for critical components
 */
export const preloadComponent = (importFunc: () => Promise<any>) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  // This is a simplified version - in production you'd need more sophisticated preloading
  importFunc();
};

export default LazyWrapper;
