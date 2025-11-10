import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  Checkbox,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import { useAccessibility } from '../../hooks/useAccessibility';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'select' | 'checkbox' | 'radio';
  required?: boolean;
  helperText?: string;
  error?: string;
  options?: Array<{ value: string; label: string }>;
  value?: any;
  onChange?: (value: any) => void;
}

interface AccessibleFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => void;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  success?: string;
}

const AccessibleForm: React.FC<AccessibleFormProps> = ({
  fields,
  onSubmit,
  submitLabel = 'Skicka',
  loading = false,
  error,
  success,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { announceToScreenReader, getAriaLabel } = useAccessibility();

  // Initialize form data
  useEffect(() => {
    const initialData: Record<string, any> = {};
    fields.forEach(field => {
      initialData[field.id] = field.value || '';
    });
    setFormData(initialData);
  }, [fields]);

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

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setFieldErrors(prev => ({ ...prev, [fieldId]: '' }));

    // Find field and call onChange if provided
    const field = fields.find(f => f.id === fieldId);
    if (field?.onChange) {
      field.onChange(value);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      const value = formData[field.id];

      // Required field validation
      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.id] = `${field.label} är obligatoriskt`;
        isValid = false;
      }

      // Email validation
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[field.id] = 'Ange en giltig e-postadress';
          isValid = false;
        }
      }

      // Custom field error
      if (field.error) {
        errors[field.id] = field.error;
        isValid = false;
      }
    });

    setFieldErrors(errors);

    if (!isValid) {
      const errorCount = Object.keys(errors).length;
      announceToScreenReader(
        `Formuläret har ${errorCount} fel som måste åtgärdas innan det kan skickas`,
        'assertive'
      );
    }

    return isValid;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (validateForm()) {
      onSubmit(formData);
      announceToScreenReader('Formulär skickas...', 'polite');
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';
    const fieldError = fieldErrors[field.id] || field.error;
    const ariaDescribedBy = field.helperText || fieldError ? `${field.id}-helper` : undefined;

    const commonProps = {
      id: field.id,
      name: field.id,
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        handleFieldChange(field.id, event.target.value),
      error: !!fieldError,
      required: field.required,
      'aria-describedby': ariaDescribedBy,
      'aria-label': getAriaLabel(field.label),
      'aria-invalid': !!fieldError,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
      case 'tel':
        return (
          <TextField
            {...commonProps}
            type={field.type}
            label={field.label}
            helperText={fieldError || field.helperText}
            fullWidth
          />
        );

      case 'select':
        return (
          <FormControl fullWidth error={!!fieldError}>
            <FormLabel id={`${field.id}-label`}>{field.label}</FormLabel>
            <Select
              {...commonProps}
              labelId={`${field.id}-label`}
              onChange={(event) => handleFieldChange(field.id, event.target.value)}
            >
              {field.options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {(fieldError || field.helperText) && (
              <FormHelperText id={`${field.id}-helper`}>
                {fieldError || field.helperText}
              </FormHelperText>
            )}
          </FormControl>
        );

      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!value}
                onChange={(event) => handleFieldChange(field.id, event.target.checked)}
                aria-describedby={ariaDescribedBy}
              />
            }
            label={field.label}
          />
        );

      case 'radio':
        return (
          <FormControl component="fieldset" error={!!fieldError}>
            <FormLabel component="legend">{field.label}</FormLabel>
            <RadioGroup
              value={value}
              onChange={(event) => handleFieldChange(field.id, event.target.value)}
              aria-describedby={ariaDescribedBy}
            >
              {field.options?.map(option => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
            {(fieldError || field.helperText) && (
              <FormHelperText id={`${field.id}-helper`}>
                {fieldError || field.helperText}
              </FormHelperText>
            )}
          </FormControl>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      role="form"
      aria-label="Formulär"
      sx={{ maxWidth: 600, mx: 'auto' }}
    >
      {fields.map(field => (
        <Box key={field.id} sx={{ mb: spacing.lg }}>
          {renderField(field)}
        </Box>
      ))}

      {error && (
        <Box
          role="alert"
          aria-live="assertive"
          sx={{
            mb: spacing.md,
            p: spacing.md,
            bgcolor: 'error.main',
            color: 'error.contrastText',
            borderRadius: 1,
          }}
        >
          {error}
        </Box>
      )}

      {success && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            mb: spacing.md,
            p: spacing.md,
            bgcolor: 'success.main',
            color: 'success.contrastText',
            borderRadius: 1,
          }}
        >
          {success}
        </Box>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        aria-describedby={error ? 'form-error' : success ? 'form-success' : undefined}
      >
        {loading ? 'Skickar...' : submitLabel}
      </Button>
    </Box>
  );
};

export default AccessibleForm;