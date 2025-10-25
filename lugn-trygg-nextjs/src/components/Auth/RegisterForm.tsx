"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loading, Alert } from "../UI";

export default function RegisterForm() {
  // Prefer reading search params from window to avoid CSR bailout warnings
  // in prerendering. This keeps the component fully client-side and simple.
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) setReferralCode(refCode);
  }, []);

  const validatePassword = (pw: string) => {
    if (pw.length < 8) return "Lösenordet måste vara minst 8 tecken långt.";
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw)) return "Lösenordet måste innehålla minst en stor bokstav, en liten bokstav och en siffra.";
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pw)) return "Lösenordet måste innehålla minst ett specialtecken.";
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

    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, referralCode }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.referral?.success) {
        setSuccess(`Registrering lyckades! ${data.referral.message} Du kan nu logga in.`);
      } else {
        setSuccess("Registrering lyckades! Du kan nu logga in.");
      }

      setEmail("");
      setName("");
      setPassword("");
      setConfirmPassword("");
      setReferralCode("");
    } catch (err: any) {
      console.error("Registration error details:", err);
      setError(err.message || "Registrering misslyckades");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
        <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-8 flex items-center justify-center gap-3">
          <span className="text-primary-500 text-2xl">👤</span>
          Skapa konto
        </h2>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-6">
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500">👤</span>
              Namn
            </label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="Ange ditt namn" required disabled={loading} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500">📧</span>
              E-postadress
            </label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="Ange din e-postadress" required disabled={loading} />
          </div>

          {referralCode && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎁</span>
                <p className="font-semibold text-green-800 dark:text-green-200">Referenskod aktiv!</p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">Du och din vän får båda 1 vecka gratis premium! 🎉</p>
              <div className="mt-3">
                <label htmlFor="referralCode" className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">Kod: <span className="font-mono font-bold">{referralCode}</span></label>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500">🔒</span>
              Lösenord
            </label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input pr-12" placeholder="Skapa ett starkt lösenord" required disabled={loading} />
              <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200" onClick={() => setShowPassword(!showPassword)} disabled={loading}>
                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Minst 8 tecken, en stor bokstav, en liten bokstav, en siffra och ett specialtecken.</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500">🔒</span>
              Bekräfta lösenord
            </label>
            <div className="relative">
              <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input pr-12" placeholder="Bekräfta ditt lösenord" required disabled={loading} />
              <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={loading}>
                <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 text-lg font-semibold flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loading size="sm" variant="spinner" />
                Skapar konto...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus mr-2"></i>
                Skapa konto
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">Har du redan ett konto? {" "}<Link href="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold transition-colors duration-200">Logga in här</Link></p>
        </div>
      </div>
    </div>
  );
}
