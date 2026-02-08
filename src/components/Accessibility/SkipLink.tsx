/**
 * Skip Navigation Link
 *
 * WCAG 2.1 compliant skip link for keyboard users.
 * Allows users to skip directly to main content.
 *
 * @param targetId - The ID of the target element to focus on (default: 'main-content')
 * @param children - The text content of the skip link (default: 'Hoppa till huvudinnehållet')
 */

import React from 'react';import { logger } from '../../utils/logger';


// Constants for better maintainability
const DEFAULT_TARGET_ID = 'main-content';
const DEFAULT_SKIP_TEXT = 'Hoppa till huvudinnehållet';
const SKIP_LINK_CLASSES = `
  sr-only focus:not-sr-only
  fixed top-4 left-4 z-[9999]
  px-4 py-2
  bg-teal-600 text-white
  rounded-lg shadow-lg
  font-medium
  focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
  transition-transform transform -translate-y-16 focus:translate-y-0
`.trim();

interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  targetId = DEFAULT_TARGET_ID,
  children = DEFAULT_SKIP_TEXT
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target && target instanceof HTMLElement) {
      // Ensure the target is focusable
      if (target.tabIndex === -1) {
        target.tabIndex = 0;
      }
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    } else {
      logger.warn(`SkipLink: Target element with ID "${targetId}" not found or not an HTMLElement.`);
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={SKIP_LINK_CLASSES}
    >
      {children}
    </a>
  );
};

/**
 * Focus Trap Hook
 *
 * Traps focus within a container (useful for modals).
 * Ensures keyboard navigation stays within the specified container.
 *
 * @param containerRef - Ref to the container element
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Memoized selectors for performance
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors);
    if (focusableElements.length === 0) {
      logger.warn('useFocusTrap: No focusable elements found in the container.');
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    // Focus the first element when the trap is activated
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef]);
}

/**
 * Announce to Screen Reader
 *
 * Provides a hook to announce messages to screen readers using a persistent live region.
 * This improves performance by reusing the same element instead of creating/removing DOM nodes.
 *
 * @returns A function to announce messages
 */
export function useAnnounce() {
  // Persistent live region for better performance
  const liveRegionRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!liveRegionRef.current) {
      const region = document.createElement('div');
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      document.body.appendChild(region);
      liveRegionRef.current = region;
    }

    return () => {
      if (liveRegionRef.current) {
        document.body.removeChild(liveRegionRef.current);
        liveRegionRef.current = null;
      }
    };
  }, []);

  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const region = liveRegionRef.current;
    if (!region) {
      logger.warn('useAnnounce: Live region not available.');
      return;
    }

    region.setAttribute('aria-live', priority);
    region.textContent = message;

    // Clear the message after announcement
    setTimeout(() => {
      if (region.textContent === message) {
        region.textContent = '';
      }
    }, 1000);
  }, []);

  return announce;
}

export default SkipLink;
