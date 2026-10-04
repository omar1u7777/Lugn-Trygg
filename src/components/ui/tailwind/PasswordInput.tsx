import React from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { usePasswordToggle } from '../../../hooks/usePasswordToggle';
import { Input } from './Input';

export interface PasswordInputProps {
  id: string;
  /** Submitted field name. Without it a password manager has nothing to key on. */
  name?: string | undefined;
  /**
   * `current-password` when signing in, `new-password` when registering or
   * changing. The interface was closed and carried neither this nor `name`, so
   * every password field in the app was invisible to password managers — they
   * could not fill it and, worse, could not offer to save it. WCAG 2.1 SC 1.3.5.
   */
  autoComplete?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  error?: string | undefined;
  helpText?: string | undefined;
  dataTestId?: string | undefined;
  ariaDescribedBy?: string | undefined;
  ariaInvalid?: boolean;
  className?: string | undefined;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  autoComplete,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  helpText,
  dataTestId,
  ariaDescribedBy,
  ariaInvalid,
  className = '',
}) => {
  const { t } = useTranslation();
  // This was the same useState + useCallback pair that usePasswordToggle
  // already provides and already has tests for. Two implementations of
  // "show the password or not", and the tested one was the unused one.
  const { showPassword, togglePassword } = usePasswordToggle();

  const describedBy = error ? `${id}-error` : helpText ? `${id}-help` : ariaDescribedBy;

  return (
    <div className="relative">
      <Input
        id={id}
        name={name ?? id}
        autoComplete={autoComplete ?? 'current-password'}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`pr-12 ${className}`}
        data-testid={dataTestId}
        aria-describedby={describedBy}
        aria-invalid={!!error || ariaInvalid}
      />
      <button
        type="button"
        onClick={togglePassword}
        disabled={disabled}
        title={showPassword ? t('common.hidePassword') : t('common.showPassword')}
        aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
        aria-pressed={showPassword}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
      </button>
      {helpText && !error && (
        <p id={`${id}-help`} className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          {helpText}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default PasswordInput;
