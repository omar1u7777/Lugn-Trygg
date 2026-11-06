import React, { useState } from 'react';
import { Button, Dialog, DialogHeader, DialogTitle, DialogContent } from '../ui/tailwind';
import { useTranslation } from 'react-i18next';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';
import { SUPPORT_EMAIL } from '../../config/contact';

/**
 * Account deletion, described as the backend actually performs it.
 *
 * DELETE /auth/delete-account disables the sign-in at once, anonymises the
 * profile, ends the session and marks the account for permanent erasure after
 * ACCOUNT_ERASURE_DAYS (the nightly job in account_erasure.py does it).
 *
 * This dialog used to promise a 7-day "ångertid" with a live countdown and an
 * "Avbryt radering" button. The countdown was a local timer, the button called
 * no API and only reset the dialog, and the backend's period is 30 days. So a
 * person who pressed it was told the deletion was cancelled while their
 * account stayed disabled. There is no self-service undo, because the person
 * can no longer sign in to ask for one; the honest offer is support.
 *
 * An unreachable "do you need support?" step went too. Its trigger was a
 * placeholder that always returned false, and it carried its own hardcoded
 * list of crisis numbers.
 */

type DeleteStep = 'warning' | 'confirm' | 'done';

/** Must match the grace period set by DELETE /auth/delete-account. */
export const ACCOUNT_ERASURE_DAYS = 30;

interface DeleteAccountFlowProps {
  onDelete: (password: string) => Promise<void>;
  onCancel: () => void;
  /** Called once the account is closed: the session is no longer valid. */
  onDeleted: () => void;
  isOpen: boolean;
}

const DeleteAccountFlow: React.FC<DeleteAccountFlowProps> = ({
  onDelete,
  onCancel,
  onDeleted,
  isOpen,
}) => {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<DeleteStep>('warning');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [erasureDate, setErasureDate] = useState('');

  const confirmWord = t('profileHub.deleteFlow.confirmWord');
  // Once the account is closed, closing the dialog must not leave the person
  // inside an app whose session the backend has already ended.
  const close = step === 'done' ? onDeleted : onCancel;

  const handleConfirmDelete = async () => {
    if (confirmText !== confirmWord) {
      return;
    }
    if (!password) {
      setDeleteError(t('profileHub.deleteFlow.passwordRequired'));
      return;
    }

    setDeleteError('');
    setIsDeleting(true);
    try {
      await onDelete(password);
      setPassword('');
      // The nightly job runs after the grace period has passed, so the last
      // day is the one after it.
      const lastDay = new Date(Date.now() + (ACCOUNT_ERASURE_DAYS + 1) * 24 * 60 * 60 * 1000);
      setErasureDate(lastDay.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }));
      setStep('done');
      logger.info('Account closed; permanent erasure scheduled');
    } catch (error) {
      logger.error('Account deletion failed:', error);
      setDeleteError(t('profileHub.deleteFlow.failed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const renderWarningStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-3 sm:mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>

        <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.deleteFlow.title')}
        </DialogTitle>

        <ul className="text-left space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
          {(['warningClosed', 'warningData', 'warningFinal'] as const).map((key) => (
            <li key={key} className="flex items-start gap-2">
              <span className="text-red-500" aria-hidden="true">•</span>
              {t(`profileHub.deleteFlow.${key}`, { days: ACCOUNT_ERASURE_DAYS })}
            </li>
          ))}
        </ul>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('profileHub.deleteFlow.alternative')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" onClick={onCancel} className="w-full sm:flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => setStep('confirm')}
            className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {t('profileHub.deleteFlow.continue')}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  const renderConfirmStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-3 sm:mb-4">
          <ClockIcon className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>

        <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.deleteFlow.confirmTitle')}
        </DialogTitle>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
          {t('profileHub.deleteFlow.confirmText', { days: ACCOUNT_ERASURE_DAYS, email: SUPPORT_EMAIL })}
        </p>

        <div className="text-left mb-4 sm:mb-6">
          <label htmlFor="delete-confirm-word" className="block text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2">
            {t('profileHub.deleteFlow.typeToConfirm', { word: confirmWord })}
          </label>
          <input
            id="delete-confirm-word"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            autoComplete="off"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder={confirmWord}
          />
        </div>

        <div className="text-left mb-4 sm:mb-6">
          <label htmlFor="delete-confirm-password" className="block text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2">
            {t('profileHub.deleteFlow.passwordLabel')}
          </label>
          <input
            id="delete-confirm-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          {deleteError && (
            <p role="alert" className="mt-2 text-xs sm:text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => setStep('warning')} className="w-full sm:flex-1">
            {t('common.back')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmDelete}
            disabled={confirmText !== confirmWord || !password || isDeleting}
            className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? t('common.loading') : t('profileHub.deleteFlow.submit')}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  const renderDoneStep = () => (
    <DialogContent>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-3 sm:mb-4">
          <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
        </div>

        <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('profileHub.deleteFlow.doneTitle')}
        </DialogTitle>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
          {t('profileHub.deleteFlow.doneText', { date: erasureDate, email: SUPPORT_EMAIL })}
        </p>

        <Button variant="primary" onClick={onDeleted} className="w-full">
          {t('profileHub.deleteFlow.doneButton')}
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <Dialog open={isOpen} onClose={close}>
      <DialogHeader onClose={close} />
      <div className="max-w-md w-full mx-auto px-4 sm:px-6">
        {step === 'warning' && renderWarningStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'done' && renderDoneStep()}
      </div>
    </Dialog>
  );
};

export default DeleteAccountFlow;
