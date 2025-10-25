"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Loading from './Loading';

interface LoadingOverlayProps {
  isVisible: boolean;
  text?: string;
  variant?: 'spinner' | 'pulse' | 'dots';
  className?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  text = "Laddar...",
  variant = 'spinner',
  className = '',
}) => {
  if (!isVisible) return null;

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-slate-800 rounded-lg shadow-xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Loading size="lg" variant={variant} />
        {text && (
          <motion.p
            className="text-sm text-slate-600 dark:text-slate-300 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {text}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LoadingOverlay;