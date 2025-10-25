/**
 * Comprehensive Accessibility Hook for Lugn & Trygg
 * WCAG 2.1 AA compliance utilities and screen reader support
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface AccessibilityState {
  screenReaderActive: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  focusVisible: boolean;
  colorScheme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  keyboardNavigation: boolean;
}

interface AccessibilityActions {
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  setFocus: (element: HTMLElement | null) => void;
  trapFocus: (container: HTMLElement, initialFocus?: HTMLElement) => () => void;
  skipToContent: (targetId: string) => void;
  updateLiveRegion: (message: string, priority?: 'polite' | 'assertive') => void;
  handleKeyboardNavigation: (event: KeyboardEvent) => boolean;
}

export const useAccessibility = (): AccessibilityState & AccessibilityActions => {
  const [state, setState] = useState<AccessibilityState>({
    screenReaderActive: false,
    highContrast: false,
    reducedMotion: false,
    focusVisible: true,
    colorScheme: 'auto',
    fontSize: 'medium',
    keyboardNavigation: true,
  });

  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const assertiveLiveRegionRef = useRef<HTMLDivElement | null>(null);

  // Initialize accessibility features
  useEffect(() => {
    detectAccessibilityFeatures();
    setupLiveRegions();
    setupKeyboardNavigation();
    setupFocusManagement();

    // Listen for preference changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handlePreferenceChange = () => {
      detectAccessibilityFeatures();
    };

    mediaQuery.addEventListener('change', handlePreferenceChange);
    contrastQuery.addEventListener('change', handlePreferenceChange);
    colorSchemeQuery.addEventListener('change', handlePreferenceChange);

    return () => {
      mediaQuery.removeEventListener('change', handlePreferenceChange);
      contrastQuery.removeEventListener('change', handlePreferenceChange);
      colorSchemeQuery.removeEventListener('change', handlePreferenceChange);
    };
  }, []);

  const detectAccessibilityFeatures = useCallback(() => {
    const screenReaderActive = isScreenReaderActive();
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    setState(prev => ({
      ...prev,
      screenReaderActive,
      highContrast,
      reducedMotion,
      colorScheme,
    }));
  }, []);

  const setupLiveRegions = useCallback(() => {
    // Create live regions for screen reader announcements
    if (!liveRegionRef.current) {
      const politeRegion = document.createElement('div');
      politeRegion.setAttribute('aria-live', 'polite');
      politeRegion.setAttribute('aria-atomic', 'true');
      politeRegion.style.position = 'absolute';
      politeRegion.style.left = '-10000px';
      politeRegion.style.width = '1px';
      politeRegion.style.height = '1px';
      politeRegion.style.overflow = 'hidden';
      document.body.appendChild(politeRegion);
      liveRegionRef.current = politeRegion;
    }

    if (!assertiveLiveRegionRef.current) {
      const assertiveRegion = document.createElement('div');
      assertiveRegion.setAttribute('aria-live', 'assertive');
      assertiveRegion.setAttribute('aria-atomic', 'true');
      assertiveRegion.style.position = 'absolute';
      assertiveRegion.style.left = '-10000px';
      assertiveRegion.style.width = '1px';
      assertiveRegion.style.height = '1px';
      assertiveRegion.style.overflow = 'hidden';
      document.body.appendChild(assertiveRegion);
      assertiveLiveRegionRef.current = assertiveRegion;
    }
  }, []);

  const setupKeyboardNavigation = useCallback(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip link activation (Alt + number keys)
      if (event.altKey && event.key >= '1' && event.key <= '9') {
        const skipLinks = document.querySelectorAll('[data-skip-link]');
        const index = parseInt(event.key) - 1;
        if (skipLinks[index]) {
          event.preventDefault();
          (skipLinks[index] as HTMLElement).focus();
        }
      }

      // Enhanced tab navigation
      if (event.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        // Remove keyboard navigation class after a short delay
        setTimeout(() => {
          document.body.classList.remove('keyboard-navigation');
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const setupFocusManagement = useCallback(() => {
    // Focus visible polyfill for browsers that don't support :focus-visible
    if (!CSS.supports('selector(:focus-visible)')) {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          document.body.classList.add('focus-visible');
        }
      });

      document.addEventListener('mousedown', () => {
        document.body.classList.remove('focus-visible');
      });
    }
  }, []);

  // Screen reader detection
  const isScreenReaderActive = (): boolean => {
    // Check for common screen reader indicators
    const hasAriaLive = document.querySelector('[aria-live]') !== null;
    const hasScreenReaderClass = document.body.classList.contains('screen-reader-active');

    // Check for NVDA, JAWS, VoiceOver, etc.
    const userAgent = navigator.userAgent.toLowerCase();
    const screenReaderIndicators = [
      'nvda',
      'jaws',
      'voiceover',
      'talkback',
      'narrator',
      'orca'
    ];

    const hasScreenReaderUA = screenReaderIndicators.some(indicator =>
      userAgent.includes(indicator)
    );

    return hasAriaLive || hasScreenReaderClass || hasScreenReaderUA;
  };

  // Announce to screen reader
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const targetRegion = priority === 'assertive' ? assertiveLiveRegionRef.current : liveRegionRef.current;

    if (targetRegion) {
      // Clear previous content and add new message
      targetRegion.textContent = '';
      // Use setTimeout to ensure screen readers pick up the change
      setTimeout(() => {
        if (targetRegion) {
          targetRegion.textContent = message;
        }
      }, 100);
    }
  }, []);

  // Set focus to element
  const setFocus = useCallback((element: HTMLElement | null) => {
    if (element && typeof element.focus === 'function') {
      // Use setTimeout to ensure element is ready
      setTimeout(() => {
        element.focus();
        // Scroll into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, []);

  // Focus trap for modals
  const trapFocus = useCallback((container: HTMLElement, initialFocus?: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Set initial focus
    setFocus(initialFocus || firstElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }

      // Escape key handling
      if (event.key === 'Escape') {
        // Find and click the close button or trigger close event
        const closeButton = container.querySelector('[data-close-modal]') as HTMLElement;
        if (closeButton) {
          closeButton.click();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [setFocus]);

  // Skip to content
  const skipToContent = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      setFocus(target);
      announceToScreenReader(`Hoppat till ${target.getAttribute('aria-label') || target.textContent || 'innehåll'}`);
    }
  }, [setFocus, announceToScreenReader]);

  // Update live region
  const updateLiveRegion = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, [announceToScreenReader]);

  // Enhanced keyboard navigation handler
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent): boolean => {
    // Handle arrow key navigation for custom components
    const target = event.target as HTMLElement;
    const container = target.closest('[data-keyboard-nav]') as HTMLElement;

    if (container) {
      const focusableElements = Array.from(container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )) as HTMLElement[];

      const currentIndex = focusableElements.indexOf(target);

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          const nextIndex = (currentIndex + 1) % focusableElements.length;
          setFocus(focusableElements[nextIndex]);
          return true;

        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          const prevIndex = currentIndex - 1 < 0 ? focusableElements.length - 1 : currentIndex - 1;
          setFocus(focusableElements[prevIndex]);
          return true;

        case 'Home':
          event.preventDefault();
          setFocus(focusableElements[0]);
          return true;

        case 'End':
          event.preventDefault();
          setFocus(focusableElements[focusableElements.length - 1]);
          return true;
      }
    }

    return false;
  }, [setFocus]);

  return {
    ...state,
    announceToScreenReader,
    setFocus,
    trapFocus,
    skipToContent,
    updateLiveRegion,
    handleKeyboardNavigation,
  };
};

// Accessibility audit utilities
export const accessibilityAudit = {
  // Check for missing alt text
  checkAltText: () => {
    const images = document.querySelectorAll('img');
    const missingAlt: HTMLElement[] = [];

    images.forEach(img => {
      if (!img.getAttribute('alt') && !img.getAttribute('aria-label')) {
        missingAlt.push(img);
      }
    });

    return {
      total: images.length,
      missing: missingAlt.length,
      elements: missingAlt,
    };
  },

  // Check for missing labels
  checkLabels: () => {
    const inputs = document.querySelectorAll('input, select, textarea');
    const missingLabels: HTMLElement[] = [];

    inputs.forEach(input => {
      const hasLabel = document.querySelector(`label[for="${input.id}"]`) ||
                      input.getAttribute('aria-label') ||
                      input.getAttribute('aria-labelledby');

      if (!hasLabel && input.type !== 'hidden') {
        missingLabels.push(input);
      }
    });

    return {
      total: inputs.length,
      missing: missingLabels.length,
      elements: missingLabels,
    };
  },

  // Check color contrast
  checkColorContrast: () => {
    // This would require a more complex implementation
    // For now, return a placeholder
    return {
      checked: false,
      message: 'Color contrast checking requires additional libraries',
    };
  },

  // Check heading hierarchy
  checkHeadingHierarchy: () => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const hierarchy: { level: number; text: string; element: HTMLElement }[] = [];

    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      hierarchy.push({
        level,
        text: heading.textContent || '',
        element: heading as HTMLElement,
      });
    });

    // Check for hierarchy issues
    let previousLevel = 0;
    const issues: string[] = [];

    hierarchy.forEach((heading, index) => {
      if (index === 0 && heading.level !== 1) {
        issues.push('First heading should be H1');
      }

      if (heading.level - previousLevel > 1) {
        issues.push(`Heading level skipped: H${previousLevel} to H${heading.level}`);
      }

      previousLevel = heading.level;
    });

    return {
      total: headings.length,
      hierarchy,
      issues,
      valid: issues.length === 0,
    };
  },

  // Check for focusable elements
  checkFocusableElements: () => {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    return {
      count: focusableElements.length,
      elements: Array.from(focusableElements) as HTMLElement[],
    };
  },

  // Generate accessibility report
  generateReport: () => {
    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      altText: accessibilityAudit.checkAltText(),
      labels: accessibilityAudit.checkLabels(),
      headings: accessibilityAudit.checkHeadingHierarchy(),
      focusable: accessibilityAudit.checkFocusableElements(),
      colorContrast: accessibilityAudit.checkColorContrast(),
    };
  },
};

// ARIA utilities
export const ariaUtils = {
  // Set ARIA live region
  setLiveRegion: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const region = document.createElement('div');
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';

    document.body.appendChild(region);

    setTimeout(() => {
      region.textContent = message;
      setTimeout(() => {
        document.body.removeChild(region);
      }, 1000);
    }, 100);
  },

  // Manage ARIA expanded state
  toggleExpanded: (element: HTMLElement, expanded: boolean) => {
    element.setAttribute('aria-expanded', expanded.toString());

    // Find associated content
    const controls = element.getAttribute('aria-controls');
    if (controls) {
      const content = document.getElementById(controls);
      if (content) {
        content.setAttribute('aria-hidden', (!expanded).toString());
      }
    }
  },

  // Announce page changes
  announcePageChange: (pageTitle: string) => {
    document.title = pageTitle;
    ariaUtils.setLiveRegion(`Navigerat till ${pageTitle}`, 'assertive');
  },
};

// Keyboard navigation utilities
export const keyboardUtils = {
  // Create skip links
  createSkipLinks: (links: { text: string; target: string }[]) => {
    const container = document.createElement('div');
    container.className = 'skip-links';
    container.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      z-index: 1000;
      transition: top 0.3s;
    `;

    links.forEach((link, index) => {
      const anchor = document.createElement('a');
      anchor.href = `#${link.target}`;
      anchor.textContent = link.text;
      anchor.setAttribute('data-skip-link', '');
      anchor.style.cssText = `
        display: inline-block;
        padding: 8px 16px;
        background: #000;
        color: #fff;
        text-decoration: none;
        margin-right: 8px;
        border-radius: 4px;
      `;

      // Add keyboard shortcut
      anchor.setAttribute('data-shortcut', `Alt+${index + 1}`);

      container.appendChild(anchor);
    });

    // Show on focus
    container.addEventListener('focusin', () => {
      container.style.top = '6px';
    });

    container.addEventListener('focusout', (event) => {
      // Hide if focus moves outside skip links
      setTimeout(() => {
        if (!container.contains(document.activeElement)) {
          container.style.top = '-40px';
        }
      }, 100);
    });

    document.body.insertBefore(container, document.body.firstChild);
  },

  // Enhanced focus management
  manageFocus: {
    save: (): HTMLElement | null => {
      return document.activeElement as HTMLElement;
    },

    restore: (element: HTMLElement | null) => {
      if (element && typeof element.focus === 'function') {
        element.focus();
      }
    },

    moveTo: (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element && typeof element.focus === 'function') {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  },
};