import React, { useEffect, useRef } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';

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
  const { trapFocus } = useAccessibility();

  useEffect(() => {
    if (!active) return;

    // Store the currently focused element
    if (restoreFocus) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    }

    // Focus the first focusable element when trap becomes active
    if (autoFocus && containerRef.current) {
      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      if (firstElement) {
        firstElement.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (containerRef.current) {
        trapFocus(containerRef.current, event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus when trap becomes inactive
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [active, autoFocus, onEscape, restoreFocus, trapFocus]);

  return (
    <div
      ref={containerRef}
      style={{
        outline: 'none',
      }}
      tabIndex={-1}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
};

export default FocusTrap;