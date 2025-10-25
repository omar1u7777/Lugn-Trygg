/**
 * Input Component Tests - Lugn & Trygg Design System
 * Comprehensive test coverage for Input component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../Input';

describe('Input Component', () => {
  it('renders with basic props', () => {
    render(<Input label="Test Label" />);
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('shows error state', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text', () => {
    render(<Input helperText="Helpful information" />);
    expect(screen.getByText('Helpful information')).toBeInTheDocument();
  });

  it('handles required attribute', () => {
    render(<Input label="Required Field" required />);
    const input = screen.getByRole('textbox');
    expect(input).toBeRequired();
  });

  it('handles fullWidth prop', () => {
    render(<Input fullWidth />);
    expect(screen.getByRole('textbox')).toHaveClass('w-full');
  });

  it('renders with start and end adornments', () => {
    render(
      <Input
        startAdornment={<span>@</span>}
        endAdornment={<span>.com</span>}
      />
    );

    expect(screen.getByText('@')).toBeInTheDocument();
    expect(screen.getByText('.com')).toBeInTheDocument();
  });

  it('handles different input types', () => {
    const { rerender } = render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" />);
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole('textbox').closest('.form-group')).toHaveClass('custom-input');
  });

  it('handles disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('passes through other props to TextField', () => {
    render(<Input data-testid="custom-input" maxLength={10} />);
    const input = screen.getByTestId('custom-input');
    expect(input).toHaveAttribute('maxLength', '10');
  });

  it('handles complex validation states', () => {
    const { rerender } = render(<Input error="Error message" helperText="Helper text" />);
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();

    rerender(<Input helperText="Helper text" />);
    expect(screen.getByText('Helper text')).toBeInTheDocument();
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });
});