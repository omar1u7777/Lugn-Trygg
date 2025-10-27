/**
 * Button Component - Lugn & Trygg Design System
 * Consistent button styles with accessibility and theming support
 */

import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps } from '@mui/material';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'btn btn-primary';
      case 'secondary':
        return 'btn btn-secondary';
      case 'outline':
        return 'btn btn-outline';
      case 'ghost':
        return 'btn btn-ghost';
      case 'danger':
        return 'btn btn-danger';
      default:
        return 'btn btn-primary';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'text-sm py-2 px-3';
      case 'large':
        return 'text-lg py-3 px-6';
      default:
        return 'text-base py-2 px-4';
    }
  };

  const buttonClasses = [
    getVariantClasses(),
    getSizeClasses(),
    fullWidth ? 'w-full' : '',
    loading ? 'opacity-75 cursor-not-allowed' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <MuiButton
      className={buttonClasses}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      {...props}
    >
      {loading && (
        <span className="mr-2 inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      )}
      {children}
    </MuiButton>
  );
};

export default Button;