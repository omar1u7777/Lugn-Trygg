"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}) => {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700 animate-pulse';

  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
      default:
        return 'rounded';
    }
  };

  const getSizeClasses = () => {
    const widthClass = width ? (typeof width === 'number' ? `w-${width}` : `w-[${width}]`) : '';
    const heightClass = height ? (typeof height === 'number' ? `h-${height}` : `h-[${height}]`) : '';
    return `${widthClass} ${heightClass}`;
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <motion.div
            key={index}
            className={`${baseClasses} ${getVariantClasses()} ${getSizeClasses()}`}
            style={{
              width: index === lines - 1 ? '60%' : '100%', // Last line shorter
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${getVariantClasses()} ${getSizeClasses()} ${className}`}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};

// Pre-built skeleton components for common use cases
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 border border-slate-200 dark:border-slate-700 rounded-lg ${className}`}>
    <Skeleton variant="rectangular" height="20" className="mb-3" />
    <Skeleton variant="text" lines={3} />
  </div>
);

export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({
  count = 3,
  className = ''
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3">
        <Skeleton variant="circular" width="10" height="10" />
        <div className="flex-1">
          <Skeleton variant="text" className="mb-1" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <Skeleton
      variant="circular"
      className={`${sizeClasses[size]} ${className}`}
    />
  );
};

export default Skeleton;