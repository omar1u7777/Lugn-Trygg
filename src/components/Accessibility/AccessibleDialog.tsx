import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogProps,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import FocusTrap from './FocusTrap';
import { useAccessibility } from '../../hooks/useAccessibility';

interface AccessibleDialogProps extends Omit<DialogProps, 'aria-labelledby' | 'aria-describedby'> {
  title: string;
  titleId?: string;
  contentId?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  title,
  titleId,
  contentId,
  description,
  onClose,
  children,
  actions,
  open,
  ...props
}) => {
  const { announceToScreenReader } = useAccessibility();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Generate unique IDs
  const dialogTitleId = titleId || `dialog-title-${Date.now()}`;
  const dialogContentId = contentId || `dialog-content-${Date.now()}`;
  const dialogDescriptionId = description ? `dialog-desc-${Date.now()}` : undefined;

  useEffect(() => {
    if (open) {
      // Announce dialog opening to screen readers
      announceToScreenReader(`Dialog öppnad: ${title}`, 'assertive');

      // Focus the title when dialog opens
      setTimeout(() => {
        if (titleRef.current) {
          titleRef.current.focus();
        }
      }, 100);
    }
  }, [open, title, announceToScreenReader]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      {...props}
    >
      <FocusTrap active={open} onEscape={onClose}>
        <DialogTitle
          id={dialogTitleId}
          ref={titleRef}
          tabIndex={-1}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 1,
          }}
        >
          {title}
          <IconButton
            aria-label="Stäng dialog"
            onClick={onClose}
            size="small"
            sx={{ ml: 1 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        {description && (
          <DialogContent sx={{ pt: 0 }}>
            <div
              id={dialogDescriptionId}
              style={{
                marginBottom: 16,
                fontSize: '0.875rem',
                color: 'text.secondary',
              }}
            >
              {description}
            </div>
          </DialogContent>
        )}

        <DialogContent id={dialogContentId}>
          {children}
        </DialogContent>

        {actions && (
          <DialogActions>
            {actions}
          </DialogActions>
        )}
      </FocusTrap>
    </Dialog>
  );
};

export default AccessibleDialog;