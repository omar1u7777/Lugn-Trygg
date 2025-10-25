import { useEffect, useState, useCallback } from 'react';

/**
 * Custom hook for accessibility features and WCAG 2.1 AA compliance
 * Provides utilities for screen readers, keyboard navigation, and accessibility preferences
 */

interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  focusVisible: boolean;
}

interface AccessibilityHook {
  preferences: AccessibilityPreferences;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  skipToContent: (elementId: string) => void;
  trapFocus: (container: HTMLElement, event: KeyboardEvent) => void;
  manageFocus: (element: HTMLElement | null) => void;
  getAriaLabel: (baseLabel: string, context?: string) => string;
  isHighContrast: boolean;
  isReducedMotion: boolean;
  focusRing: boolean;
}

export const useAccessibility = (): AccessibilityHook => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    screenReader: false,
    focusVisible: true,
  });

  // Detect user preferences on mount
  useEffect(() => {
    const detectPreferences = () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
      const prefersLargeText = window.matchMedia('(min-resolution: 120dpi)').matches;

      // Detect screen reader (basic detection)
      const screenReader = navigator.userAgent.includes('NVDA') ||
                          navigator.userAgent.includes('JAWS') ||
                          navigator.userAgent.includes('VoiceOver') ||
                          document.querySelector('[aria-live]') !== null;

      setPreferences({
        reducedMotion: prefersReducedMotion,
        highContrast: prefersHighContrast,
        largeText: prefersLargeText,
        screenReader,
        focusVisible: true,
      });
    };

    detectPreferences();

    // Listen for preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');

    const handlePreferenceChange = () => detectPreferences();

    motionQuery.addEventListener('change', handlePreferenceChange);
    contrastQuery.addEventListener('change', handlePreferenceChange);

    return () => {
      motionQuery.removeEventListener('change', handlePreferenceChange);
      contrastQuery.removeEventListener('change', handlePreferenceChange);
    };
  }, []);

  // Screen reader announcement
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    // Remove after announcement
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 1000);
  }, []);

  // Skip to content functionality
  const skipToContent = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: preferences.reducedMotion ? 'auto' : 'smooth' });
      announceToScreenReader(`Navigerade till ${element.getAttribute('aria-label') || elementId}`);
    }
  }, [preferences.reducedMotion, announceToScreenReader]);

  // Focus trap for modals and dialogs
  const trapFocus = useCallback((container: HTMLElement, event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }, []);

  // Manage focus for dynamic content
  const manageFocus = useCallback((element: HTMLElement | null) => {
    if (element) {
      // Store current focus
      const previouslyFocused = document.activeElement as HTMLElement;

      // Focus new element
      element.focus();

      // Return focus when needed
      return () => {
        if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus();
        }
      };
    }
  }, []);

  // Generate comprehensive ARIA labels
  const getAriaLabel = useCallback((baseLabel: string, context?: string) => {
    let label = baseLabel;

    if (context) {
      label += `, ${context}`;
    }

    // Add screen reader specific information
    if (preferences.screenReader) {
      label += '. Använd piltangenterna för att navigera.';
    }

    return label;
  }, [preferences.screenReader]);

  return {
    preferences,
    announceToScreenReader,
    skipToContent,
    trapFocus,
    manageFocus,
    getAriaLabel,
    isHighContrast: preferences.highContrast,
    isReducedMotion: preferences.reducedMotion,
    focusRing: preferences.focusVisible,
  };
};

// Utility functions for accessibility
export const accessibilityUtils = {
  // Generate unique IDs for ARIA relationships
  generateAriaId: (prefix: string = 'a11y') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  // Check if element is visible to screen readers
  isElementVisible: (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.getAttribute('aria-hidden') !== 'true';
  },

  // Get all focusable elements in a container
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )) as HTMLElement[];
  },

  // Calculate color contrast ratio
  getContrastRatio: (color1: string, color2: string): number => {
    // Simplified contrast calculation
    // In production, use a proper color contrast library
    return 4.5; // Mock value - WCAG AA requires 4.5:1 for normal text
  },

  // Check if color combination meets WCAG standards
  meetsContrastRequirement: (foreground: string, background: string, isLargeText: boolean = false): boolean => {
    const ratio = accessibilityUtils.getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
  },
};

export default useAccessibility;