import React, { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Input, Card, Button } from "../ui/tailwind";
import { EyeIcon, EyeSlashIcon, ArrowPathIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { registerUser } from "../../api/api";
import { useMultiplePasswordToggle } from "../../hooks/usePasswordToggle";

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
  
  // ✅ Använd custom hooks
  const { 
    showPassword, 
    showConfirmPassword, 
    togglePassword, 
    toggleConfirmPassword 
  } = useMultiplePasswordToggle();

  // Check for referral code in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [searchParams]);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Lösenordet måste vara minst 8 tecken långt.";
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return "Lösenordet måste innehålla minst en stor bokstav, en liten bokstav och en siffra.";
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
      return "Lösenordet måste innehålla minst ett specialtecken.";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 REGISTER - Form submitted', { email, name, hasReferralCode: !!referralCode });
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Lösenorden matchar inte.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const response = await registerUser(email, password, name, referralCode);
      
      // Check if referral was successful
      if (response.referral?.success) {
        setSuccess(`Registrering lyckades! ${response.referral.message} Du kan nu logga in.`);
      } else {
        setSuccess("Registrering lyckades! Du kan nu logga in.");
      }
      
      setEmail("");
      setName("");
      setPassword("");
      setConfirmPassword("");
      setReferralCode("");
    } catch (err: unknown) {
      console.error("Registration error:", err);
      const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
        ? String(err.response.data.error)
        : err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-12 bg-gradient-to-b from-[#fff7f0] to-[#fffaf5]"
      role="main"
      aria-labelledby="register-title"
    >
      <Card className="w-full max-w-[95%] sm:max-w-md md:max-w-lg p-4 sm:p-6 md:p-8 shadow-[0_20px_60px_rgba(47,42,36,0.08)] border border-[#f2e4d4]">
        <header>
          <h1
            id="register-title"
            className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 flex items-center justify-center gap-2 sm:gap-3 text-[#2f2a24]"
          >
            <span className="text-2xl" aria-hidden="true">
              👤
            </span>
            Skapa konto
          </h1>
        </header>

        {error && (
          <Alert
            variant="error"
            role="alert"
            aria-live="assertive"
            id="register-error"
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
              className="flex items-center gap-2 mb-2 text-sm font-medium"
            >
              <span className="text-primary" aria-hidden="true">
                👤
              </span>
              Namn
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ange ditt namn"
              required
              disabled={loading}
              aria-describedby={error ? "register-error" : undefined}
              aria-invalid={!!error}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="flex items-center gap-2 mb-2 text-sm font-medium"
            >
              <span className="text-primary" aria-hidden="true">
                📧
              </span>
              E-postadress
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ange din e-postadress"
              required
              disabled={loading}
              aria-describedby={error ? "register-error" : undefined}
              aria-invalid={!!error}
            />
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
                  Referenskod aktiv!
                </p>
                <p className="text-xs mb-2">
                  Du och din vän får båda 1 vecka gratis premium! 🎉
                </p>
                <p className="text-xs font-medium mt-3">
                  Kod: <span className="font-mono font-bold">{referralCode}</span>
                </p>
              </div>
            </Alert>
          )}

          <div>
            <label
              htmlFor="password"
              className="flex items-center gap-2 mb-2 text-sm font-medium"
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Skapa ett starkt lösenord"
                required
                disabled={loading}
                className="pr-12"
                aria-describedby={error ? "register-error" : "password-help"}
                aria-invalid={!!error}
              />
              <button
                type="button"
                onClick={togglePassword}
                disabled={loading}
                title={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            <p id="password-help" className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Minst 8 tecken, en stor bokstav, en liten bokstav, en siffra och ett specialtecken.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="flex items-center gap-2 mb-2 text-sm font-medium"
            >
              <span className="text-primary" aria-hidden="true">
                🔒
              </span>
              Bekräfta lösenord
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Bekräfta ditt lösenord"
                required
                disabled={loading}
                className="pr-12"
                aria-describedby={error ? "register-error" : undefined}
                aria-invalid={!!error}
              />
              <button
                type="button"
                onClick={toggleConfirmPassword}
                disabled={loading}
                title={showConfirmPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-label={showConfirmPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-pressed={showConfirmPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            className="w-full min-h-[44px] sm:min-h-[48px]"
            aria-describedby={loading ? "register-loading" : undefined}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                <span id="register-loading">Skapar konto...</span>
              </>
            ) : (
              <>
                <UserPlusIcon className="w-5 h-5 mr-2" aria-hidden="true" />
                Skapa konto
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Har du redan ett konto?{" "}
            <Link
              to="/login"
              className="text-primary-600 dark:text-primary-400 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
              aria-label="Gå till inloggningssidan"
            >
              Logga in här
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default RegisterForm;