// Cloudinary utility functions for image optimization and CDN

interface CloudinaryOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'crop' | 'scale' | 'fit';
  gravity?: 'auto' | 'face' | 'center';
  effect?: string;
  radius?: number;
  angle?: number;
}

export const getOptimizedImageUrl = (
  publicId: string,
  options: CloudinaryOptions = {}
) => {
  const {
    width,
    height,
    quality = 85,
    format = 'webp',
    crop = 'fill',
    gravity,
    effect,
    radius,
    angle
  } = options;

  const transformations = [
    `f_${format}`,
    `q_${quality}`,
    crop && `c_${crop}`,
    gravity && `g_${gravity}`,
    effect && `e_${effect}`,
    radius && `r_${radius}`,
    angle && `a_${angle}`,
    width && `w_${width}`,
    height && `h_${height}`,
  ].filter(Boolean);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dxmijbysc';
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations.join(',')}/${publicId}`;
};

export const uploadImage = async (file: File, folder = 'lugn-trygg') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'optimized_images');
  formData.append('folder', folder);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dxmijbysc';

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to upload image: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
};

/**
 * Generate responsive image URLs for different breakpoints
 */
export const getResponsiveImageUrls = (
  publicId: string,
  breakpoints: number[] = [320, 640, 768, 1024, 1280, 1536],
  options: CloudinaryOptions = {}
) => {
  return breakpoints.map(bp => ({
    url: getOptimizedImageUrl(publicId, { ...options, width: bp }),
    width: bp,
  }));
};

/**
 * Generate WebP/AVIF fallbacks with JPG fallback
 */
export const getImageWithFallbacks = (publicId: string, options: CloudinaryOptions = {}) => {
  const formats = ['webp', 'avif', 'jpg'] as const;

  return formats.map(format => ({
    url: getOptimizedImageUrl(publicId, { ...options, format }),
    format,
  }));
};

/**
 * Preload critical images
 */
export const preloadImage = (src: string) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Generate placeholder image URL
 */
export const getPlaceholderImage = (width: number, height: number, text = 'Lugn & Trygg') => {
  const encodedText = encodeURIComponent(text);
  return `https://via.placeholder.com/${width}x${height}.png?text=${encodedText}`;
};

/**
 * Check if image URL is from Cloudinary
 */
export const isCloudinaryUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'res.cloudinary.com' || parsed.hostname.endsWith('.cloudinary.com');
  } catch {
    return false;
  }
};

/**
 * Extract public ID from Cloudinary URL
 */
export const extractPublicId = (url: string): string | null => {
  if (!isCloudinaryUrl(url)) return null;

  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/);
  return match ? match[1] ?? null : null;
};

// Export utility functions