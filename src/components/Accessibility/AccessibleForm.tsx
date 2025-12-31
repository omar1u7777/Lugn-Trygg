import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';

// Constants for better maintainability
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const REQUIRED_ERROR_SUFFIX = ' är obligatoriskt';
const INVALID_EMAIL_ERROR = 'Ange en giltig e-postadress';
const FORM_SUBMITTING_MESSAGE = 'Formulär skickas...';
const FORM_ERROR_MESSAGE_PREFIX = 'Formuläret har ';
const FORM_ERROR_MESSAGE_SUFFIX = ' fel som måste åtgärdas innan det kan skickas';

/**
 * Interface for individual form fields with accessibility support
 */
interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel';
  required?: boolean;
  helperText?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Props for the AccessibleForm component
 */
interface AccessibleFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  success?: string;
  onSuccess?: () => void; // Optional callback after successful submit
}

/**
 * AccessibleField component for rendering individual form fields
 * Extracted for better maintainability and reusability
 */
const AccessibleField: React.FC<{
  field: FormField;
  value: string;
  error?: string;
  onChange: (fieldId: string, value: string) => void;
}> = memo(({ field, value, error, onChange }) => {
  const fieldError = error || field.error;
  const ariaDescribedBy = field.helperText || fieldError ? `${field.id}-helper` : undefined;

  return (
    <div className="mb-4">
      <label
        htmlFor={field.id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-1" aria-label="obligatoriskt">*</span>}
      </label>

      <input
        id={field.id}
        name={field.id}
        type={field.type}
        value={value}
        onChange={(event) => onChange(field.id, event.target.value)}
        aria-describedby={ariaDescribedBy}
        aria-label={field.label}
        aria-invalid={!!fieldError}
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${fieldError
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
          }
        `}
        required={field.required}
      />

      {(fieldError || field.helperText) && (
        <div
          id={`${field.id}-helper`}
          className={`mt-1 text-sm ${
            fieldError
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {fieldError || field.helperText}
        </div>
      )}
    </div>
  );
});

AccessibleField.displayName = 'AccessibleField';

/**
 * Validates a single field based on its type and requirements.
 * @param field - The field to validate
 * @param value - The trimmed value of the field
 * @returns Error message if invalid, null otherwise
 */
const validateField = (field: FormField, value: string): string | null => {
  // Required field validation
  if (field.required && value === '') {
    return `${field.label}${REQUIRED_ERROR_SUFFIX}`;
  }

  // Type-specific validation
  switch (field.type) {
    case 'email':
      if (value && !EMAIL_REGEX.test(value)) {
        return INVALID_EMAIL_ERROR;
      }
      break;
    case 'number':
      if (value && isNaN(Number(value))) {
        return 'Ange ett giltigt nummer';
      }
      break;
    case 'tel':
      // Basic phone validation: allow digits, spaces, hyphens, parentheses
      if (value && !/^[+\d\s\-\(\)]+$/.test(value)) {
        return 'Ange ett giltigt telefonnummer';
      }
      break;
    // Add more validations as needed
  }

  // Custom field error
  if (field.error) {
    return field.error;
  }

  return null;
};

/**
 * AccessibleForm component with enhanced accessibility, performance, and maintainability
 */
const AccessibleForm: React.FC<AccessibleFormProps> = memo(({
  fields,
  onSubmit,
  submitLabel = 'Skicka',
  loading = false,
  error,
  success,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { announceToScreenReader } = useAccessibility();

  // Memoize initial form data to avoid unnecessary recalculations
  const initialFormData = useMemo(() => {
    const data: Record<string, string> = {};
    fields.forEach(field => {
      data[field.id] = field.value || '';
    });
    return data;
  }, [fields]);

  // Initialize form data with memoized initial data
  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  // Announce form errors
  useEffect(() => {
    if (error) {
      announceToScreenReader(`Fel: ${error}`, 'assertive');
    }
  }, [error, announceToScreenReader]);

  // Announce form success
  useEffect(() => {
    if (success) {
      announceToScreenReader(`Framgång: ${success}`, 'polite');
    }
  }, [success, announceToScreenReader]);

  // Memoized field change handler to prevent unnecessary re-renders
  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setFieldErrors(prev => ({ ...prev, [fieldId]: '' }));

    // Find field and call onChange if provided
    const field = fields.find(f => f.id === fieldId);
    if (field?.onChange) {
      field.onChange(value);
    }
  }, [fields]);

  // Validation function using the extracted validateField logic
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      const value = formData[field.id]?.trim() || '';
      const error = validateField(field, value);
      if (error) {
        errors[field.id] = error;
        isValid = false;
      }
    });

    setFieldErrors(errors);

    if (!isValid) {
      const errorCount = Object.keys(errors).length;
      announceToScreenReader(
        `${FORM_ERROR_MESSAGE_PREFIX}${errorCount}${FORM_ERROR_MESSAGE_SUFFIX}`,
        'assertive'
      );
    }

    return isValid;
  }, [fields, formData, announceToScreenReader]);

  // Memoized submit handler with async support and error handling
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    announceToScreenReader(FORM_SUBMITTING_MESSAGE, 'polite');

    try {
      await onSubmit(formData);
      // Reset form data on success
      setFormData(initialFormData);
      setFieldErrors({});
      onSuccess?.();
    } catch (submitError) {
      // Handle submission errors, e.g., set a general error
      console.error('Form submission error:', submitError);
      // Optionally set an error state or announce
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, onSubmit, formData, initialFormData, announceToScreenReader, onSuccess]);

  // Memoize rendered fields for performance
  const renderedFields = useMemo(() =>
    fields.map(field => (
      <AccessibleField
        key={field.id}
        field={field}
        value={formData[field.id] || ''}
        error={fieldErrors[field.id]}
        onChange={handleFieldChange}
      />
    )), [fields, formData, fieldErrors, handleFieldChange]
  );

  const isDisabled = loading || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit}
      role="form"
      aria-label="Formulär"
      className="space-y-4"
    >
      {renderedFields}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
        >
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-describedby={error ? 'form-error' : success ? 'form-success' : undefined}
      >
        {isDisabled ? 'Skickar...' : submitLabel}
      </button>
    </form>
  );
});

AccessibleForm.displayName = 'AccessibleForm';

export default AccessibleForm;
