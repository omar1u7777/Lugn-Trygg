import React, { Fragment } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';

/**
 * Dialog/Modal Component
 * 
 * Accessible modal dialog with focus trapping and keyboard navigation.
 * Built on HeadlessUI Dialog which provides:
 * - Automatic focus management (traps focus within dialog)
 * - ESC key to close (via onClose prop)
 * - Click outside backdrop to close (via onClose prop)
 * - Proper ARIA attributes (aria-modal, role="dialog")
 * 
 * Usage:
 * <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Dialog Title" description="Optional description">
 *   <DialogHeader onClose={onClose}>
 *     <DialogTitle>My Dialog</DialogTitle>
 *     <DialogDescription>This is a description</DialogDescription>
 *   </DialogHeader>
 *   <DialogContent>Your content here</DialogContent>
 *   <DialogFooter>
 *     <Button onClick={onClose}>Close</Button>
 *   </DialogFooter>
 * </Dialog>
 * 
 * WCAG 2.1 AA Compliance:
 * - Focus trap: Automatically managed by HeadlessUI
 * - Keyboard navigation: Tab/Shift+Tab cycles through focusable elements
 * - ESC to close: Handled by HeadlessUI Dialog
 * - ARIA attributes: aria-modal, aria-labelledby, aria-describedby
 */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Optional ID for aria-labelledby. If not provided, auto-generated. */
  titleId?: string;
  /** Optional ID for aria-describedby. If not provided, auto-generated. */
  descriptionId?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  children,
  size = 'md',
  titleId,
  descriptionId,
}) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full m-4',
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog 
        as="div" 
        className="relative z-50" 
        onClose={onClose}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div 
            className="fixed inset-0 bg-black/50" 
            aria-hidden="true"
          />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel
                className={cn(
                  'w-full transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all',
                  sizes[size]
                )}
              >
                {children}
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
};

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({
  children,
  onClose,
  className,
  ...props
}) => {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)} {...props}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
          aria-label="Stäng dialog"
          type="button"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

export const DialogTitle: React.FC<DialogTitleProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <HeadlessDialog.Title
      as="h3"
      className={cn('text-2xl font-bold text-gray-900 dark:text-white', className)}
      {...props}
    >
      {children}
    </HeadlessDialog.Title>
  );
};

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

export const DialogDescription: React.FC<DialogDescriptionProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <HeadlessDialog.Description
      as="p"
      className={cn('mt-2 text-sm text-gray-600 dark:text-gray-400', className)}
      {...props}
    >
      {children}
    </HeadlessDialog.Description>
  );
};

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('mt-4', className)} {...props}>
      {children}
    </div>
  );
};

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

export const DialogFooter: React.FC<DialogFooterProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-3', className)} {...props}>
      {children}
    </div>
  );
};

// Snackbar/Toast Component
interface SnackbarProps {
  open: boolean;
  onClose: () => void;
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const Snackbar: React.FC<SnackbarProps> = ({
  open,
  onClose,
  message,
  variant = 'info',
  duration = 5000,
}) => {
  React.useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, duration, onClose]);

  const variants = {
    success: 'bg-success-700 text-white',
    error: 'bg-error-600 text-white',
    warning: 'bg-warning-600 text-white',
    info: 'bg-primary-600 text-white',
  };
  
  const roleByVariant = {
    success: 'status' as const,
    error: 'alert' as const,
    warning: 'alert' as const,
    info: 'status' as const,
  };
  
  const ariaLiveByVariant = {
    success: 'polite' as const,
    error: 'assertive' as const,
    warning: 'assertive' as const,
    info: 'polite' as const,
  };

  return (
    <Transition
      show={open}
      as={Fragment}
      enter="transition ease-out duration-300"
      enterFrom="transform opacity-0 translate-y-full"
      enterTo="transform opacity-100 translate-y-0"
      leave="transition ease-in duration-200"
      leaveFrom="transform opacity-100 translate-y-0"
      leaveTo="transform opacity-0 translate-y-full"
    >
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div
          className={cn(
            'flex items-center gap-3 px-6 py-3 rounded-lg shadow-lg',
            variants[variant]
          )}
          role={roleByVariant[variant]}
          aria-live={ariaLiveByVariant[variant]}
          aria-atomic="true"
        >
          <span>{message}</span>
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Stäng notis"
            type="button"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Transition>
  );
};
