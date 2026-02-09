import React from 'react';
import { cn } from '../../../utils/cn';
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Alert Component
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error' | 'warning' | 'info';
  severity?: 'success' | 'error' | 'warning' | 'info'; // MUI compatibility
  onClose?: () => void;
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, severity, onClose, icon, children, ...props }, ref) => {
    // Use severity as alias for variant for MUI compatibility
    const effectiveVariant = variant || severity || 'info';
    
    const variants = {
      success: {
        container: 'bg-success-50 border-success-200 text-success-800 dark:bg-success-900/20 dark:border-success-800 dark:text-success-300',
        icon: CheckCircleIcon,
      },
      error: {
        container: 'bg-error-50 border-error-200 text-error-800 dark:bg-error-900/20 dark:border-error-800 dark:text-error-300',
        icon: ExclamationCircleIcon,
      },
      warning: {
        container: 'bg-warning-50 border-warning-200 text-warning-800 dark:bg-warning-900/20 dark:border-warning-800 dark:text-warning-300',
        icon: ExclamationTriangleIcon,
      },
      info: {
        container: 'bg-primary-50 border-primary-200 text-primary-800 dark:bg-primary-900/20 dark:border-primary-800 dark:text-primary-300',
        icon: InformationCircleIcon,
      },
    };

    const IconComponent = variants[effectiveVariant].icon;

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          variants[effectiveVariant].container,
          className
        )}
        {...props}
      >
        {icon ? (
          icon
        ) : (
          <IconComponent className="w-5 h-5 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-auto -mt-0.5 -mr-1 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

// Badge Component
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      warning: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
      error: 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300',
      secondary: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm',
      lg: 'px-3 py-1 text-base',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Chip Component (similar to Badge but with optional icon and close button)
interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  label?: string; // MUI compatibility - alias for children
  onDelete?: () => void;
  color?: string; // MUI compatibility - ignored
}

export const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, variant = 'default', size = 'md', icon, label, onDelete, children, color: _color, ...props }, ref) => {
    const content = label || children; // MUI compatibility
    const variants = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      warning: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
      error: 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300',
      outline: 'border-2 border-gray-300 bg-transparent text-gray-800 dark:border-gray-600 dark:text-gray-300',
    };

    const sizes = {
      sm: 'px-2 py-1 text-xs gap-1',
      md: 'px-2.5 py-1.5 text-sm gap-1.5',
      lg: 'px-3 py-2 text-base gap-2',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{content}</span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex-shrink-0 ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} />
          </button>
        )}
      </div>
    );
  }
);

Chip.displayName = 'Chip';
