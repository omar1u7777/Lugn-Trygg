import React, { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Input, Button, Typography } from "../ui/tailwind";
import { EyeIcon, EyeSlashIcon, ArrowPathIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { registerUser } from "../../api/api";
import { useMultiplePasswordToggle } from "../../hooks/usePasswordToggle";
import { useAccessibility } from "../../hooks/useAccessibility";
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

const RegisterForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string; terms?: string }>({});
  
  const { t } = useTranslation();
  // ✅ Använd custom hooks
  const { 
    showPassword, 
    showConfirmPassword, 
    togglePassword, 
    toggleConfirmPassword 
  } = useMultiplePasswordToggle();

  const { announceToScreenReader } = useAccessibility();

  // Check for referral code in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [searchParams]);

  const validatePassword = (pw: string) => {
    if (pw.length < 8) {
      return t('registerForm.passwordTooShort', 'Lösenordet måste vara minst 8 tecken långt.');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw)) {
      return t('registerForm.passwordNeedsChars', 'Lösenordet måste innehålla minst en stor bokstav, en liten bokstav och en siffra.');
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pw)) {
      return t('registerForm.passwordNeedsSpecial', 'Lösenordet måste innehålla minst ett specialtecken.');
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug('🔐 REGISTER - Form submitted', { email, name, hasReferralCode: !!referralCode });
    setError("");
    setSuccess("");
    setValidationErrors({});

    // Validate name
    if (!name.trim()) {
      setValidationErrors(prev => ({ ...prev, name: t('registerForm.nameRequired') }));
      announceToScreenReader(t('registerForm.formErrors'), "assertive");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setValidationErrors(prev => ({ ...prev, email: t('registerForm.invalidEmail') }));
      announceToScreenReader(t('registerForm.formErrors'), "assertive");
      return;
    }

    if (password !== confirmPassword) {
      setValidationErrors(prev => ({ ...prev, confirmPassword: t('registerForm.passwordMismatch', 'Lösenorden matchar inte.') }));
      announceToScreenReader(t('registerForm.passwordMismatch', 'Lösenorden matchar inte.'), "assertive");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setValidationErrors(prev => ({ ...prev, password: passwordError }));
      announceToScreenReader(passwordError, "assertive");
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      setValidationErrors(prev => ({ ...prev, terms: t('registerForm.termsRequired') }));
      announceToScreenReader(t('registerForm.termsRequired'), "assertive");
      return;
    }

    setLoading(true);

    try {
      const response = await registerUser(email, password, name, referralCode, acceptTerms, acceptPrivacy);
      
      // Check if referral was successful
      if (response.referral?.success) {
        const msg = `${t('registerForm.successWithReferral', { message: response.referral.message })}`;
        setSuccess(msg);
        announceToScreenReader(msg, "polite");
      } else {
        setSuccess(t('registerForm.success'));
        announceToScreenReader(t('registerForm.success'), "polite");
      }
      
      setEmail("");
      setName("");
      setPassword("");
      setConfirmPassword("");
      setReferralCode("");
    } catch (err: unknown) {
      logger.error("Registration error:", err);
      const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
        ? String(err.response.data.error)
        : err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      announceToScreenReader(`${t('registerForm.failedPrefix')} ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full"
      aria-labelledby="register-title"
    >
        <header>
          <Typography
            id="register-title"
            variant="h4"
            className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 flex items-center justify-center gap-2 sm:gap-3 text-[#2f2a24] dark:text-gray-100"
          >
            <span className="text-2xl" aria-hidden="true">
              👤
            </span>
            {t('registerForm.title')}
          </Typography>
        </header>

        {error && (
          <Alert
            variant="error"
            role="alert"
            aria-live="assertive"
            id="register-error"
            data-testid="register-error-message"
            className="mb-6"
          >
            <span className="text-lg mr-2" aria-hidden="true">⚠️</span>
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            variant="success"
            role="status"
            aria-live="polite"
            id="register-success"
            data-testid="register-success-message"
            className="mb-6"
          >
            <span className="text-lg mr-2" aria-hidden="true">✅</span>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5 md:gap-6" noValidate>
          <div>
            <label
              htmlFor="name"
              className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              <span className="text-primary" aria-hidden="true">
                👤
              </span>
              {t('registerForm.nameLabel')}
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('registerForm.namePlaceholder')}
              required
              disabled={loading}
              data-testid="register-name-input"
              aria-describedby={validationErrors.name ? "name-error" : undefined}
              aria-invalid={!!validationErrors.name}
            />
            {validationErrors.name && (
              <p id="name-error" className="mt-1 text-sm text-error-600 dark:text-error-400">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              <span className="text-primary" aria-hidden="true">
                📧
              </span>
              {t('registerForm.emailLabel')}
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('registerForm.emailPlaceholder')}
              required
              disabled={loading}
              data-testid="register-email-input"
              aria-describedby={validationErrors.email ? "email-error" : undefined}
              aria-invalid={!!validationErrors.email}
            />
            {validationErrors.email && (
              <p id="email-error" className="mt-1 text-sm text-error-600 dark:text-error-400">{validationErrors.email}</p>
            )}
          </div>

          {/* Referral Code Input */}
          {referralCode && (
            <Alert
              variant="success"
              role="status"
              aria-live="polite"
              className="bg-green-50 dark:bg-green-900/20"
            >
              <span className="text-2xl mr-2" aria-hidden="true">🎁</span>
              <div>
                <p className="text-sm font-semibold mb-1">
                  {t('registerForm.referralActive')}
                </p>
                <p className="text-xs mb-2">
                  {t('registerForm.referralBenefit')}
                </p>
                <p className="text-xs font-medium mt-3">
                  {t('registerForm.referralCode')} <span className="font-mono font-bold" data-testid="register-referral-code">{referralCode}</span>
                </p>
              </div>
            </Alert>
          )}

          <div>
            <label
              htmlFor="password"
              className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              <span className="text-primary" aria-hidden="true">
                🔒
              </span>
              {t('registerForm.passwordLabel')}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('registerForm.passwordPlaceholder')}
                required
                disabled={loading}
                className="pr-12"
                data-testid="register-password-input"
                aria-describedby={validationErrors.password ? "password-error" : "password-help"}
                aria-invalid={!!validationErrors.password}
              />
              <button
                type="button"
                onClick={togglePassword}
                disabled={loading}
                title={showPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
                aria-label={showPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            <p id="password-help" className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              {t('registerForm.passwordHelp')}
            </p>
            {validationErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-error-600 dark:text-error-400">{validationErrors.password}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              <span className="text-primary" aria-hidden="true">
                🔒
              </span>
              {t('registerForm.confirmPasswordLabel')}
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('registerForm.confirmPasswordPlaceholder')}
                required
                disabled={loading}
                className="pr-12"
                data-testid="register-confirm-password-input"
                aria-describedby={validationErrors.confirmPassword ? "confirm-password-error" : undefined}
                aria-invalid={!!validationErrors.confirmPassword}
              />
              <button
                type="button"
                onClick={toggleConfirmPassword}
                disabled={loading}
                title={showConfirmPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
                aria-label={showConfirmPassword ? t('registerForm.hidePassword') : t('registerForm.showPassword')}
                aria-pressed={showConfirmPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p id="confirm-password-error" className="mt-1 text-sm text-error-600 dark:text-error-400">{validationErrors.confirmPassword}</p>
            )}
          </div>

          {/* Terms & Privacy checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={loading}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                aria-describedby={validationErrors.terms ? "terms-error" : undefined}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('registerForm.acceptTermsPrefix')}{" "}
                <Link to="/terms" className="text-primary-600 dark:text-primary-400 underline hover:no-underline" target="_blank">
                  {t('registerForm.termsLink')}
                </Link>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                disabled={loading}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                aria-describedby={validationErrors.terms ? "terms-error" : undefined}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('registerForm.acceptPrivacyPrefix')}{" "}
                <Link to="/privacy" className="text-primary-600 dark:text-primary-400 underline hover:no-underline" target="_blank">
                  {t('registerForm.privacyLink')}
                </Link>
              </span>
            </label>
            {validationErrors.terms && (
              <p id="terms-error" className="text-sm text-error-600 dark:text-error-400">{validationErrors.terms}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            data-testid="register-submit-button"
            className="w-full min-h-[44px] sm:min-h-[48px]"
            aria-describedby={loading ? "register-loading" : undefined}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                <span id="register-loading">{t('registerForm.creating')}</span>
              </>
            ) : (
              <>
                <UserPlusIcon className="w-5 h-5 mr-2" aria-hidden="true" />
                {t('registerForm.title')}
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {t('registerForm.hasAccount')}{" "}
            <Link
              to="/login"
              className="text-primary-600 dark:text-primary-400 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
              data-testid="register-login-link"
              aria-label={t('registerForm.goToLogin')}
            >
              {t('registerForm.loginLink')}
            </Link>
          </p>
        </div>
    </div>
  );
};

export default RegisterForm;