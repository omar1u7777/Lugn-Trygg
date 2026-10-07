import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import WellnessGoalsOnboarding from './WellnessGoalsOnboarding';
import { useFocusTrap } from '../Accessibility/SkipLink';

interface WellnessGoalsDialogProps {
  open: boolean;
  userId?: string;
  /** The goals the person has now; the editor opens with them selected. */
  goals: string[];
  onSaved: (goals: string[]) => void;
  onClose: () => void;
}

/**
 * The one way to change wellness goals, wherever they are shown.
 *
 * The dashboard, /wellness and /recommendations each show the goals, and
 * each had its own way to change them (UI audit Dup-18): a dialog on the
 * dashboard, a second dialog on /wellness without focus handling, role or
 * Escape, and on /recommendations a button that only navigated to /wellness
 * and left the person to find the card there.
 */
const WellnessGoalsDialog: React.FC<WellnessGoalsDialogProps> = ({ open, userId, goals, onSaved, onClose }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-1100 flex items-center justify-center px-4">
      {/* Clicking the backdrop closes, the same as Escape. */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t('worldDashboard.wellnessGoalsLabel')}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('wellnessGoals.close')}
          className="absolute top-4 right-4 z-10 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        <WellnessGoalsOnboarding
          {...(userId ? { userId } : {})}
          initialGoals={goals}
          mode={goals.length > 0 ? 'edit' : 'onboarding'}
          onComplete={onSaved}
          onSkip={onClose}
        />
      </div>
    </div>
  );
};

export default WellnessGoalsDialog;
