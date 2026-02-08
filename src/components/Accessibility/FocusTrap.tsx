import React, { useEffect, useRef, useCallback } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';import { logger } from '../../utils/logger';


// Constants for better maintainability
const FOCUSABLE_SELECTORS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface FocusTrapProps {
  children: React.ReactNode;
  active: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
  autoFocus?: boolean;
}

const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active,
  onEscape,
  restoreFocus = true,
  autoFocus = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const { trapFocus, setFocus } = useAccessibility();

  // Helper function to get focusable elements
  const getFocusableElements = useCallback((container: HTMLElement): NodeListOf<Element> => {
    return container.querySelectorAll(FOCUSABLE_SELECTORS);
  }, []);

  // Handle Escape key separately
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && onEscape) {
      onEscape();
    }
  }, [onEscape]);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Store the currently focused element for restoration
    if (restoreFocus) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    }

    // Set up focus trap using the hook's trapFocus
    const cleanupTrap = trapFocus(container);

    // Handle initial focus if autoFocus is enabled
    if (autoFocus) {
      const focusableElements = getFocusableElements(container);
      const firstElement = focusableElements[0] as HTMLElement;
      if (firstElement) {
        try {
          setFocus(firstElement);
        } catch (error) {
          logger.warn('FocusTrap: Failed to set initial focus', error);
        }
      }
    }

    // Add Escape key listener
    document.addEventListener('keydown', handleEscape);

    // Cleanup function
    return () => {
      // Remove Escape listener
      document.removeEventListener('keydown', handleEscape);

      // Clean up focus trap
      if (cleanupTrap) {
        cleanupTrap();
      }

      // Restore focus if requested
      if (restoreFocus && previouslyFocusedRef.current) {
        try {
          setFocus(previouslyFocusedRef.current);
        } catch (error) {
          logger.warn('FocusTrap: Failed to restore focus', error);
        }
      }
    };
  }, [active, autoFocus, restoreFocus, trapFocus, setFocus, getFocusableElements, handleEscape]);

  return (
    <div
      ref={containerRef}
      style={{
        outline: 'none',
      }}
      tabIndex={-1}
      aria-hidden={!active}
      role="dialog" // Add role for better semantics
      aria-modal={active} // Indicate modal behavior
    >
      {children}
    </div>
  );
};

export default FocusTrap;
