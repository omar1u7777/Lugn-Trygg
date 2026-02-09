import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationRule {
  validate: (value: any, formData?: Record<string, any>) => boolean;
  message: string;
}

export interface FieldValidation {
  rules: ValidationRule[];
  required?: boolean;
  requiredMessage?: string;
}

export interface ValidationSchema {
  [fieldName: string]: FieldValidation;
}

export interface ValidationErrors {
  [fieldName: string]: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

// ============================================================================
// PREDEFINED VALIDATION RULES
// ============================================================================

export const validationRules = {
  // Email validation
  email: {
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Ogiltig e-postadress',
  },

  // Password validation (minst 8 tecken, 1 stor, 1 liten, 1 siffra, 1 special)
  password: {
    validate: (value: string) =>
      value.length >= 8 &&
      /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value),
    message: 'Lösenordet måste vara minst 8 tecken och innehålla stor bokstav, liten bokstav, siffra och specialtecken',
  },

  // Password minimum length
  passwordMinLength: (minLength: number = 8) => ({
    validate: (value: string) => value.length >= minLength,
    message: `Lösenordet måste vara minst ${minLength} tecken långt`,
  }),

  // Password must match another field (för confirm password)
  passwordMatch: (fieldToMatch: string = 'password') => ({
    validate: (value: string, formData?: Record<string, any>) =>
      !!(formData && value === formData[fieldToMatch]),
    message: 'Lösenorden matchar inte',
  }),

  // Minsta längd
  minLength: (length: number, fieldName: string = 'fältet') => ({
    validate: (value: string) => value.length >= length,
    message: `${fieldName} måste vara minst ${length} tecken`,
  }),

  // Maxlängd
  maxLength: (length: number, fieldName: string = 'fältet') => ({
    validate: (value: string) => value.length <= length,
    message: `${fieldName} får inte vara längre än ${length} tecken`,
  }),

  // Telefonnummer (svensk format)
  phoneSwedish: {
    validate: (value: string) => /^(\+46|0)[1-9]\d{7,9}$/.test(value.replace(/\s/g, '')),
    message: 'Ogiltigt telefonnummer (använd +46 eller 0)',
  },

  // Endast siffror
  numeric: {
    validate: (value: string) => /^\d+$/.test(value),
    message: 'Endast siffror är tillåtna',
  },

  // Endast bokstäver (inklusive å, ä, ö)
  alphabetic: {
    validate: (value: string) => /^[a-zA-ZåäöÅÄÖ\s]+$/.test(value),
    message: 'Endast bokstäver är tillåtna',
  },

  // URL validation
  url: {
    validate: (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Ogiltig URL',
  },
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook för form validation
 * 
 * @param schema - Validation schema definierad för formuläret
 * @param initialData - Initial form data (optional)
 * 
 * @example
 * ```tsx
 * const schema: ValidationSchema = {
 *   email: {
 *     rules: [validationRules.email],
 *     required: true,
 *     requiredMessage: 'E-post krävs',
 *   },
 *   password: {
 *     rules: [validationRules.password],
 *     required: true,
 *   },
 *   confirmPassword: {
 *     rules: [validationRules.passwordMatch('password')],
 *     required: true,
 *   },
 * };
 * 
 * const { errors, validateField, validateForm, clearErrors, hasErrors } = 
 *   useFormValidation(schema);
 * 
 * // Validera ett fält on blur
 * <Input
 *   name="email"
 *   onBlur={(e) => validateField('email', e.target.value, formData)}
 *   error={errors.email}
 * />
 * 
 * // Validera hela formuläret on submit
 * const handleSubmit = (e) => {
 *   e.preventDefault();
 *   const validation = validateForm(formData);
 *   if (!validation.isValid) {
 *     return; // Visa errors
 *   }
 *   // Submit form
 * };
 * ```
 */
export const useFormValidation = (
  schema: ValidationSchema,
  _initialData?: Record<string, any>
) => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * Validera ett enskilt fält
   */
  const validateField = useCallback(
    (fieldName: string, value: any, formData?: Record<string, any>): string | null => {
      const fieldSchema = schema[fieldName];
      if (!fieldSchema) return null;

      // Check required
      if (fieldSchema.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return fieldSchema.requiredMessage || 'Detta fält är obligatoriskt';
      }

      // Skip validation if field is empty and not required
      if (!value && !fieldSchema.required) {
        return null;
      }

      // Run all validation rules
      for (const rule of fieldSchema.rules) {
        if (!rule.validate(value, formData)) {
          return rule.message;
        }
      }

      return null;
    },
    [schema]
  );

  /**
   * Validera hela formuläret
   */
  const validateForm = useCallback(
    (formData: Record<string, any>): FormValidationResult => {
      const newErrors: ValidationErrors = {};
      let isValid = true;

      Object.keys(schema).forEach((fieldName) => {
        const error = validateField(fieldName, formData[fieldName], formData);
        if (error) {
          newErrors[fieldName] = error;
          isValid = false;
        }
      });

      setErrors(newErrors);
      return { isValid, errors: newErrors };
    },
    [schema, validateField]
  );

  /**
   * Sätt error för ett specifikt fält (användbart för server-side validation errors)
   */
  const setFieldError = useCallback((fieldName: string, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  /**
   * Rensa errors för ett specifikt fält
   */
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Rensa alla errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  /**
   * Markera ett fält som "touched" (använd on blur)
   */
  const markFieldAsTouched = useCallback((fieldName: string) => {
    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));
  }, []);

  /**
   * Validera ett fält och uppdatera errors state
   */
  const validateAndSetFieldError = useCallback(
    (fieldName: string, value: any, formData?: Record<string, any>) => {
      const error = validateField(fieldName, value, formData);
      if (error) {
        setFieldError(fieldName, error);
      } else {
        clearFieldError(fieldName);
      }
      markFieldAsTouched(fieldName);
    },
    [validateField, setFieldError, clearFieldError, markFieldAsTouched]
  );

  /**
   * Check om det finns några errors
   */
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  /**
   * Check om ett specifikt fält har error
   */
  const hasFieldError = useCallback(
    (fieldName: string) => !!errors[fieldName],
    [errors]
  );

  /**
   * Check om ett fält är touched
   */
  const isFieldTouched = useCallback(
    (fieldName: string) => touched[fieldName] === true,
    [touched]
  );

  return {
    errors,
    touched,
    hasErrors,
    hasFieldError,
    isFieldTouched,
    validateField,
    validateForm,
    setFieldError,
    clearFieldError,
    clearErrors,
    markFieldAsTouched,
    validateAndSetFieldError,
  };
};

export default useFormValidation;
