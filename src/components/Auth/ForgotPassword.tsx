import React, { useState, useCallback } from "react";
import { loadFirebaseAuthBundle } from "../../services/lazyFirebase";
import { XMarkIcon, EnvelopeIcon, PaperAirplaneIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';
import { Dialog } from "../ui/tailwind/Dialog";
import { Input } from "../ui/tailwind/Input";
import { Button } from "../ui/tailwind/Button";
import { Alert } from "../ui/tailwind/Feedback";
import { useAccessibility } from "../../hooks/useAccessibility";
import { useTranslation } from 'react-i18next';

// Email validation utility
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Custom hook for forgot password logic
const useForgotPassword = (_onSuccess: () => void) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { announceToScreenReader } = useAccessibility();
  const { t } = useTranslation();

  const resetStates = useCallback(() => {
    setError("");
    setMessage("");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    resetStates();

    // Client-side email validation
    if (!isValidEmail(email)) {
      const errorMessage = t('forgotPassword.invalidEmail');
      setError(errorMessage);
      announceToScreenReader(`${t('forgotPassword.errorPrefix')} ${errorMessage}`, "assertive");
      return;
    }

    setLoading(true);
    announceToScreenReader(t('forgotPassword.sending'), "polite");

    try {
      const { firebaseAuth, authModule } = await loadFirebaseAuthBundle();
      const { sendPasswordResetEmail } = authModule;
      await sendPasswordResetEmail(firebaseAuth, email);
      setMessage(t('forgotPassword.resetLinkSent'));
      announceToScreenReader(t('forgotPassword.resetLinkSentAnnouncement'), "polite");
    } catch (err: unknown) {
      logger.error('Password reset error:', err);
      const firebaseError = err as { code?: string; message?: string };
      let errorMessage: string = t('forgotPassword.genericError');

      // Improved error handling — avoid revealing account existence
      switch (firebaseError.code) {
        case 'auth/user-not-found':
          // Don't reveal whether the email exists — show generic success message
          setMessage(t('forgotPassword.resetLinkSent'));
          announceToScreenReader(t('forgotPassword.resetLinkSentAnnouncement'), "polite");
          return;
        case 'auth/invalid-email':
          errorMessage = t('forgotPassword.invalidEmail');
          break;
        case 'auth/too-many-requests':
          errorMessage = t('forgotPassword.tooManyRequests');
          break;
        default:
          break;
      }

      setError(errorMessage);
      announceToScreenReader(`${t('forgotPassword.errorPrefix')} ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  }, [email, announceToScreenReader, resetStates, t]);

  return {
    email,
    setEmail,
    loading,
    message,
    error,
    handleSubmit,
  };
};

interface ForgotPasswordProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onClose, onSuccess }) => {
  const { email, setEmail, loading, message, error, handleSubmit } = useForgotPassword(onSuccess);
  const { t } = useTranslation();

  return (
    <Dialog open={true} onClose={onClose} size="md" titleId="forgot-password-title">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label={t('forgotPassword.closeDialog')}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="p-6">
          <h2 id="forgot-password-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🔑</span>
            {t('forgotPassword.title')}
          </h2>

          {message && (
            <Alert
              variant="success"
              role="status"
              aria-live="polite"
              className="mb-4"
            >
              <span className="text-lg mr-2" aria-hidden="true">✅</span>
              {message}
            </Alert>
          )}

          {error && (
            <Alert
              id="reset-error"
              variant="error"
              role="alert"
              aria-live="assertive"
              className="mb-4"
            >
              <span className="text-lg mr-2" aria-hidden="true">⚠️</span>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <EnvelopeIcon className="w-4 h-4 inline mr-1" />
                {t('forgotPassword.emailLabel')}
              </label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('forgotPassword.emailPlaceholder')}
                required
                disabled={loading}
                aria-describedby={error ? "reset-error reset-hint" : "reset-hint"}
                aria-invalid={!!error}
              />
              <p id="reset-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('forgotPassword.emailHint')}
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
              className="min-h-[44px]"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                  {t('forgotPassword.sending')}
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-5 h-5 mr-2" aria-hidden="true" />
                  {t('forgotPassword.sendButton')}
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('forgotPassword.backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ForgotPassword;
