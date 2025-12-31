import React, { forwardRef, useCallback, useMemo, useId } from 'react';
import { Button, ButtonProps } from '../ui/tailwind';
import { useAccessibility } from '../../hooks/useAccessibility';

// Constants for accessibility
const SCREEN_READER_HIDDEN_STYLES: React.CSSProperties = {
  position: 'absolute',
  left: '-10000px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
};

interface AccessibleButtonProps extends Omit<ButtonProps, 'aria-label'> {
  ariaLabel?: string;
  ariaDescription?: string;
  tooltip?: string;
  loadingAnnouncement?: string;
  successAnnouncement?: string; // Reserved for future use
  errorAnnouncement?: string; // Reserved for future use
}

/**
 * AccessibleButton - A fully accessible button component with enhanced screen reader support
 *
 * Features:
 * - Automatic ARIA label generation from children or tooltip
 * - Screen reader announcements for loading states
 * - Unique IDs for ARIA relationships
 * - Proper ARIA attributes handling
 * - Performance optimized with memoization
 */
const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    children,
    ariaLabel,
    ariaDescription,
    tooltip,
    loadingAnnouncement,
    successAnnouncement, // Reserved for future use
    errorAnnouncement, // Reserved for future use
    disabled,
    loading,
    onClick,
    ...props
  }, ref) => {
    const { announceToScreenReader, getAriaLabel } = useAccessibility();
    const uniqueId = useId();

    // Memoize the computed ARIA label to avoid recalculation on every render
    const computedAriaLabel = useMemo(() => {
      if (ariaLabel) return ariaLabel;

      // Extract text content from children for label generation
      const getTextContent = (children: React.ReactNode): string => {
        if (typeof children === 'string') return children;
        if (typeof children === 'number') return children.toString();
        if (Array.isArray(children)) {
          return children.map(getTextContent).join(' ');
        }
        if (React.isValidElement(children) && children.props.children) {
          return getTextContent(children.props.children);
        }
        return 'Button'; // Fallback
      };

      return getAriaLabel(getTextContent(children), tooltip);
    }, [ariaLabel, children, tooltip, getAriaLabel]);

    // Memoize the description ID to ensure consistency
    const descriptionId = useMemo(() => {
      return ariaDescription ? `desc-${uniqueId}` : undefined;
    }, [ariaDescription, uniqueId]);

    // Use useCallback for handleClick to prevent unnecessary re-renders
    const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      // Announce loading state to screen readers if provided
      if (loading && loadingAnnouncement) {
        announceToScreenReader(loadingAnnouncement);
      }

      // Call the original onClick handler if provided
      onClick?.(event);
    }, [loading, loadingAnnouncement, announceToScreenReader, onClick]);

    // Determine if this is a toggle button (aria-pressed should only be used for toggle buttons)
    // For now, we assume it's not a toggle unless explicitly specified
    const isToggleButton = false; // TODO: Add prop for toggle state if needed
    const ariaPressed = isToggleButton ? (props['aria-pressed'] || false) : undefined;

    return (
      <Button
        ref={ref}
        aria-label={computedAriaLabel}
        aria-describedby={descriptionId}
        aria-pressed={ariaPressed}
        title={tooltip}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {children}

        {/* Hidden description element for screen readers */}
        {ariaDescription && descriptionId && (
          <span
            id={descriptionId}
            style={SCREEN_READER_HIDDEN_STYLES}
          >
            {ariaDescription}
          </span>
        )}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;
