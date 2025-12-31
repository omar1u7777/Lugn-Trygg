import React, { useEffect, useRef, useId, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FocusTrap from './FocusTrap';
import { useAccessibility } from '../../hooks/useAccessibility';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

interface AccessibleDialogProps extends Omit<DialogProps, 'aria-labelledby' | 'aria-describedby'> {
  title: string;
  titleId?: string;
  contentId?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const AccessibleDialog = ({
  title,
  titleId,
  contentId,
  description,
  onClose,
  children,
  actions,
  open,
}: AccessibleDialogProps) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Use React's useId for stable, unique IDs
  const generatedId = useId();
  const dialogTitleId = titleId || `dialog-title-${generatedId}`;
  const dialogContentId = contentId || `dialog-content-${generatedId}`;
  const dialogDescriptionId = description ? `dialog-desc-${generatedId}` : undefined;

  // Memoize the announcement to avoid unnecessary calls
  const announcement = useMemo(() => t('dialog.opened', { title }), [t, title]);

  useEffect(() => {
    if (open) {
      // Announce dialog opening to screen readers with error handling
      try {
        announceToScreenReader(announcement, 'assertive');
      } catch (error) {
        console.warn('Failed to announce dialog opening:', error);
      }

      // Focus the title when dialog opens, with proper timing and error handling
      const focusFrame = requestAnimationFrame(() => {
        if (titleRef.current) {
          try {
            titleRef.current.focus();
          } catch (error) {
            console.warn('Failed to focus dialog title:', error);
          }
        }
      });

      // Cleanup frame on unmount or when open changes
      return () => cancelAnimationFrame(focusFrame);
    }
    return;
  }, [open, announcement, announceToScreenReader]);


  // Memoize click handler
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <FocusTrap active={open} onEscape={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={handleDialogClick}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2
              id={dialogTitleId}
              ref={titleRef}
              tabIndex={-1}
              className="text-xl font-bold text-gray-900 dark:text-white focus:outline-none"
            >
              {title}
            </h2>
            <button
              aria-label={t('dialog.close')}
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Description */}
          {description && (
            <div className="px-6 pt-4">
              <p
                id={dialogDescriptionId}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {description}
              </p>
            </div>
          )}

          {/* Content */}
          <div id={dialogContentId} className="p-6">
            {children}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              {actions}
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
};

export default AccessibleDialog;


