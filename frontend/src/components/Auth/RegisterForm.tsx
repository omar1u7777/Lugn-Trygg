import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { registerUser } from "../../api/api";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    console.log("Sending registration data:", { email, password, name, referralCode: referralCode || "none" });

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
    } catch (err: any) {
      console.error("Registration error details:", err.response?.data);
      console.error("Full error:", err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" role="main" aria-labelledby="register-title">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
        <header>
          <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-8 flex items-center justify-center gap-3" id="register-title">
            <span className="text-primary-500 text-2xl" aria-hidden="true">👤</span>
            Skapa konto
          </h1>
        </header>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3" role="alert" aria-live="assertive" id="register-error">
            <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
            <p className="text-red-800 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 flex items-center gap-3" role="status" aria-live="polite" id="register-success">
            <span className="text-green-500 text-lg" aria-hidden="true">✅</span>
            <p className="text-green-800 dark:text-green-300 font-medium">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500" aria-hidden="true">👤</span>
              Namn
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="Ange ditt namn"
              required
              disabled={loading}
              aria-describedby={error ? "register-error" : undefined}
              aria-invalid={!!error}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500" aria-hidden="true">📧</span>
              E-postadress
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="Ange din e-postadress"
              required
              disabled={loading}
              aria-describedby={error ? "register-error" : undefined}
              aria-invalid={!!error}
            />
          </div>

          {/* Referral Code Input */}
          {referralCode && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4" role="status" aria-live="polite">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" aria-hidden="true">🎁</span>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Referenskod aktiv!
                </p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Du och din vän får båda 1 vecka gratis premium! 🎉
              </p>
              <div className="mt-3">
                <label htmlFor="referralCode" className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                  Kod: <span className="font-mono font-bold">{referralCode}</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500" aria-hidden="true">🔒</span>
              Lösenord
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pr-12"
                placeholder="Skapa ett starkt lösenord"
                required
                disabled={loading}
                aria-describedby={error ? "register-error" : "password-help"}
                aria-invalid={!!error}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                title={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-pressed={showPassword}
              >
                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} aria-hidden="true"></i>
              </button>
            </div>
            <p id="password-help" className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Minst 8 tecken, en stor bokstav, en liten bokstav, en siffra och ett specialtecken.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500" aria-hidden="true">🔒</span>
              Bekräfta lösenord
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input pr-12"
                placeholder="Bekräfta ditt lösenord"
                required
                disabled={loading}
                aria-describedby={error ? "register-error" : undefined}
                aria-invalid={!!error}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                title={showConfirmPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-label={showConfirmPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-pressed={showConfirmPassword}
              >
                <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"} aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 text-lg font-semibold"
            disabled={loading}
            aria-describedby={loading ? "register-loading" : undefined}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>
                <span id="register-loading">Skapar konto...</span>
              </>
            ) : (
              <>
                <i className="fas fa-user-plus mr-2" aria-hidden="true"></i>
                Skapa konto
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Har du redan ett konto?{" "}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold transition-colors duration-200"
              aria-label="Gå till inloggningssidan"
            >
              Logga in här
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;