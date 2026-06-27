import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { PasswordInput } from '../PasswordInput';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.showPassword': 'Visa lösenord',
        'common.hidePassword': 'Dölj lösenord',
      };
      return translations[key] || key;
    },
  }),
}));

describe('PasswordInput', () => {
  it('should render password input with type="password" by default', () => {
    render(<PasswordInput id="test" dataTestId="test" value="password" onChange={() => {}} />);
    const input = screen.getByTestId('test') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('should toggle password visibility when button is clicked', () => {
    render(<PasswordInput id="test" dataTestId="test" value="password" onChange={() => {}} />);
    const input = screen.getByTestId('test') as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: /visa|show/i });
    
    expect(input.type).toBe('password');
    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    fireEvent.click(toggle);
    expect(input.type).toBe('password');
  });

  it('should display error message when error prop is provided', () => {
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('should display help text when helpText prop is provided', () => {
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={() => {}} helpText="Minst 8 tecken" />);
    expect(screen.getByText('Minst 8 tecken')).toBeInTheDocument();
  });

  it('should have correct ARIA attributes when error is present', () => {
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={() => {}} error="Required" />);
    const input = screen.getByTestId('test');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-error');
  });

  it('should have correct ARIA attributes when no error', () => {
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={() => {}} />);
    const input = screen.getByTestId('test');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={() => {}} disabled />);
    const input = screen.getByTestId('test') as HTMLInputElement;
    const toggle = screen.getByRole('button');
    expect(input.disabled).toBe(true);
    expect(toggle).toBeDisabled();
  });

  it('should call onChange when input value changes', () => {
    const handleChange = vi.fn();
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={handleChange} />);
    const input = screen.getByTestId('test');
    fireEvent.change(input, { target: { value: 'newpassword' } });
    expect(handleChange).toHaveBeenCalledWith('newpassword');
  });

  it('should apply custom className', () => {
    render(<PasswordInput id="test" dataTestId="test" value="" onChange={() => {}} className="custom-class" />);
    const input = screen.getByTestId('test');
    expect(input).toHaveClass('custom-class');
  });

  it('should have correct aria-pressed state on toggle button', () => {
    render(<PasswordInput id="test" dataTestId="test" value="password" onChange={() => {}} />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
