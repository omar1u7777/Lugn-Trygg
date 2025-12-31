import { useRef } from "react";
import { Link } from "react-router-dom";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import ForgotPassword from "./ForgotPassword";
import GoogleSignInButton from "./GoogleSignInButton";
import { Card, CardContent } from "../ui/tailwind/Card";
import { Input } from "../ui/tailwind/Input";
import { Button } from "../ui/tailwind/Button";
import { Alert } from "../ui/tailwind/Feedback";
import { Container } from "../ui/tailwind/Layout";
import TrustLinks from './TrustLinks';
import Modal from "../ui/tailwind/Modal";
import WellnessGoalsOnboarding from "../Wellness/WellnessGoalsOnboarding";
import { useLoginForm } from "../../hooks/useLoginForm";
import { AUTH_MESSAGES } from "../../constants/authMessages";

const LoginForm = () => {
  const {
    email,
    password,
    error,
    loading,
    fieldErrors,
    capsLock,
    showPassword,
    showForgotPassword,
    showOnboardingModal,
    loggedInUserId,
    setEmail,
    setPassword,
    setShowPassword,
    setShowForgotPassword,
    setShowOnboardingModal,
    handleSubmit,
    handleGoogleSignIn,
    handleKeyUp,
    handleKeyDown,
  } = useLoginForm();

  const passwordInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen flex items-center justify-center px-2 sm:px-4 py-6 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Container maxWidth="sm" centered>
        <Card variant="elevated" padding="lg" className="w-full max-w-sm mx-auto">
          <CardContent>
            {/* Header */}
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <span className="text-3xl md:text-4xl">🔐</span>
                Logga in
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm md:text-base">
                Välkommen tillbaka till Lugn & Trygg
              </p>
            </div>

            {/* Error summary (aria-live assertive) */}
            {error && (
              <div role="alert" aria-live="assertive" className="mb-4 md:mb-6">
                <Alert variant="error">
                  <div className="font-medium">⚠️ {error}</div>
                  {/* If there are field-specific errors, list them for quick scanning */}
                  {(fieldErrors.email || fieldErrors.password) && (
                    <ul className="mt-2 ml-4 list-disc text-sm">
                      {fieldErrors.email && <li>{fieldErrors.email}</li>}
                      {fieldErrors.password && <li>{fieldErrors.password}</li>}
                    </ul>
                  )}
                </Alert>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
              <Input
                label="📧 E-postadress"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@email.se"
                required
                disabled={loading}
                error={fieldErrors.email}
                className="text-base md:text-lg py-3"
              />

              <Input
                label="🔒 Lösenord"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ditt lösenord"
                required
                disabled={loading}
                ref={passwordInputRef}
                onKeyUp={handleKeyUp}
                onKeyDown={handleKeyDown}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-full p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                }
                className="text-base md:text-lg py-3"
                error={fieldErrors.password}
              />

              {capsLock && (
                <div className="mt-1 text-xs text-warning-600 dark:text-warning-400" role="alert" aria-live="polite">
                  <span className="font-semibold">{AUTH_MESSAGES.CAPS_LOCK_WARNING}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <label className="flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 focus:outline-none"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    Kom ihåg mig
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 focus:outline-none focus:underline"
                  disabled={loading}
                  aria-disabled={loading}
                >
                  Glömt lösenord?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full text-base md:text-lg py-3"
                isLoading={loading}
                disabled={loading}
                aria-label="Logga in"
              >
                Logga in
              </Button>
              {/* Trust text under primary button */}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center" aria-live="polite">
                {AUTH_MESSAGES.TRUST_TEXT}
              </p>
              {/* Trust links and subtle disclaimer (moved to component) */}
              <TrustLinks />
            </form>

            {/* Divider */}
            <div className="relative my-6 md:my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs md:text-sm">
                <span className="px-3 md:px-4 bg-white dark:bg-gray-800 text-gray-500">
                  Eller fortsätt med
                </span>
              </div>
            </div>

            {/* Google Sign In */}
            <GoogleSignInButton
              onClick={handleGoogleSignIn}
              disabled={loading}
              loading={loading}
            />

            {/* Sign Up Link */}
            <p className="mt-6 md:mt-8 text-center text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Har du inget konto?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 focus:underline"
              >
                Registrera dig här
              </Link>
            </p>

            {/* Mental health links */}
            <nav className="mt-6 flex flex-col items-center gap-2 text-xs md:text-sm" aria-label="Hjälplänkar">
              <a href="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-primary-600 focus:underline" tabIndex={0}>
                Integritet
              </a>
              <a href="/ai-info" className="text-gray-500 dark:text-gray-400 hover:text-primary-600 focus:underline" tabIndex={0}>
                Hur AI används
              </a>
              <a href="/emergency" className="text-error-600 dark:text-error-400 hover:underline font-medium" tabIndex={0}>
                Akut hjälp
              </a>
            </nav>
          </CardContent>
        </Card>
      </Container>

      {/* Onboarding modal - accessible, focus-trap, remembers choice in localStorage */}
      <Modal
        isOpen={showOnboardingModal}
        onClose={() => {
          try { localStorage.setItem('wellness_onboarding_skipped', '1'); } catch { }
          setShowOnboardingModal(false);
        }}
        labelledBy="onboarding-heading"
      >
        <div>
          <h2 id="onboarding-heading" className="text-lg font-semibold">Välkommen — några snabba frågor</h2>
          <p className="text-sm text-gray-600 mt-1">Vill du anpassa din upplevelse? Dina val sparas i webbläsaren.</p>
          <div className="mt-4">
            <WellnessGoalsOnboarding
              userId={loggedInUserId || undefined}
              onComplete={() => {
                try { localStorage.setItem('wellness_onboarding_completed', '1'); } catch { }
                setShowOnboardingModal(false);
              }}
              onSkip={() => {
                try { localStorage.setItem('wellness_onboarding_skipped', '1'); } catch { }
                setShowOnboardingModal(false);
              }}
            />
          </div>
        </div>
      </Modal>

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
