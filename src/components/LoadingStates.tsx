/**
 * Enhanced Loading States & Indicators - Lugn & Trygg Design System
 * WCAG 2.1 AA compliant loading components with accessibility features
 * 100% Tailwind CSS - NO MUI dependencies
 */

import React from 'react';
import { Card } from './ui/tailwind';
import './LoadingStates.css';

interface LoadingProps {
  isLoading: boolean;
  children?: React.ReactNode;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Loading Spinner
 */
export const LoadingSpinner: React.FC<LoadingProps> = ({
  isLoading,
  children,
  message = 'Laddar...',
  size = 'medium',
}) => {
  if (!isLoading) return <>{children}</>;

  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  return (
    <div
      className="loading-spinner-container flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-atomic="true"
      aria-label={message}
    >
      <div
        className={`flex items-center justify-center`}
        role="progressbar"
        aria-label={message}
        aria-valuetext={message}
      >
        <div className={`${sizeClasses[size]} border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin`} />
      </div>
      {message && <p className="loading-message text-gray-700 dark:text-gray-300">{message}</p>}
    </div>
  );
};

/**
 * Skeleton Loading
 */
export const SkeletonLoader: React.FC<{
  count?: number;
  type?: 'text' | 'card' | 'list';
}> = ({ count = 3, type = 'text' }) => {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div
        className="skeleton-card-container grid gap-4"
        role="status"
        aria-live="polite"
        aria-label="Laddar kort"
      >
        {items.map((_, idx) => (
          <div
            key={idx}
            className="skeleton-card"
            role="progressbar"
            aria-label={`Laddar kort ${idx + 1} av ${count}`}
          >
            <div className="h-[200px] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-[30px] bg-gray-200 dark:bg-gray-700 rounded mt-2.5 animate-pulse" />
            <div className="h-[20px] bg-gray-200 dark:bg-gray-700 rounded mt-1.5 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div
        className="skeleton-list-container space-y-4"
        role="status"
        aria-live="polite"
        aria-label="Laddar lista"
      >
        {items.map((_, idx) => (
          <div
            key={idx}
            className="skeleton-list-item flex items-center gap-2.5"
            role="progressbar"
            aria-label={`Laddar listobjekt ${idx + 1} av ${count}`}
          >
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="skeleton-text-container space-y-2"
      role="status"
      aria-live="polite"
      aria-label="Laddar innehåll"
    >
      {items.map((_, idx) => (
        <div
          key={idx}
          className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          role="progressbar"
          aria-label={`Laddar rad ${idx + 1} av ${count}`}
        />
      ))}
    </div>
  );
};

/**
 * Loading Overlay
 */
export const LoadingOverlay: React.FC<LoadingProps> = ({
  isLoading,
  message = 'Laddar...',
}) => {
  if (!isLoading) return null;

  return (
    <div
      className="loading-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      aria-label={message}
    >
      <Card className="loading-overlay-content shadow-lg">
        <div className="flex flex-col items-center gap-4 p-6">
          <div
            className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"
            role="progressbar"
            aria-label={message}
            aria-valuetext={message}
          />
          <h6 className="overlay-message text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
            {message}
          </h6>
        </div>
      </Card>
    </div>
  );
};

/**
 * Pulse Loading Indicator
 */
export const PulseLoader: React.FC<{ size?: number }> = ({ size = 30 }) => {
  // Check for prefers-reduced-motion to respect accessibility preferences
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className={`pulse-loader ${prefersReducedMotion ? 'no-animation' : ''}`}
      style={{
        width: size,
        height: size,
      }}
      role="status"
      aria-label="Loading"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pulse-item" aria-hidden="true" />
    </div>
  );
};

/**
 * Progressive Loading (skeleton → content)
 */
export const ProgressiveLoad: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  skeletonCount?: number;
}> = ({ isLoading, children, skeletonCount = 3 }) => {
  if (isLoading) {
    return <SkeletonLoader count={skeletonCount} />;
  }
  return <>{children}</>;
};

export default {
  LoadingSpinner,
  SkeletonLoader,
  LoadingOverlay,
  PulseLoader,
  ProgressiveLoad,
};


