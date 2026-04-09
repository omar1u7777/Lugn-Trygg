import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input, Textarea } from '../Input';

describe('Input', () => {
  it('renders basic input', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeTruthy();
  });

  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('shows required asterisk when required and has label', () => {
    const { container } = render(<Input label="Email" required />);
    expect(container.textContent).toContain('*');
  });

  it('does not show required asterisk without label', () => {
    const { container } = render(<Input required />);
    expect(container.textContent).not.toContain('*');
  });

  it('shows error message', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('shows helper text', () => {
    render(<Input helperText="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeTruthy();
  });

  it('applies error styling', () => {
    const { container } = render(<Input error="Bad" />);
    expect(container.innerHTML).toContain('border-error-200');
  });

  it('renders left icon', () => {
    render(<Input leftIcon={<span data-testid="left-icon">L</span>} />);
    expect(screen.getByTestId('left-icon')).toBeTruthy();
  });

  it('renders right icon', () => {
    render(<Input rightIcon={<span data-testid="right-icon">R</span>} />);
    expect(screen.getByTestId('right-icon')).toBeTruthy();
  });

  it('applies left padding class when leftIcon present', () => {
    const { container } = render(<Input leftIcon={<span>L</span>} />);
    expect(container.querySelector('input')!.className).toContain('pl-10');
  });

  it('applies right padding class when rightIcon present', () => {
    const { container } = render(<Input rightIcon={<span>R</span>} />);
    expect(container.querySelector('input')!.className).toContain('pr-10');
  });

  it('marks input disabled', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).disabled).toBe(true);
  });

  it('renders type=password', () => {
    const { container } = render(<Input type="password" />);
    expect(container.querySelector('input')!.type).toBe('password');
  });

  it('merges inputProps (MUI compat)', () => {
    render(<Input inputProps={{ 'data-testid': 'merged-input' }} />);
    expect(screen.getByTestId('merged-input')).toBeTruthy();
  });

  it('aria-invalid is true when error present', () => {
    render(<Input error="bad" />);
    const input = screen.getByRole('alert').previousSibling;
    // aria-invalid on the input element
    const inputEl = document.querySelector('input');
    expect(inputEl?.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows error not helperText when both provided', () => {
    render(<Input error="Error msg" helperText="Helper msg" />);
    expect(screen.getByText('Error msg')).toBeTruthy();
  });

  it('shows helperText in status role', () => {
    render(<Input helperText="Helper" />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('Textarea', () => {
  it('renders basic textarea', () => {
    render(<Textarea placeholder="Write here" />);
    expect(screen.getByPlaceholderText('Write here')).toBeTruthy();
  });

  it('renders with label', () => {
    render(<Textarea label="Comment" />);
    expect(screen.getByText('Comment')).toBeTruthy();
  });

  it('shows required asterisk when required', () => {
    const { container } = render(<Textarea label="Note" required />);
    expect(container.textContent).toContain('*');
  });

  it('shows error message', () => {
    render(<Textarea error="Required" />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('shows helper text', () => {
    render(<Textarea helperText="Max 200 chars" />);
    expect(screen.getByText('Max 200 chars')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('applies error styling', () => {
    const { container } = render(<Textarea error="Bad" />);
    expect(container.innerHTML).toContain('border-error-500');
  });

  it('disables textarea', () => {
    render(<Textarea disabled />);
    const ta = document.querySelector('textarea');
    expect(ta?.disabled).toBe(true);
  });
});
