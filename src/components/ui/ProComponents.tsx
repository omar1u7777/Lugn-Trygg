/**
 * Lugn & Trygg Professional UI Components
 * Reusable, accessible component library
 * Version: 2.0
 */

import React, { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import '../styles/design-system.css';

// ============================================================================
// BUTTON COMPONENTS
// ============================================================================

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const variantClasses = {
    primary: 'btn-primary-pro',
    secondary: 'btn-secondary-pro',
    ghost: 'btn-ghost-pro',
    danger: 'btn-danger-pro',
  };

  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  return (
    <button
      className={`btn-professional ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="spinner" style={{ width: '1rem', height: '1rem' }} />
      )}
      {!isLoading && leftIcon && <span>{leftIcon}</span>}
      <span>{children}</span>
      {!isLoading && rightIcon && <span>{rightIcon}</span>}
    </button>
  );
};

export const IconButton: React.FC<ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }> = ({
  icon,
  className = '',
  ...props
}) => {
  return (
    <button className={`btn-icon btn-ghost-pro ${className}`} {...props}>
      {icon}
    </button>
  );
};

// ============================================================================
// CARD COMPONENTS
// ============================================================================

interface CardProps {
  children: ReactNode;
  elevated?: boolean;
  gradient?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, elevated, gradient, className = '', onClick }) => {
  const baseClass = elevated ? 'card-elevated' : 'card-professional';
  const gradientClass = gradient ? 'card-gradient-header' : '';

  return (
    <div
      className={`${baseClass} ${gradientClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`card-header-pro ${className}`}>{children}</div>
);

export const CardBody: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`card-body-pro ${className}`}>{children}</div>
);

export const CardFooter: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`card-footer-pro ${className}`}>{children}</div>
);

// ============================================================================
// FORM COMPONENTS
// ============================================================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, className = '', id, ...props }) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="form-group-pro">
      {label && (
        <label htmlFor={inputId} className="form-label-pro">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`form-input-pro ${error ? 'border-red-500' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className="form-error-pro" role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={`${inputId}-helper`} className="form-helper-pro">
          {helperText}
        </span>
      )}
    </div>
  );
};

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, helperText, className = '', id, rows = 4, ...props }) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="form-group-pro">
      {label && (
        <label htmlFor={textareaId} className="form-label-pro">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={`form-input-pro form-textarea-pro ${error ? 'border-red-500' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        {...props}
      />
      {error && (
        <span id={`${textareaId}-error`} className="form-error-pro" role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={`${textareaId}-helper`} className="form-helper-pro">
          {helperText}
        </span>
      )}
    </div>
  );
};

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select: React.FC<SelectProps> = ({ label, error, helperText, options, className = '', id, ...props }) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="form-group-pro">
      {label && (
        <label htmlFor={selectId} className="form-label-pro">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`form-input-pro form-select-pro ${error ? 'border-red-500' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${selectId}-error`} className="form-error-pro" role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={`${selectId}-helper`} className="form-helper-pro">
          {helperText}
        </span>
      )}
    </div>
  );
};

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, className = '', id, ...props }) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={checkboxId}
        className={`form-checkbox-pro ${className}`}
        {...props}
      />
      <label htmlFor={checkboxId} className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
        {label}
      </label>
    </div>
  );
};

// ============================================================================
// BADGE COMPONENTS
// ============================================================================

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  icon?: ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', icon, className = '' }) => {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  return (
    <span className={`badge-pro ${variantClasses[variant]} ${className}`}>
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

// ============================================================================
// ALERT COMPONENTS
// ============================================================================

interface AlertProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info';
  icon?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ children, variant = 'info', icon, onClose, className = '' }) => {
  const variantClasses = {
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error',
    info: 'alert-info',
  };

  const defaultIcons = {
    success: <CheckCircleIcon className="w-5 h-5" aria-hidden="true" />,
    warning: <ExclamationTriangleIcon className="w-5 h-5" aria-hidden="true" />,
    error: <XCircleIcon className="w-5 h-5" aria-hidden="true" />,
    info: <InformationCircleIcon className="w-5 h-5" aria-hidden="true" />,
  };

  return (
    <div className={`alert-pro ${variantClasses[variant]} ${className}`} role="alert">
      <div>{icon || defaultIcons[variant]}</div>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="btn-icon btn-ghost-pro ml-auto"
          aria-label="Close alert"
        >
          <XMarkIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// LOADING COMPONENTS
// ============================================================================

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return <div className={`spinner ${sizeClasses[size]} ${className}`} />;
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className = '' }) => (
  <div className={className}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="skeleton skeleton-text" />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card-professional ${className}`}>
    <div className="card-body-pro space-y-4">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-button" />
    </div>
  </div>
);

// ============================================================================
// MODAL COMPONENT
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl scale-in overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {title && (
          <div className="card-header-pro flex items-center justify-between">
            <h2 id="modal-title" className="heading-3">
              {title}
            </h2>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onClose}
              aria-label="Close modal"
            >
              <XMarkIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="card-body-pro max-h-[70vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && <div className="card-footer-pro flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  );
};

// ============================================================================
// TYPOGRAPHY COMPONENTS
// ============================================================================

export const Heading1: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h1 className={`heading-1 ${className}`}>{children}</h1>
);

export const Heading2: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`heading-2 ${className}`}>{children}</h2>
);

export const Heading3: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h3 className={`heading-3 ${className}`}>{children}</h3>
);

export const Heading4: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h4 className={`heading-4 ${className}`}>{children}</h4>
);

export const BodyText: React.FC<{ children: ReactNode; size?: 'large' | 'base' | 'small'; className?: string }> = ({
  children,
  size = 'base',
  className = '',
}) => {
  const sizeClasses = {
    large: 'body-large',
    base: 'body-base',
    small: 'body-small',
  };

  return <p className={`${sizeClasses[size]} ${className}`}>{children}</p>;
};


