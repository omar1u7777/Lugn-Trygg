/**
 * Input Component Tests - Lugn & Trygg Design System
 * Behavior-based tests for the Tailwind Input component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../tailwind/Input';

describe('Input Component', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('shows error message with role="alert"', () => {
    render(<Input error="This field is required" />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('This field is required');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text with role="status"', () => {
    render(<Input helperText="Helpful information" />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('Helpful information');
  });

  it('shows error instead of helperText when both provided', () => {
    render(<Input error="Error message" helperText="Helper text" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Error message');
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });

  it('shows helperText when error is absent', () => {
    render(<Input helperText="Helper text" />);
    expect(screen.getByRole('status')).toHaveTextContent('Helper text');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows required asterisk in label', () => {
    render(<Input label="Name" required />);
    const input = screen.getByRole('textbox');
    expect(input).toBeRequired();
    // The asterisk is rendered with aria-label
    expect(screen.getByLabelText('obligatoriskt fält')).toBeInTheDocument();
  });

  it('renders leftIcon', () => {
    render(<Input leftIcon={<span data-testid="left-icon">🔍</span>} />);
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders rightIcon', () => {
    render(<Input rightIcon={<span data-testid="right-icon">✓</span>} />);
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('applies custom className to the input element', () => {
    render(<Input className="my-custom-input" />);
    expect(screen.getByRole('textbox')).toHaveClass('my-custom-input');
  });

  it('handles change events', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('sets aria-required when required', () => {
    render(<Input required />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('passes through HTML input attributes', () => {
    render(<Input data-testid="custom-input" maxLength={10} />);
    const input = screen.getByTestId('custom-input');
    expect(input).toHaveAttribute('maxLength', '10');
  });
});
