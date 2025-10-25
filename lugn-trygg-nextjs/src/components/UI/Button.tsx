"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ButtonProps } from './types';

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  icon,
  iconPosition = 'left',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantClasses = {
    primary: 'bg-primary-500 text-white border border-primary-500 hover:bg-primary-600 focus:ring-primary-500 shadow-sm hover:shadow-md',
    secondary: 'bg-secondary-500 text-white border border-secondary-500 hover:bg-secondary-600 focus:ring-secondary-500 shadow-sm hover:shadow-md',
    outline: 'bg-transparent text-primary-600 border border-primary-600 hover:bg-primary-600 hover:text-white focus:ring-primary-500',
    ghost: 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
    danger: 'bg-red-500 text-white border border-red-500 hover:bg-red-600 focus:ring-red-500 shadow-sm hover:shadow-md',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  const content = (
    <>
      {loading && (
        <motion.div
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
      {children && (
        <span className={loading ? 'ml-2' : ''}>{children}</span>
      )}
      {!loading && icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
    </>
  );

  return (
    <motion.button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={handleClick}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      {...props}
    >
      {content}
    </motion.button>
  );
};

export default Button;