/**
 * OptimizedImage Component Tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const { getOptimizedImageUrlMock } = vi.hoisted(() => ({
  getOptimizedImageUrlMock: vi.fn((publicId: string, opts?: Record<string, unknown>) =>
    `https://res.cloudinary.com/test/${publicId}?w=${opts?.width || 800}&q=${opts?.quality || 85}`
  ),
}));

vi.mock('../../../utils/cloudinary', () => ({
  getOptimizedImageUrl: getOptimizedImageUrlMock,
}));

// IntersectionObserver mock — must be a class for `new` to work
const observeMock = vi.fn();
const disconnectMock = vi.fn();
class MockIntersectionObserver {
  observe = observeMock;
  disconnect = disconnectMock;
  unobserve = vi.fn();
  constructor(_callback: IntersectionObserverCallback) {}
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

import OptimizedImage from '../OptimizedImage';

describe('OptimizedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.connection
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  it('renders a picture element', () => {
    const { container } = render(<OptimizedImage src="test-image" alt="Test" />);
    expect(container.querySelector('picture')).toBeInTheDocument();
  });

  it('renders with alt text', () => {
    render(<OptimizedImage src="test-image" alt="A nice picture" />);
    expect(screen.getByAltText('A nice picture')).toBeInTheDocument();
  });

  it('uses eager loading and sets isInView when priority=true', () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="Priority" priority={true} />);
    const img = screen.getByAltText('Priority');
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('uses lazy loading when priority=false', () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="Lazy" priority={false} />);
    const img = screen.getByAltText('Lazy');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('sets up IntersectionObserver when not priority', () => {
    render(<OptimizedImage src="cloud-public-id" alt="Observer" priority={false} />);
    expect(observeMock).toHaveBeenCalled();
  });

  it('does not set up IntersectionObserver when priority', () => {
    render(<OptimizedImage src="cloud-public-id" alt="Priority" priority={true} />);
    // IntersectionObserver may be called but observe should not be called (priority=true bypasses it)
    expect(observeMock).not.toHaveBeenCalled();
  });

  it('handles onLoad callback', () => {
    const onLoad = vi.fn();
    render(<OptimizedImage src="https://example.com/img.jpg" alt="Load test" priority={true} onLoad={onLoad} />);
    const img = screen.getByAltText('Load test');
    fireEvent.load(img);
    expect(onLoad).toHaveBeenCalled();
  });

  it('handles onError callback', () => {
    const onError = vi.fn();
    render(<OptimizedImage src="https://example.com/img.jpg" alt="Error test" priority={true} onError={onError} />);
    const img = screen.getByAltText('Error test');
    fireEvent.error(img);
    expect(onError).toHaveBeenCalled();
  });

  it('uses fallbackSrc on error', () => {
    render(
      <OptimizedImage
        src="https://example.com/img.jpg"
        alt="Fallback test"
        priority={true}
        fallbackSrc="https://example.com/fallback.jpg"
      />
    );
    const img = screen.getByAltText('Fallback test');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', 'https://example.com/fallback.jpg');
  });

  it('renders blur placeholder when placeholder=blur and not loaded', () => {
    const { container } = render(
      <OptimizedImage
        src="https://example.com/img.jpg"
        alt="Blur test"
        priority={true}
        placeholder="blur"
      />
    );
    const blurImg = container.querySelector('img[aria-hidden="true"]');
    expect(blurImg).toBeInTheDocument();
  });

  it('does not render blur placeholder when placeholder=empty', () => {
    const { container } = render(
      <OptimizedImage
        src="https://example.com/img.jpg"
        alt="Empty placeholder"
        priority={true}
        placeholder="empty"
      />
    );
    expect(container.querySelector('img[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('applies custom className to wrapper', () => {
    const { container } = render(
      <OptimizedImage src="test" alt="class test" className="my-custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom-class');
  });

  it('optimizes cloudinary public IDs (non-URL, non-relative paths)', () => {
    render(<OptimizedImage src="hero-bild_pfcdsx" alt="Cloud" priority={true} width={800} height={600} />);
    expect(getOptimizedImageUrlMock).toHaveBeenCalledWith('hero-bild_pfcdsx', expect.objectContaining({ width: 800 }));
  });

  it('passes through absolute URLs without cloudinary optimization', () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="Absolute" priority={true} />);
    expect(getOptimizedImageUrlMock).not.toHaveBeenCalled();
  });

  it('reduces quality on slow connections', () => {
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: { effectiveType: '2g', saveData: false },
    });
    render(<OptimizedImage src="cloud-id" alt="Slow" priority={true} quality={85} />);
    // Quality should be capped at 70 for 2g
    expect(getOptimizedImageUrlMock).toHaveBeenCalledWith('cloud-id', expect.objectContaining({ quality: 70 }));
  });

  it('reduces quality with saveData enabled', () => {
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: { saveData: true },
    });
    render(<OptimizedImage src="cloud-id" alt="SaveData" priority={true} quality={85} />);
    expect(getOptimizedImageUrlMock).toHaveBeenCalledWith('cloud-id', expect.objectContaining({ quality: 60 }));
  });
});
