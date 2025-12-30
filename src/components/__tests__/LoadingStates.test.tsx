/**
 * LoadingStates Component Tests - Lugn & Trygg Design System
 * Comprehensive test coverage for LoadingStates components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  LoadingSpinner,
  SkeletonLoader,
  LoadingOverlay,
  PulseLoader,
  ProgressiveLoad
} from '../LoadingStates';

// Mock matchMedia for prefers-reduced-motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('LoadingStates Components', () => {
  describe('LoadingSpinner', () => {
    it('renders loading spinner when isLoading is true', () => {
      render(<LoadingSpinner isLoading={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders children when not loading', () => {
      render(
        <LoadingSpinner isLoading={false}>
          <div>Content</div>
        </LoadingSpinner>
      );
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows custom message', () => {
      render(<LoadingSpinner isLoading={true} message="Custom loading..." />);
      expect(screen.getByText('Custom loading...')).toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
      render(<LoadingSpinner isLoading={true} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });

    it('renders different sizes', () => {
      const { rerender } = render(<LoadingSpinner isLoading={true} size="small" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      rerender(<LoadingSpinner isLoading={true} size="large" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('SkeletonLoader', () => {
    it('renders text skeleton by default', () => {
      render(<SkeletonLoader />);
      const skeletons = screen.getAllByRole('progressbar'); // Skeleton uses progressbar role
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders card skeleton', () => {
      render(<SkeletonLoader type="card" />);
      const skeletons = screen.getAllByRole('progressbar');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders list skeleton', () => {
      render(<SkeletonLoader type="list" />);
      const skeletons = screen.getAllByRole('progressbar');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders custom count', () => {
      render(<SkeletonLoader count={5} />);
      const skeletons = screen.getAllByRole('progressbar');
      expect(skeletons).toHaveLength(5);
    });
  });

  describe('LoadingOverlay', () => {
    it('renders overlay when loading', () => {
      render(<LoadingOverlay isLoading={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Laddar...')).toBeInTheDocument();
    });

    it('does not render when not loading', () => {
      render(<LoadingOverlay isLoading={false} />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows custom message', () => {
      render(<LoadingOverlay isLoading={true} message="Saving..." />);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
      render(<LoadingOverlay isLoading={true} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('PulseLoader', () => {
    it('renders pulse loader', () => {
      render(<PulseLoader />);
      const loader = screen.getByRole('status');
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('aria-label', 'Loading');
    });

    it('respects prefers-reduced-motion', () => {
      // Mock prefers-reduced-motion: reduce
      window.matchMedia.mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<PulseLoader />);
      const loader = screen.getByRole('status');
      expect(loader).toHaveClass('no-animation');
    });

    it('accepts custom size', () => {
      render(<PulseLoader size={50} />);
      const loader = screen.getByRole('status');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('ProgressiveLoad', () => {
    it('renders skeleton when loading', () => {
      render(
        <ProgressiveLoad isLoading={true}>
          <div>Content</div>
        </ProgressiveLoad>
      );

      const skeletons = screen.getAllByRole('progressbar');
      expect(skeletons.length).toBeGreaterThan(0);
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    it('renders content when not loading', () => {
      render(
        <ProgressiveLoad isLoading={false}>
          <div>Content</div>
        </ProgressiveLoad>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('accepts custom skeleton count', () => {
      render(
        <ProgressiveLoad isLoading={true} skeletonCount={3}>
          <div>Content</div>
        </ProgressiveLoad>
      );

      const skeletons = screen.getAllByRole('progressbar');
      expect(skeletons).toHaveLength(3);
    });
  });
});
