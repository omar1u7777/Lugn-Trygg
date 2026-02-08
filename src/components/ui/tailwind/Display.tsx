import React from 'react';
import { cn } from '../../../utils/cn';
import OptimizedImage from '../OptimizedImage';

// Avatar Component
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, size = 'md', fallback, ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    };

    const pixelSizes = {
      sm: 32,
      md: 40,
      lg: 48,
      xl: 64,
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex items-center justify-center rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium',
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          <OptimizedImage
            src={src}
            alt={alt || 'Avatar'}
            width={pixelSizes[size]}
            height={pixelSizes[size]}
            sizes={`${pixelSizes[size]}px`}
            className="w-full h-full object-cover"
            placeholder="blur"
          />
        ) : (
          <span>{fallback || alt?.charAt(0).toUpperCase() || '?'}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// Progress Bar Component
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // Optional for LinearProgress (indeterminate mode)
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'determinate'; // MUI compatibility
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  sx?: any; // MUI compatibility - ignored
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', size = 'md', showLabel = false, sx, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const effectiveVariant = variant === 'determinate' ? 'default' : variant; // MUI compatibility

    const variants = {
      default: 'bg-primary-600',
      success: 'bg-success-600',
      warning: 'bg-warning-600',
      error: 'bg-error-600',
    };

    const sizes = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        <div className={cn('w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden', sizes[size])}>
          <div
            className={cn('h-full transition-all duration-300 ease-in-out', variants[effectiveVariant])}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
          />
        </div>
        {showLabel && (
          <span className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {percentage.toFixed(0)}%
          </span>
        )}
      </div>
    );
  }
);

Progress.displayName = 'Progress';

// Spinner Component
interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizes = {
      sm: 'w-4 h-4 border-2',
      md: 'w-6 h-6 border-4',
      lg: 'w-8 h-8 border-4',
    };

    return (
      <div ref={ref} className={cn('inline-block', className)} {...props}>
        <div
          className={cn(
            'rounded-full border-gray-300 dark:border-gray-600 border-t-primary-600 animate-spin',
            sizes[size]
          )}
        />
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

// Skeleton Component
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', width, height, ...props }, ref) => {
    const variants = {
      text: 'rounded',
      circular: 'rounded-full',
      rectangular: 'rounded-lg',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-gray-200 dark:bg-gray-700 animate-pulse',
          variants[variant],
          variant === 'text' && 'h-4',
          className
        )}
        style={{ width, height }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Divider Component
interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed';
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = 'horizontal', variant = 'solid', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-gray-300 dark:bg-gray-600',
          orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
          variant === 'dashed' && 'border-dashed',
          className
        )}
        {...props}
      />
    );
  }
);

Divider.displayName = 'Divider';
