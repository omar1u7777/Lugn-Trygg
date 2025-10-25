import React, { useState, useRef, useEffect } from 'react';
import { getOptimizedImageUrl } from '../../utils/cloudinary';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 85,
  sizes = '100vw',
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
  fallbackSrc,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(priority);

  useEffect(() => {
    if (!priority) {
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry?.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: '50px' }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => observer.disconnect();
    }
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(false);
    } else {
      onError?.();
    }
  };

  // Generate blur placeholder for better UX
  const generateBlurPlaceholder = (src: string) => {
    // For now, return a simple data URL. In production, you might want to generate actual blur placeholders
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PC9zdmc+';
  };

  // Generate responsive image sources
  const generateSrcSet = (baseSrc: string) => {
    const breakpoints = [320, 640, 768, 1024, 1280, 1536];
    return breakpoints
      .map(bp => `${getOptimizedImageUrl(baseSrc, { width: bp, quality, format: 'webp' })} ${bp}w`)
      .join(', ');
  };

  // Check if image is from Cloudinary or local
  const isCloudinaryImage = currentSrc.includes('cloudinary.com') || currentSrc.startsWith('http');
  const optimizedSrc = isCloudinaryImage
    ? getOptimizedImageUrl(currentSrc, { width: width!, height: height!, quality })
    : currentSrc;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <img
          src={blurDataURL || generateBlurPlaceholder(currentSrc)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
          aria-hidden="true"
        />
      )}

      {/* Main Image */}
      <img
        ref={imgRef}
        src={isInView ? optimizedSrc : undefined}
        srcSet={isInView && isCloudinaryImage ? generateSrcSet(currentSrc) : undefined}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${hasError ? 'hidden' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          aspectRatio: width && height ? `${width}/${height}` : undefined,
        }}
      />

      {/* Fallback for unsupported browsers */}
      <noscript>
        <img
          src={optimizedSrc}
          alt={alt}
          width={width}
          height={height}
          className={className}
          loading="lazy"
        />
      </noscript>

      {/* Error state */}
      {hasError && !fallbackSrc && (
        <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="sr-only">Image failed to load</span>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;