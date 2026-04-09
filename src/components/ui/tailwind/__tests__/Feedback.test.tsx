import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert, Badge, Chip } from '../Feedback';

describe('Alert', () => {
  it('renders info variant by default', () => {
    const { container } = render(<Alert>Info message</Alert>);
    expect(container.innerHTML).toContain('bg-primary-50');
    expect(screen.getByText('Info message')).toBeTruthy();
  });

  it('renders success variant', () => {
    const { container } = render(<Alert variant="success">Success</Alert>);
    expect(container.innerHTML).toContain('bg-success-50');
  });

  it('renders error variant', () => {
    const { container } = render(<Alert variant="error">Error</Alert>);
    expect(container.innerHTML).toContain('bg-error-50');
  });

  it('renders warning variant', () => {
    const { container } = render(<Alert variant="warning">Warning</Alert>);
    expect(container.innerHTML).toContain('bg-warning-50');
  });

  it('uses severity as alias for variant (MUI compat)', () => {
    const { container } = render(<Alert severity="success">Via severity</Alert>);
    expect(container.innerHTML).toContain('bg-success-50');
  });

  it('variant takes precedence over severity', () => {
    const { container } = render(<Alert variant="error" severity="success">Test</Alert>);
    expect(container.innerHTML).toContain('bg-error-50');
  });

  it('renders close button when onClose provided', () => {
    const onClose = vi.fn();
    render(<Alert onClose={onClose}>Closeable</Alert>);
    const closeBtn = screen.getByRole('button');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render close button without onClose', () => {
    render(<Alert>No close</Alert>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders custom icon when provided', () => {
    const icon = <span data-testid="custom-icon">★</span>;
    render(<Alert icon={icon}>With icon</Alert>);
    expect(screen.getByTestId('custom-icon')).toBeTruthy();
  });
});

describe('Badge', () => {
  it('renders with default variant and size', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('renders primary variant', () => {
    const { container } = render(<Badge variant="primary">Primary</Badge>);
    expect(container.innerHTML).toContain('bg-primary-100');
  });

  it('renders success variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.innerHTML).toContain('bg-success-100');
  });

  it('renders warning variant', () => {
    const { container } = render(<Badge variant="warning">Warn</Badge>);
    expect(container.innerHTML).toContain('bg-warning-100');
  });

  it('renders error variant', () => {
    const { container } = render(<Badge variant="error">Err</Badge>);
    expect(container.innerHTML).toContain('bg-error-100');
  });

  it('renders secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Sec</Badge>);
    expect(container.innerHTML).toContain('bg-secondary-100');
  });

  it('renders sm size', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    expect(container.innerHTML).toContain('text-xs');
  });

  it('renders lg size', () => {
    const { container } = render(<Badge size="lg">Large</Badge>);
    expect(container.innerHTML).toContain('text-base');
  });
});

describe('Chip', () => {
  it('renders children by default', () => {
    render(<Chip>chip text</Chip>);
    expect(screen.getByText('chip text')).toBeTruthy();
  });

  it('renders label prop (MUI compat)', () => {
    render(<Chip label="My label" />);
    expect(screen.getByText('My label')).toBeTruthy();
  });

  it('renders primary variant', () => {
    const { container } = render(<Chip variant="primary">P</Chip>);
    expect(container.innerHTML).toContain('bg-primary-100');
  });

  it('renders success variant', () => {
    const { container } = render(<Chip variant="success">S</Chip>);
    expect(container.innerHTML).toContain('bg-success-100');
  });

  it('renders warning variant', () => {
    const { container } = render(<Chip variant="warning">W</Chip>);
    expect(container.innerHTML).toContain('bg-warning-100');
  });

  it('renders error variant', () => {
    const { container } = render(<Chip variant="error">E</Chip>);
    expect(container.innerHTML).toContain('bg-error-100');
  });

  it('renders outline variant', () => {
    const { container } = render(<Chip variant="outline">O</Chip>);
    expect(container.innerHTML).toContain('border-2');
  });

  it('renders sm size', () => {
    const { container } = render(<Chip size="sm">sm</Chip>);
    expect(container.innerHTML).toContain('text-xs');
  });

  it('renders lg size', () => {
    const { container } = render(<Chip size="lg">lg</Chip>);
    expect(container.innerHTML).toContain('text-base');
  });

  it('renders custom icon', () => {
    const icon = <span data-testid="chip-icon">★</span>;
    render(<Chip icon={icon}>ic</Chip>);
    expect(screen.getByTestId('chip-icon')).toBeTruthy();
  });

  it('renders delete button and calls onDelete', () => {
    const onDelete = vi.fn();
    render(<Chip onDelete={onDelete}>del</Chip>);
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('does not render delete button without onDelete', () => {
    render(<Chip>no del</Chip>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('delete icon uses sm class for sm chip', () => {
    const { container } = render(<Chip size="sm" onDelete={vi.fn()}>sm</Chip>);
    expect(container.innerHTML).toContain('w-3');
  });

  it('delete icon uses lg class for lg chip', () => {
    const { container } = render(<Chip size="lg" onDelete={vi.fn()}>lg</Chip>);
    expect(container.innerHTML).toContain('w-5');
  });
});
