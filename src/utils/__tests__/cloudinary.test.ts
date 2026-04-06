/**
 * Tests for cloudinary utility functions.
 * Covers pure functions and URL transformation helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOptimizedImageUrl,
  getResponsiveImageUrls,
  getImageWithFallbacks,
  getPlaceholderImage,
  isCloudinaryUrl,
  extractPublicId,
  uploadImage,
  preloadImage,
} from '../cloudinary';

describe('getOptimizedImageUrl', () => {
  it('returns a valid Cloudinary URL', () => {
    const url = getOptimizedImageUrl('test/image');
    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(url).toContain('test/image');
  });

  it('includes default format webp and quality 85', () => {
    const url = getOptimizedImageUrl('test/image');
    expect(url).toContain('f_webp');
    expect(url).toContain('q_85');
  });

  it('includes width and height when specified', () => {
    const url = getOptimizedImageUrl('test/image', { width: 800, height: 600 });
    expect(url).toContain('w_800');
    expect(url).toContain('h_600');
  });

  it('omits width/height when not specified', () => {
    const url = getOptimizedImageUrl('test/image');
    expect(url).not.toContain('w_');
    expect(url).not.toContain('h_');
  });

  it('applies custom format', () => {
    const url = getOptimizedImageUrl('test/image', { format: 'avif' });
    expect(url).toContain('f_avif');
  });

  it('applies custom quality', () => {
    const url = getOptimizedImageUrl('test/image', { quality: 60 });
    expect(url).toContain('q_60');
  });

  it('applies gravity when specified', () => {
    const url = getOptimizedImageUrl('test/image', { gravity: 'face' });
    expect(url).toContain('g_face');
  });

  it('applies radius when specified', () => {
    const url = getOptimizedImageUrl('test/image', { radius: 20 });
    expect(url).toContain('r_20');
  });

  it('applies effect when specified', () => {
    const url = getOptimizedImageUrl('test/image', { effect: 'grayscale' });
    expect(url).toContain('e_grayscale');
  });

  it('does not include gravity/radius/effect when not specified', () => {
    const url = getOptimizedImageUrl('test/image');
    expect(url).not.toContain('g_');
    expect(url).not.toContain('r_');
    expect(url).not.toContain('e_');
  });
});

describe('getResponsiveImageUrls', () => {
  it('returns correct number of breakpoint URLs', () => {
    const result = getResponsiveImageUrls('test/image', [320, 640, 1024]);
    expect(result).toHaveLength(3);
  });

  it('each result has url and width', () => {
    const result = getResponsiveImageUrls('test/image', [320, 640]);
    expect(result[0].url).toBeTruthy();
    expect(result[0].width).toBe(320);
    expect(result[1].width).toBe(640);
  });

  it('uses default 6 breakpoints when not specified', () => {
    const result = getResponsiveImageUrls('test/image');
    expect(result).toHaveLength(6);
  });

  it('each URL contains the respective width', () => {
    const result = getResponsiveImageUrls('test/image', [500]);
    expect(result[0].url).toContain('w_500');
  });
});

describe('getImageWithFallbacks', () => {
  it('returns 3 format variants', () => {
    const result = getImageWithFallbacks('test/image');
    expect(result).toHaveLength(3);
  });

  it('returns webp, avif, jpg in that order', () => {
    const result = getImageWithFallbacks('test/image');
    expect(result[0].format).toBe('webp');
    expect(result[1].format).toBe('avif');
    expect(result[2].format).toBe('jpg');
  });

  it('each URL contains the correct format', () => {
    const result = getImageWithFallbacks('test/image');
    expect(result[0].url).toContain('f_webp');
    expect(result[1].url).toContain('f_avif');
    expect(result[2].url).toContain('f_jpg');
  });
});

describe('getPlaceholderImage', () => {
  it('returns placeholder URL with correct dimensions', () => {
    const url = getPlaceholderImage(400, 300);
    expect(url).toContain('400x300');
  });

  it('encodes custom text', () => {
    const url = getPlaceholderImage(400, 300, 'Hello World');
    expect(url).toContain(encodeURIComponent('Hello World'));
  });

  it('uses default text when not specified', () => {
    const url = getPlaceholderImage(400, 300);
    expect(url).toContain('Lugn');
  });
});

describe('isCloudinaryUrl', () => {
  it('returns true for res.cloudinary.com URLs', () => {
    expect(isCloudinaryUrl('https://res.cloudinary.com/dxmijbysc/image/upload/test.jpg')).toBe(true);
  });

  it('returns true for *.cloudinary.com subdomains', () => {
    expect(isCloudinaryUrl('https://custom.cloudinary.com/image/test.jpg')).toBe(true);
  });

  it('returns false for non-Cloudinary URLs', () => {
    expect(isCloudinaryUrl('https://example.com/image.jpg')).toBe(false);
    expect(isCloudinaryUrl('https://cdn.example.com/image.jpg')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isCloudinaryUrl('not-a-url')).toBe(false);
    expect(isCloudinaryUrl('')).toBe(false);
  });
});

describe('extractPublicId', () => {
  it('extracts public ID from Cloudinary URL without version', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    expect(extractPublicId(url)).toBe('sample');
  });

  it('extracts public ID from URL with path segments', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/folder/sub/image.webp';
    expect(extractPublicId(url)).toBe('folder/sub/image');
  });

  it('extracts public ID from URL with version', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg';
    expect(extractPublicId(url)).toBe('sample');
  });

  it('returns null for non-Cloudinary URLs', () => {
    expect(extractPublicId('https://example.com/image.jpg')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(extractPublicId('not-a-url')).toBeNull();
  });
});

describe('uploadImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads successfully and returns JSON response', async () => {
    const mockResponse = { public_id: 'lugn-trygg/test', url: 'https://res.cloudinary.com/dxmijbysc/image/upload/test.jpg' };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const result = await uploadImage(file);
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/v1_1/');
    expect(url).toContain('/image/upload');
    expect((options as RequestInit).method).toBe('POST');
  });

  it('uses custom folder when specified', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await uploadImage(file, 'custom-folder');
    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = (options as RequestInit).body as FormData;
    expect(body.get('folder')).toBe('custom-folder');
  });

  it('uses default folder "lugn-trygg" when not specified', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await uploadImage(file);
    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = (options as RequestInit).body as FormData;
    expect(body.get('folder')).toBe('lugn-trygg');
  });

  it('throws when response is not ok with API error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: { message: 'Invalid upload preset' } }),
    } as Response);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await expect(uploadImage(file)).rejects.toThrow('Invalid upload preset');
  });

  it('falls back to statusText when error JSON has no message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      json: () => Promise.resolve({}),
    } as Response);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await expect(uploadImage(file)).rejects.toThrow('Forbidden');
  });

  it('falls back to statusText when JSON parsing fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
      json: () => Promise.reject(new SyntaxError('bad json')),
    } as Response);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await expect(uploadImage(file)).rejects.toThrow('Server Error');
  });
});

describe('preloadImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with the src when image loads successfully', async () => {
    const src = 'https://res.cloudinary.com/dxmijbysc/image/upload/test.jpg';

    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      set src(_url: string) {
        Promise.resolve().then(() => this.onload?.());
      }
    });

    const result = await preloadImage(src);
    expect(result).toBe(src);
    vi.unstubAllGlobals();
  });

  it('rejects when image fails to load', async () => {
    const src = 'https://res.cloudinary.com/dxmijbysc/image/upload/missing.jpg';

    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      set src(_url: string) {
        Promise.resolve().then(() => this.onerror?.(new Event('error')));
      }
    });

    await expect(preloadImage(src)).rejects.toBeInstanceOf(Event);
    vi.unstubAllGlobals();
  });
});
