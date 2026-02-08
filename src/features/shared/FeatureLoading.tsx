/**
 * Feature Loading State
 * 
 * Consistent loading UI for all features.
 */

import React from 'react';

interface FeatureLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const FeatureLoading: React.FC<FeatureLoadingProps> = ({
  message = 'Laddar...',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const textClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      {/* Animated spinner */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-4 border-calm-200 dark:border-calm-700" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin" />
      </div>
      
      {message && (
        <p className={`mt-4 text-calm-600 dark:text-calm-300 ${textClasses[size]}`}>
          {message}
        </p>
      )}
    </div>
  );
};

/**
 * Skeleton loader for cards
 */
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="h-48 bg-calm-200 dark:bg-calm-700 rounded-2xl" />
  </div>
);

/**
 * Skeleton loader for list items
 */
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-calm-100 dark:bg-calm-800 rounded-xl">
        <div className="w-12 h-12 bg-calm-200 dark:bg-calm-700 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-calm-200 dark:bg-calm-700 rounded w-3/4" />
          <div className="h-3 bg-calm-200 dark:bg-calm-700 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for stats
 */
export const StatsSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="animate-pulse p-4 bg-calm-100 dark:bg-calm-800 rounded-xl">
        <div className="w-8 h-8 bg-calm-200 dark:bg-calm-700 rounded-lg mb-3" />
        <div className="h-6 bg-calm-200 dark:bg-calm-700 rounded w-1/2 mb-2" />
        <div className="h-4 bg-calm-200 dark:bg-calm-700 rounded w-3/4" />
      </div>
    ))}
  </div>
);

export default FeatureLoading;
