import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, labelledBy, children }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    // focus first focusable
    if (focusable) { focusable[0]?.focus(); }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && overlayRef.current && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        aria-hidden="true"
      />

      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-h-[90vh] overflow-auto w-full max-w-lg mx-4 md:mx-0 p-4 md:p-6"
      >
        {children}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
          aria-label="Stäng dialog"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default Modal;
