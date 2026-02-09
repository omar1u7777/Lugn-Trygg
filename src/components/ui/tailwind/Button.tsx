import React from 'react';
import { cn } from '../../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large'; // MUI compatibility
  loading?: boolean; // MUI compatibility
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  sx?: any; // MUI compatibility - ignored
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      loading, // MUI compatibility
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth,
      startIcon,
      endIcon,
      disabled,
      sx: _sx, // MUI compatibility - destructure to remove from DOM
      ...props
    },
    ref
  ) => {
    // Use startIcon/endIcon as aliases for leftIcon/rightIcon for MUI compatibility
    const actualLeftIcon = leftIcon || startIcon;
    const actualRightIcon = rightIcon || endIcon;
    const actualLoading = loading || isLoading; // MUI compatibility
    const widthClass = fullWidth ? 'w-full' : '';
    
    // Normalize size for MUI compatibility
    const normalizedSize = size === 'small' ? 'sm' : size === 'medium' ? 'md' : size === 'large' ? 'lg' : size;
    
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-[#2c8374] text-white hover:bg-[#1e5f54] focus-visible:ring-[#2c8374] shadow-md hover:shadow-lg active:scale-[0.98]',
      secondary: 'bg-[#f2e4d4] text-[#2f2a24] hover:bg-[#e8dcd0] focus-visible:ring-[#c08a5d] active:scale-[0.98]',
      success: 'bg-[#a8e6cf] text-[#1e5f54] hover:bg-[#8fd9bc] focus-visible:ring-[#a8e6cf] active:scale-[0.98]',
      error: 'bg-[#ffb3ba] text-[#8b3a3a] hover:bg-[#ff9aa2] focus-visible:ring-[#ffb3ba] active:scale-[0.98]',
      outline: 'border-2 border-[#2c8374] text-[#2c8374] hover:bg-[#2c8374]/10 focus-visible:ring-[#2c8374] active:scale-[0.98]',
      ghost: 'text-[#6d645d] hover:bg-[#f2e4d4] focus-visible:ring-[#c08a5d] active:scale-[0.98]',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[normalizedSize],
          widthClass,
          className
        )}
        disabled={disabled || actualLoading}
        aria-busy={actualLoading}
        aria-disabled={disabled || actualLoading}
        {...props}
      >
        {actualLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {actualLeftIcon && <span className="mr-2">{actualLeftIcon}</span>}
        {children}
        {actualRightIcon && <span className="ml-2">{actualRightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
