import React, { useState, useCallback } from "react";
import { loadFirebaseAuthBundle } from "../../services/lazyFirebase";
import { XMarkIcon, EnvelopeIcon, PaperAirplaneIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';
import { Dialog } from "../ui/tailwind/Dialog";
import { Input } from "../ui/tailwind/Input";
import { Button } from "../ui/tailwind/Button";
import { Alert } from "../ui/tailwind/Feedback";
import { useAccessibility } from "../../hooks/useAccessibility";

// Constants for messages and error handling
const MESSAGES = {
  SENDING_RESET_LINK: "Skickar återställningslänk...",
  RESET_LINK_SENT: "Återställningslänk har skickats till din e-postadress!",
  RESET_LINK_SENT_ANNOUNCEMENT: "Återställningslänk skickad",
  GENERIC_ERROR: "Ett fel uppstod. Försök igen senare.",
  EMAIL_HINT: "Vi skickar en återställningslänk till denna adress",
  BACK_TO_LOGIN: "Tillbaka till inloggning",
  TITLE: "Återställ Lösenord",
  EMAIL_LABEL: "E-postadress",
  EMAIL_PLACEHOLDER: "Ange din e-postadress",
  SEND_BUTTON: "Skicka Återställningslänk",
  SENDING_BUTTON: "Skickar...",
} as const;

const ERROR_MESSAGES = {
  USER_NOT_FOUND: "Ingen användare hittades med denna e-postadress.",
  INVALID_EMAIL: "Ogiltig e-postadress.",
  TOO_MANY_REQUESTS: "För många förfrågningar. Försök igen senare.",
} as const;

// Email validation utility
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Custom hook for forgot password logic
const useForgotPassword = (onSuccess: () => void) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { announceToScreenReader } = useAccessibility();

  const resetStates = useCallback(() => {
    setError("");
    setMessage("");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    resetStates();

    // Client-side email validation
    if (!isValidEmail(email)) {
      const errorMessage = ERROR_MESSAGES.INVALID_EMAIL;
      setError(errorMessage);
      announceToScreenReader(`Fel: ${errorMessage}`, "assertive");
      return;
    }

    setLoading(true);
    announceToScreenReader(MESSAGES.SENDING_RESET_LINK, "polite");

    try {
      const { firebaseAuth, authModule } = await loadFirebaseAuthBundle();
      const { sendPasswordResetEmail } = authModule;
      await sendPasswordResetEmail(firebaseAuth, email);
      setMessage(MESSAGES.RESET_LINK_SENT);
      announceToScreenReader(MESSAGES.RESET_LINK_SENT_ANNOUNCEMENT, "polite");
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err: unknown) {
      logger.error('Password reset error:', err);
      const firebaseError = err as { code?: string; message?: string };
      let errorMessage: string = MESSAGES.GENERIC_ERROR;

      // Improved error handling with specific Firebase error codes
      switch (firebaseError.code) {
        case 'auth/user-not-found':
          errorMessage = ERROR_MESSAGES.USER_NOT_FOUND;
          break;
        case 'auth/invalid-email':
          errorMessage = ERROR_MESSAGES.INVALID_EMAIL;
          break;
        case 'auth/too-many-requests':
          errorMessage = ERROR_MESSAGES.TOO_MANY_REQUESTS;
          break;
        default:
          if (firebaseError.message) {
            errorMessage = firebaseError.message;
          }
          break;
      }

      setError(errorMessage);
      announceToScreenReader(`Fel: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  }, [email, onSuccess, announceToScreenReader, resetStates]);

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

  return (
    <Dialog open={true} onClose={onClose} size="md">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Stäng dialog"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🔑</span>
            {MESSAGES.TITLE}
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
                {MESSAGES.EMAIL_LABEL}
              </label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={MESSAGES.EMAIL_PLACEHOLDER}
                required
                disabled={loading}
                aria-describedby={error ? "reset-error" : "reset-hint"}
                aria-invalid={!!error}
              />
              <p id="reset-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {MESSAGES.EMAIL_HINT}
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
                  {MESSAGES.SENDING_BUTTON}
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-5 h-5 mr-2" />
                  {MESSAGES.SEND_BUTTON}
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
              {MESSAGES.BACK_TO_LOGIN}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ForgotPassword;
