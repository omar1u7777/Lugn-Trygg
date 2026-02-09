import React, { useState, useRef, useEffect } from 'react';
import { getOptimizedImageUrl } from '../../utils/cloudinary';

type ConnectionWithSaveData = Navigator['connection'] & { saveData?: boolean };

const BREAKPOINTS = [320, 480, 640, 768, 1024, 1280, 1536];
const FORMATS: ReadonlyArray<'avif' | 'webp'> = ['avif', 'webp'];

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
  const [effectiveQuality, setEffectiveQuality] = useState(quality);
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

  useEffect(() => {
    const connection = (navigator as any)?.connection as ConnectionWithSaveData | undefined;
    if (connection?.saveData) {
      setEffectiveQuality(Math.min(60, quality));
      return;
    }

    if (connection?.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)) {
      setEffectiveQuality(Math.min(70, quality));
    } else {
      setEffectiveQuality(quality);
    }
  }, [quality]);

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

  useEffect(() => {
    if (!imgRef.current) {
      return;
    }

    // React 18 does not yet know the fetchpriority attribute, so set it manually to avoid warnings.
    const priorityValue = priority ? 'high' : 'auto';
    imgRef.current.setAttribute('fetchpriority', priorityValue);
  }, [priority, isInView]);

  // Generate blur placeholder for better UX
  const generateBlurPlaceholder = (_src: string) => {
    // For now, return a simple data URL. In production, you might want to generate actual blur placeholders
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PC9zdmc+';
  };

  const isAbsoluteUrl = /^https?:\/\//i.test(currentSrc);
  const isLocalAsset = currentSrc.startsWith('/') || currentSrc.startsWith('.');
  const isCloudPublicId = !isAbsoluteUrl && !isLocalAsset;

  const shouldOptimize = isCloudPublicId;

  const generateSrcSet = (publicId: string, format: 'webp' | 'avif') =>
    BREAKPOINTS
      .map(bp => `${getOptimizedImageUrl(publicId, { width: bp, quality: effectiveQuality, format })} ${bp}w`)
      .join(', ');

  const optimizedSrc = shouldOptimize
    ? getOptimizedImageUrl(currentSrc, {
        width,
        height,
        quality: effectiveQuality,
      })
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
      <picture>
        {isInView && shouldOptimize && FORMATS.map((format) => (
          <source
            key={format}
            type={`image/${format}`}
            srcSet={generateSrcSet(currentSrc, format)}
            sizes={sizes}
          />
        ))}
        <img
          ref={imgRef}
          src={isInView ? optimizedSrc : undefined}
          srcSet={isInView && shouldOptimize ? generateSrcSet(currentSrc, 'webp') : undefined}
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
      </picture>

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
