/**
 * Card Component Tests - Lugn & Trygg Design System
 * Comprehensive test coverage for Card component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from '../Card';

describe('Card Component', () => {
  it('renders with default props', () => {
    render(<Card>Card content</Card>);
    const card = screen.getByText('Card content');
    expect(card).toBeInTheDocument();
    expect(card.closest('.card')).toHaveClass('shadow-sm');
  });

  it('renders with title and subtitle', () => {
    render(
      <Card title="Test Title" subtitle="Test Subtitle">
        Content
      </Card>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders with different elevation levels', () => {
    const { rerender } = render(<Card elevation="none">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('shadow-none');

    rerender(<Card elevation="low">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('shadow-sm');

    rerender(<Card elevation="medium">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('shadow-md');

    rerender(<Card elevation="high">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('shadow-lg');
  });

  it('renders with different padding levels', () => {
    const { rerender } = render(<Card padding="none">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('p-0');

    rerender(<Card padding="small">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('p-3');

    rerender(<Card padding="medium">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('p-4');

    rerender(<Card padding="large">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('p-6');
  });

  it('handles hover effect', () => {
    render(<Card hover>Hoverable card</Card>);
    const card = screen.getByText('Hoverable card').closest('.card');
    expect(card).toHaveClass('hover:shadow-md', 'transition-shadow', 'duration-200');
  });

  it('applies custom className', () => {
    render(<Card className="custom-card">Content</Card>);
    expect(screen.getByText('Content').closest('.card')).toHaveClass('custom-card');
  });

  it('renders complex children', () => {
    render(
      <Card title="Complex Card">
        <div>
          <h3>Nested content</h3>
          <p>More content here</p>
        </div>
      </Card>
    );

    expect(screen.getByText('Complex Card')).toBeInTheDocument();
    expect(screen.getByText('Nested content')).toBeInTheDocument();
    expect(screen.getByText('More content here')).toBeInTheDocument();
  });

  it('passes through other props to MUI Card', () => {
    render(<Card data-testid="custom-card">Content</Card>);
    expect(screen.getByTestId('custom-card')).toBeInTheDocument();
  });
});
