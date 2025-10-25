"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { InputProps } from './types';

const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value = '',
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  required = false,
  error,
  label,
  helperText,
  state = 'default',
  icon,
  iconPosition = 'left',
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value);

  const baseClasses = 'w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2';

  const stateClasses = {
    default: 'border-slate-300 dark:border-slate-600 focus:ring-primary-500 focus:border-primary-500',
    error: 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500',
    success: 'border-green-300 dark:border-green-600 focus:ring-green-500 focus:border-green-500',
    warning: 'border-yellow-300 dark:border-yellow-600 focus:ring-yellow-500 focus:border-yellow-500',
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-700' : '';

  const inputClasses = `${baseClasses} ${stateClasses[state]} ${disabledClasses} ${icon ? (iconPosition === 'left' ? 'pl-10' : 'pr-10') : ''} ${className}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) {
      onFocus();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  };

  const currentValue = onChange ? value : internalValue;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500">
            {icon}
          </div>
        )}

        <motion.input
          type={type}
          placeholder={placeholder}
          value={currentValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          className={inputClasses}
          animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
          {...props}
        />

        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500">
            {icon}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <motion.div
          className={`mt-1 text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {error || helperText}
        </motion.div>
      )}
    </div>
  );
};

export default Input;