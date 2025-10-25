"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { CardProps } from './types';

const Card: React.FC<CardProps> = ({
  header,
  footer,
  padding = true,
  shadow = 'md',
  hover = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200';

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  };

  const hoverClasses = hover ? 'hover:shadow-lg hover:-translate-y-1' : '';

  const paddingClasses = padding ? 'p-6' : '';

  const cardClasses = `${baseClasses} ${shadowClasses[shadow]} ${hoverClasses} ${className}`;

  return (
    <motion.div
      className={cardClasses}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { y: -4 } : {}}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {header}
        </div>
      )}

      <div className={paddingClasses}>
        {children}
      </div>

      {footer && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          {footer}
        </div>
      )}
    </motion.div>
  );
};

export default Card;