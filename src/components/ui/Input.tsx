/**
 * Input Component - Lugn & Trygg Design System
 * Consistent input styles with accessibility and validation support
 */

import React, { forwardRef } from 'react';
import { TextField, TextFieldProps, FormHelperText, Box } from '@mui/material';

export interface InputProps extends Omit<TextFieldProps, 'error'> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  fullWidth = true,
  required = false,
  startAdornment,
  endAdornment,
  className = '',
  ...props
}, ref) => {
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : undefined;

  return (
    <Box className={`form-group ${className}`}>
      <TextField
        ref={ref}
        label={label}
        error={hasError}
        required={required}
        fullWidth={fullWidth}
        variant="outlined"
        className="form-input"
        InputProps={{
          startAdornment,
          endAdornment,
        }}
        {...props}
      />
      {(errorMessage || helperText) && (
        <FormHelperText
          error={hasError}
          className={hasError ? 'form-error' : 'text-gray-600'}
        >
          {errorMessage || helperText}
        </FormHelperText>
      )}
    </Box>
  );
});

Input.displayName = 'Input';

export default Input;