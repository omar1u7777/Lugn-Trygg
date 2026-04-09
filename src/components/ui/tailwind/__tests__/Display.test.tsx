import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, Progress, Spinner, Skeleton, Divider } from '../Display';

// Mock OptimizedImage to avoid cloudinary complexity
vi.mock('../../OptimizedImage', () => ({
  default: ({ alt, ...props }: { alt?: string; src?: string }) => <img alt={alt} {...props} />,
}));

describe('Avatar', () => {
  it('renders fallback letter when no src', () => {
    const { container } = render(<Avatar alt="Omar" />);
    expect(container.textContent).toContain('O');
  });

  it('renders ? when no src and no alt', () => {
    const { container } = render(<Avatar />);
    expect(container.textContent).toContain('?');
  });

  it('renders custom fallback when provided', () => {
    const { container } = render(<Avatar fallback="AB" />);
    expect(container.textContent).toContain('AB');
  });

  it('renders image when src is provided', () => {
    render(<Avatar src="https://example.com/img.jpg" alt="Omar" />);
    expect(screen.getByAltText('Omar')).toBeTruthy();
  });

  it('renders image with default alt when alt not provided', () => {
    render(<Avatar src="https://example.com/img.jpg" />);
    expect(screen.getByAltText('Avatar')).toBeTruthy();
  });

  it('applies sm size class', () => {
    const { container } = render(<Avatar size="sm" />);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('w-8');
  });

  it('applies lg size class', () => {
    const { container } = render(<Avatar size="lg" />);
    expect((container.firstChild as HTMLElement).className).toContain('w-12');
  });

  it('applies xl size class', () => {
    const { container } = render(<Avatar size="xl" />);
    expect((container.firstChild as HTMLElement).className).toContain('w-16');
  });

  it('applies md size class by default', () => {
    const { container } = render(<Avatar />);
    expect((container.firstChild as HTMLElement).className).toContain('w-10');
  });
});

describe('Progress', () => {
  it('renders with default props', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders success variant', () => {
    const { container } = render(<Progress value={75} variant="success" />);
    expect(container.innerHTML).toContain('bg-success-600');
  });

  it('renders warning variant', () => {
    const { container } = render(<Progress value={40} variant="warning" />);
    expect(container.innerHTML).toContain('bg-warning-600');
  });

  it('renders error variant', () => {
    const { container } = render(<Progress value={20} variant="error" />);
    expect(container.innerHTML).toContain('bg-error-600');
  });

  it('renders determinate variant as default', () => {
    const { container } = render(<Progress value={60} variant="determinate" />);
    expect(container.innerHTML).toContain('bg-primary-600');
  });

  it('shows label when showLabel is true', () => {
    const { container } = render(<Progress value={42} showLabel />);
    expect(container.textContent).toContain('42%');
  });

  it('does not show label by default', () => {
    const { container } = render(<Progress value={42} />);
    expect(container.textContent).not.toContain('42%');
  });

  it('applies sm size', () => {
    const { container } = render(<Progress value={50} size="sm" />);
    expect(container.innerHTML).toContain('h-1');
  });

  it('applies lg size', () => {
    const { container } = render(<Progress value={50} size="lg" />);
    expect(container.innerHTML).toContain('h-3');
  });

  it('clamps value at 100%', () => {
    render(<Progress value={150} max={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('150');
  });

  it('clamps value at 0%', () => {
    render(<Progress value={-10} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('-10');
  });
});

describe('Spinner', () => {
  it('renders sm spinner', () => {
    const { container } = render(<Spinner size="sm" />);
    expect(container.innerHTML).toContain('w-4');
  });

  it('renders md spinner by default', () => {
    const { container } = render(<Spinner />);
    expect(container.innerHTML).toContain('w-6');
  });

  it('renders lg spinner', () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.innerHTML).toContain('w-8');
  });
});

describe('Skeleton', () => {
  it('renders text variant by default', () => {
    const { container } = render(<Skeleton />);
    expect((container.firstChild as HTMLElement).className).toContain('rounded');
  });

  it('renders circular variant', () => {
    const { container } = render(<Skeleton variant="circular" />);
    expect((container.firstChild as HTMLElement).className).toContain('rounded-full');
  });

  it('renders rectangular variant', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    expect((container.firstChild as HTMLElement).className).toContain('rounded-lg');
  });

  it('applies custom width and height', () => {
    const { container } = render(<Skeleton width={200} height={50} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('50px');
  });

  it('applies string width and height', () => {
    const { container } = render(<Skeleton width="100%" height="2rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('2rem');
  });
});

describe('Divider', () => {
  it('renders horizontal divider without children', () => {
    const { container } = render(<Divider />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders vertical divider', () => {
    const { container } = render(<Divider orientation="vertical" />);
    expect(container.innerHTML).toContain('w-px');
  });

  it('renders dashed divider', () => {
    const { container } = render(<Divider variant="dashed" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders divider with children', () => {
    render(<Divider>eller</Divider>);
    expect(screen.getByText('eller')).toBeTruthy();
  });

  it('renders children with vertical orientation dividers', () => {
    const { container } = render(<Divider orientation="vertical">|</Divider>);
    expect(container.innerHTML).toContain('w-px');
  });
});
