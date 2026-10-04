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
  sx?: React.CSSProperties; // MUI compatibility - ignored
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
    
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500 shadow-md hover:shadow-lg active:scale-[0.98]',
      secondary: 'bg-calm-200 text-calm-800 hover:bg-calm-300 focus-visible:ring-secondary-500 active:scale-[0.98]',
      success: 'bg-success-300 text-primary-600 hover:bg-success-400 focus-visible:ring-success-300 active:scale-[0.98]',
      error: 'bg-error-200 text-error-800 hover:bg-error-300 focus-visible:ring-error-200 active:scale-[0.98]',
      outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10 focus-visible:ring-primary-500 active:scale-[0.98]',
      ghost: 'text-calm-600 hover:bg-calm-200 focus-visible:ring-secondary-500 active:scale-[0.98]',
    };
    
    // Padding alone left md at 40px and sm at 32px. 44px is the touch target
    // every mobile platform assumes (Apple HIG 44pt, Material 48dp) and what
    // WCAG 2.5.5 asks for; below it, people miss and hit something else.
    // md and lg carry the primary actions and get the full 44. sm is for
    // dense inline controls where 44 would break the layout it sits in — it
    // stays compact and still clears the 24px WCAG 2.5.8 AA floor.
    const sizes = {
      sm: 'px-3 py-1.5 text-sm min-h-[32px]',
      md: 'px-4 py-2 text-base min-h-[44px]',
      lg: 'px-6 py-3 text-lg min-h-[44px]',
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
