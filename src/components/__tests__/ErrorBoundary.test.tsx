/**
 * ErrorBoundary Component Tests - Lugn & Trygg Design System
 * Comprehensive test coverage for ErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock console.error to avoid test output pollution
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Component that throws an error
const ErrorComponent = () => {
  throw new Error('Test error');
};

// Component that doesn't throw
const SafeComponent = () => <div>Safe content</div>;

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('🚨 Något gick fel')).toBeInTheDocument();
    expect(screen.getByText('Vi är ledsna, men något oväntat hände.')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('shows retry button and handles retry', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: /försök igen/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry - should not crash
    fireEvent.click(retryButton);
  });

  it('shows reload button after max retries', () => {
    // Mock the component to fail multiple times
    let errorCount = 0;
    const FailingComponent = () => {
      errorCount++;
      if (errorCount <= 4) { // Max retries is 3, so this will exceed it
        throw new Error('Persistent error');
      }
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary>
        <FailingComponent />
      </ErrorBoundary>
    );

    // Should eventually show reload button
    expect(screen.getByRole('button', { name: /ladda om sidan/i })).toBeInTheDocument();
  });

  it('shows back button', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /gå tillbaka/i })).toBeInTheDocument();
  });

  it('shows technical details in development', () => {
    // Mock import.meta.env.MODE to be 'development'
    const originalMode = import.meta.env.MODE;
    import.meta.env.MODE = 'development';

    render(
      <ErrorBoundary showDetails={true}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Tekniska detaljer (för utvecklare)')).toBeInTheDocument();

    // Restore original mode
    import.meta.env.MODE = originalMode;
  });

  it('calls onError callback when provided', () => {
    const mockOnError = vi.fn();

    render(
      <ErrorBoundary onError={mockOnError}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('has proper accessibility attributes', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });

  it('shows support contact information', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('support@lugntrygg.se')).toBeInTheDocument();
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });
});
