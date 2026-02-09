/**
 * Card Component Tests - Lugn & Trygg Design System
 * Behavior-based tests for the Tailwind Card component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../tailwind/Card';

describe('Card Component', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Card data-testid="card" className="my-custom-class">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('my-custom-class');
  });

  it('renders with different variants without errors', () => {
    const { rerender } = render(<Card variant="default" data-testid="card">Default</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();

    rerender(<Card variant="bordered" data-testid="card">Bordered</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();

    rerender(<Card variant="elevated" data-testid="card">Elevated</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('renders with different padding values without errors', () => {
    const { rerender } = render(<Card padding="none" data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();

    rerender(<Card padding="sm" data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();

    rerender(<Card padding="md" data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();

    rerender(<Card padding="lg" data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('handles onClick', () => {
    const handleClick = vi.fn();
    render(<Card data-testid="card" onClick={handleClick}>Clickable</Card>);
    fireEvent.click(screen.getByTestId('card'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders complex children', () => {
    render(
      <Card>
        <div>
          <h3>Nested content</h3>
          <p>More content here</p>
        </div>
      </Card>
    );
    expect(screen.getByText('Nested content')).toBeInTheDocument();
    expect(screen.getByText('More content here')).toBeInTheDocument();
  });

  it('passes through HTML div attributes', () => {
    render(<Card data-testid="custom-card" id="my-card">Content</Card>);
    const card = screen.getByTestId('custom-card');
    expect(card).toHaveAttribute('id', 'my-card');
  });
});

describe('Card sub-components', () => {
  it('CardHeader renders children', () => {
    render(<CardHeader data-testid="header">Header content</CardHeader>);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('CardTitle renders children as heading', () => {
    render(<CardTitle>My Title</CardTitle>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Title').tagName).toBe('H3');
  });

  it('CardDescription renders children', () => {
    render(<CardDescription>A description</CardDescription>);
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('CardContent renders children', () => {
    render(<CardContent data-testid="content">Body content</CardContent>);
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('CardFooter renders children', () => {
    render(<CardFooter data-testid="footer">Footer content</CardFooter>);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('composes full card with sub-components', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
