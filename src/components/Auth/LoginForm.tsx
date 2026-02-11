import { useState, useCallback } from "react"
import { Link } from "react-router-dom";
import { ArrowRightStartOnRectangleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';
import { loginUser, api } from "../../api/index";
import { API_ENDPOINTS } from "../../api/constants";
import { useAuth } from "../../contexts/AuthContext";
import { loadFirebaseAuthBundle } from "../../services/lazyFirebase";
import ForgotPassword from "./ForgotPassword";
import { Input } from "../ui/tailwind/Input";
import { Button } from "../ui/tailwind/Button";
import { Alert } from "../ui/tailwind/Feedback";
import { Typography } from "../ui/tailwind/Typography";
import { Divider } from "../ui/tailwind/Display";
import { LoadingSpinner } from "../LoadingStates";
import { useAccessibility } from "../../hooks/useAccessibility";
import { usePasswordToggle } from "../../hooks/usePasswordToggle";
// ScreenReaderAnnouncer removed — announcements handled by useAccessibility hook

// Constants for messages and strings
const MESSAGES = {
  LOGIN_SUCCESS: "Inloggning lyckades",
  LOGIN_FAILED: "Inloggning misslyckades",
  GOOGLE_LOGIN_SUCCESS: "Google-inloggning lyckades",
  GOOGLE_LOGIN_FAILED: "Google-inloggning misslyckades",
  DEFAULT_ERROR: "Ett fel uppstod vid inloggning",
  LOGGING_IN: "Loggar in...",
  LOGGING_IN_GOOGLE: "Loggar in med Google...",
  INVALID_EMAIL: "Ange en giltig e-postadress",
  PASSWORD_REQUIRED: "Lösenord är obligatoriskt",
} as const;

// Helper function to extract error message from API errors
const extractErrorMessage = (err: unknown): string => {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as any).response;
    if (response?.data?.error && typeof response.data.error === "string") {
      return response.data.error;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return MESSAGES.DEFAULT_ERROR;
};

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  
  // ✅ Använd custom hook istället för local state
  const { showPassword, togglePassword } = usePasswordToggle();
  
  const { login } = useAuth();
  const { announceToScreenReader } = useAccessibility();

  // ✅ Memoize handlers för bättre performance
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  // Validation function
  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = MESSAGES.INVALID_EMAIL;
    } else if (!emailRegex.test(email)) {
      errors.email = MESSAGES.INVALID_EMAIL;
    }

    if (!password.trim()) {
      errors.password = MESSAGES.PASSWORD_REQUIRED;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return; // Prevent multiple submissions

    if (!validateForm()) {
      announceToScreenReader("Formuläret innehåller fel. Korrigera och försök igen.", "assertive");
      return;
    }

    logger.debug('LOGIN - Form submitted', { email });
    setLoading(true);
    setError("");
    setValidationErrors({});

    announceToScreenReader(MESSAGES.LOGGING_IN, "polite");

    try {
      logger.debug('LOGIN - Calling loginUser API...');
      const data = await loginUser(email, password);
      logger.debug('LOGIN - Success', { userId: data.userId });
      login(data.accessToken, email, data.userId);
      announceToScreenReader(MESSAGES.LOGIN_SUCCESS, "polite");
    } catch (err: unknown) {
      logger.error('LOGIN - Failed:', err);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);
      announceToScreenReader(`${MESSAGES.LOGIN_FAILED}: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return; // Prevent multiple submissions

    logger.debug('LOGIN - Google sign-in initiated');
    setLoading(true);
    setError("");
    setValidationErrors({});

    announceToScreenReader(MESSAGES.LOGGING_IN_GOOGLE, "polite");

    try {
      const { firebaseAuth, authModule } = await loadFirebaseAuthBundle();
      const { GoogleAuthProvider, signInWithPopup } = authModule;

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;

      const idToken = await user.getIdToken();
      const response = await api.post(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, { id_token: idToken });

      // Backend returns APIResponse wrapper: { success, data: { accessToken, userId, user } }
      const data = response.data?.data || response.data;
      login(data.accessToken, user.email ?? '', data.userId);
      announceToScreenReader(MESSAGES.GOOGLE_LOGIN_SUCCESS, "polite");
    } catch (err: unknown) {
      logger.error('Google sign-in error:', err);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);
      announceToScreenReader(`${MESSAGES.GOOGLE_LOGIN_FAILED}: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="w-full"
      aria-labelledby="login-title"
    >
        <div className="text-center mb-6 sm:mb-8">
          <Typography
            id="login-title"
            variant="h4"
            className="p-1.5 flex justify-center items-center gap-1.5 font-bold text-xl sm:text-2xl md:text-3xl text-[#2f2a24] dark:text-gray-100"
            color="text.primary"
          >
            <span className="text-2xl" aria-hidden="true">
              🔐
            </span>
            Logga in
          </Typography>
        </div>

        {error && (
          <Alert
            id="login-error"
            variant="error"
            role="alert"
            aria-live="assertive"
            className="mb-6"
          >
            {error}
          </Alert>
        )}

        <LoadingSpinner isLoading={loading} message="Loggar in...">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 sm:gap-5 md:gap-6"
            role="form"
            aria-labelledby="login-title"
          >
            <div>
              <Input
                label="📧 E-postadress"
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="Ange din e-postadress"
                required
                disabled={loading}
                aria-describedby={error || validationErrors.email ? "login-error email-error" : undefined}
                aria-invalid={!!(error || validationErrors.email)}
              />
              {validationErrors.email && (
                <Typography id="email-error" variant="body2" color="error" className="mt-1 text-sm">
                  {validationErrors.email}
                </Typography>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                <span className="text-primary" aria-hidden="true">
                  🔒
                </span>
                Lösenord
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Ange ditt lösenord"
                  required
                  disabled={loading}
                  className="pr-12"
                  aria-describedby={error || validationErrors.password ? "login-error password-error" : undefined}
                  aria-invalid={!!(error || validationErrors.password)}
                />
                <button
                  type="button"
                  onClick={togglePassword}
                  disabled={loading}
                  title={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                  aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
              {validationErrors.password && (
                <Typography id="password-error" variant="body2" color="error" className="mt-1 text-sm">
                  {validationErrors.password}
                </Typography>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
              className="min-h-[44px] sm:min-h-[48px]"
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5 mr-2" aria-hidden="true" />
              Logga in
            </Button>
          </form>
        </LoadingSpinner>

        <Divider className="my-6 sm:my-8">
          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            eller
          </Typography>
        </Divider>

        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="p-3 sm:p-3.5 flex justify-center items-center gap-2 min-h-[44px] sm:min-h-[48px]"
        >
          <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Fortsätt med Google
        </Button>

        <div className="flex flex-col gap-3 sm:gap-4 text-center mt-6 sm:mt-8">
          <Typography variant="body2" color="text.secondary" className="text-sm sm:text-base">
            Har du inget konto?{" "}
            <Link
              to="/register"
              className="text-primary-600 dark:text-primary-400 font-semibold no-underline hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
              aria-label="Gå till registreringssidan"
            >
              Registrera dig här
            </Link>
          </Typography>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            disabled={loading}
            className="text-sm sm:text-base font-semibold text-primary-600 dark:text-primary-400 bg-transparent border-none cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center"
            aria-label="Öppna glömt lösenord-dialog"
            aria-haspopup="dialog"
          >
            Glömt lösenord?
          </button>
        </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
          onSuccess={() => setShowForgotPassword(false)}
        />
      )}
    </div>
  );
};

export default LoginForm;
