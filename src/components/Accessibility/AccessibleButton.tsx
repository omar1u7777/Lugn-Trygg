import React, { forwardRef } from 'react';
import { Button, ButtonProps } from '@mui/material';
import { useAccessibility } from '../../hooks/useAccessibility';

interface AccessibleButtonProps extends Omit<ButtonProps, 'aria-label'> {
  ariaLabel?: string;
  ariaDescription?: string;
  tooltip?: string;
  loadingAnnouncement?: string;
  successAnnouncement?: string;
  errorAnnouncement?: string;
}

const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    children,
    ariaLabel,
    ariaDescription,
    tooltip,
    loadingAnnouncement,
    successAnnouncement,
    errorAnnouncement,
    disabled,
    loading,
    onClick,
    ...props
  }, ref) => {
    const { announceToScreenReader, getAriaLabel } = useAccessibility();

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // Announce loading state
      if (loading && loadingAnnouncement) {
        announceToScreenReader(loadingAnnouncement);
      }

      // Call original onClick
      if (onClick) {
        onClick(event);
      }
    };

    // Generate comprehensive ARIA label
    const computedAriaLabel = ariaLabel || getAriaLabel(
      typeof children === 'string' ? children : 'Button',
      tooltip
    );

    return (
      <Button
        ref={ref}
        aria-label={computedAriaLabel}
        aria-describedby={ariaDescription ? `desc-${computedAriaLabel.replace(/\s+/g, '-').toLowerCase()}` : undefined}
        aria-pressed={props.variant === 'contained' ? true : undefined}
        aria-disabled={disabled || loading}
        title={tooltip}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {children}

        {/* Hidden description for screen readers */}
        {ariaDescription && (
          <span
            id={`desc-${computedAriaLabel.replace(/\s+/g, '-').toLowerCase()}`}
            style={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
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