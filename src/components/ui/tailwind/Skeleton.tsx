import React from 'react';
import { cn } from '../../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'none';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  animation = 'pulse',
  width,
  height,
  ...props
}) => {
  const baseStyles = 'bg-gray-200 dark:bg-gray-700';
  
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  };
  
  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: '',
  };

  const styles: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        animations[animation],
        className
      )}
      style={styles}
      aria-hidden="true"
      {...props}
    />
  );
};

// Pre-configured skeleton layouts
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={cn('h-4', i === lines - 1 && 'w-3/4')}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-4 space-y-4', className)}>
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="h-4 w-1/3" />
        <Skeleton variant="text" className="h-3 w-1/4" />
      </div>
    </div>
    <Skeleton variant="rounded" className="h-32 w-full" />
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonForm: React.FC<{ fields?: number; className?: string }> = ({
  fields = 3,
  className,
}) => (
  <div className={cn('space-y-6', className)}>
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton variant="text" className="h-4 w-24" />
        <Skeleton variant="rounded" className="h-12 w-full" />
      </div>
    ))}
    <Skeleton variant="rounded" className="h-12 w-full" />
  </div>
);
