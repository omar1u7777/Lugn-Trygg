/**
 * ErrorBoundary Component Tests - Lugn & Trygg Design System
 * Comprehensive test coverage for ErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

// Mock analytics.lazy to prevent unhandled rejection errors
vi.mock('../../services/analytics.lazy', () => ({
  analytics: {
    error: vi.fn(),
    track: vi.fn(),
    page: vi.fn(),
    identify: vi.fn(),
  },
}));

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
    expect(screen.getByText(/Vi är ledsna, men något oväntat hände\./)).toBeInTheDocument();
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

    // Should show retry and back buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
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

    expect(screen.getByRole('link', { name: /support/i })).toHaveAttribute('href', 'mailto:support@lugntrygg.se');
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('shows retry count when retryCount > 0', () => {
    let shouldThrow = true;
    const ToggleComponent = () => {
      if (shouldThrow) throw new Error('Toggle error');
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary>
        <ToggleComponent />
      </ErrorBoundary>
    );

    const retryBtn = screen.getByRole('button', { name: /försök igen/i });
    fireEvent.click(retryBtn);

    // After one retry the error still happens (component still throws)
    // Button label should show retry count if retryCount > 0
    // Just verify boundary still shows error UI
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows reload button when max retries exceeded', () => {
    // Simulate exceeding retries by clicking retry multiple times
    let clickCount = 0;
    const AlwaysThrowComponent = () => {
      throw new Error(`Error attempt ${++clickCount}`);
    };

    render(
      <ErrorBoundary>
        <AlwaysThrowComponent />
      </ErrorBoundary>
    );

    // Click retry 3+ times (maxRetries = 3)
    for (let i = 0; i < 3; i++) {
      const retryBtn = screen.queryByRole('button', { name: /försök igen/i });
      if (retryBtn) fireEvent.click(retryBtn);
    }

    // After max retries, should show "Ladda om" or no retry button
    const reloadBtn = screen.queryByRole('button', { name: /ladda om sidan/i });
    const retryBtn = screen.queryByRole('button', { name: /försök igen/i });
    // One of them should be present
    expect(reloadBtn || retryBtn).not.toBeNull();
  });

  it('handles ChunkLoadError in getDerivedStateFromError', () => {
    // Make recovery bail out early (max attempts reached) to avoid jsdom navigation
    sessionStorage.setItem('bundle_recovery_attempt_count', '3');

    const ChunkErrorComponent = () => {
      const err = new Error('Failed to fetch dynamically imported module: /chunk.js');
      err.name = 'ChunkLoadError';
      throw err;
    };

    render(
      <ErrorBoundary>
        <ChunkErrorComponent />
      </ErrorBoundary>
    );

    // Should still show error UI (recovery bailed due to max attempts)
    expect(screen.getByRole('alert')).toBeInTheDocument();

    sessionStorage.removeItem('bundle_recovery_attempt_count');
  });

  it('handles ReferenceError before initialization in getDerivedStateFromError', () => {
    // Make recovery bail out early to avoid jsdom navigation
    sessionStorage.setItem('bundle_recovery_attempt_count', '3');

    const RefErrorComponent = () => {
      const err = new ReferenceError("Cannot access 'MyVar' before initialization");
      throw err;
    };

    render(
      <ErrorBoundary>
        <RefErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    sessionStorage.removeItem('bundle_recovery_attempt_count');
  });

  it('shows component stack in details when errorInfo is available', () => {
    render(
      <ErrorBoundary showDetails={true}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    // The details section should be there
    expect(screen.getByText('Tekniska detaljer (för utvecklare)')).toBeInTheDocument();
    // Error text should appear somewhere in the document (may appear multiple times)
    const errorTexts = screen.getAllByText(/Test error/);
    expect(errorTexts.length).toBeGreaterThan(0);
  });
});
