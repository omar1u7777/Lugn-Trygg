import React from 'react';
import { cn } from '../../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean; // MUI compatibility - removed from DOM
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>; // MUI compatibility
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      fullWidth, // MUI compatibility - destructure to remove from DOM
      inputProps, // MUI compatibility - merge with props
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    
    // Merge inputProps with props (MUI compatibility)
    const mergedProps = { ...props, ...inputProps };

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-[#2f2a24] dark:text-gray-300 mb-1.5"
          >
            {label}
            {props.required && (
              <span className="text-[#c08a5d] ml-1" aria-label="obligatoriskt fält">
                *
              </span>
            )}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89f97]">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-[#2f2a24] dark:text-gray-100 transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
              'placeholder:text-[#a89f97] dark:placeholder:text-gray-500',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#f2e4d4] dark:disabled:bg-gray-800',
              hasError
                ? 'border-[#ffb3ba] bg-[#fff5f5] dark:bg-error-900/10 focus-visible:border-[#ffb3ba] focus-visible:ring-[#ffb3ba]/30'
                : 'border-[#e8dcd0] dark:border-gray-600 bg-white dark:bg-gray-800 focus-visible:border-[#2c8374] focus-visible:ring-[#2c8374]/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            aria-invalid={hasError}
            aria-describedby={cn(
              error && errorId,
              helperText && helperId
            )}
            aria-required={props.required}
            {...mergedProps}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a89f97]">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={cn(
              'mt-1.5 text-sm',
              hasError
                ? 'text-error-600 dark:text-error-400'
                : 'text-gray-600 dark:text-gray-400'
            )}
            role={hasError ? 'alert' : 'status'}
            aria-live={hasError ? 'assertive' : 'polite'}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const textareaId = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
            {props.required && (
              <span className="text-error-500 ml-1" aria-label="obligatoriskt fält">
                *
              </span>
            )}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-gray-900 dark:text-gray-100 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800',
            'resize-y min-h-[100px]',
            hasError
              ? 'border-error-500 bg-error-50 dark:bg-error-900/10 focus-visible:border-error-500 focus-visible:ring-error-500/20'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus-visible:border-primary-500 focus-visible:ring-primary-500/20',
            className
          )}
          aria-invalid={hasError}
          aria-describedby={cn(
            error && errorId,
            helperText && helperId
          )}
          aria-required={props.required}
          {...props}
        />
        
        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={cn(
              'mt-1.5 text-sm',
              hasError
                ? 'text-error-600 dark:text-error-400'
                : 'text-gray-600 dark:text-gray-400'
            )}
            role={hasError ? 'alert' : 'status'}
            aria-live={hasError ? 'assertive' : 'polite'}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
