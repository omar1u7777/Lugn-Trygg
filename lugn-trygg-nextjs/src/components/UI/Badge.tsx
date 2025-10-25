"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { BadgeProps } from './types';

const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  rounded = true,
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center font-medium transition-colors duration-200';

  const variantClasses = {
    default: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const roundedClasses = rounded ? 'rounded-full' : 'rounded-md';

  const badgeClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${roundedClasses} ${className}`;

  if (dot) {
    return (
      <motion.span
        className={`inline-block w-2 h-2 ${variantClasses[variant].split(' ')[0]} rounded-full`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
        {...props}
      />
    );
  }

  return (
    <motion.span
      className={badgeClasses}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.span>
  );
};

export default Badge;