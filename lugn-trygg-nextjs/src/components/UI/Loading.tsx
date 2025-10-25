"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { LoadingProps } from './types';

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  color,
  text,
  overlay = false,
  variant = 'spinner',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const spinnerColor = color || 'text-primary-500';

  const renderSpinner = () => (
    <motion.div
      className={`inline-block ${sizeClasses[size]} ${spinnerColor} ${className}`}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
      {...props}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </motion.div>
  );

  const renderPulse = () => (
    <motion.div
      className={`inline-block ${sizeClasses[size]} bg-primary-500 rounded-full ${className}`}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      {...props}
    />
  );

  const renderDots = () => {
    const dotSize = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

    return (
      <div className={`flex space-x-1 ${className}`} {...props}>
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`${dotSize} bg-primary-500 rounded-full`}
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: index * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    );
  };

  const getLoader = () => {
    switch (variant) {
      case 'pulse':
        return renderPulse();
      case 'dots':
        return renderDots();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  const spinner = getLoader();

  if (overlay) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-slate-800 rounded-lg shadow-xl">
          {spinner}
          {text && (
            <motion.p
              className="text-sm text-slate-600 dark:text-slate-300"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {text}
            </motion.p>
          )}
        </div>
      </motion.div>
    );
  }

  if (text) {
    return (
      <div className="flex flex-col items-center gap-3">
        {spinner}
        <motion.p
          className="text-sm text-slate-600 dark:text-slate-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      </div>
    );
  }

  return spinner;
};

export default Loading;