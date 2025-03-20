import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../../api/api";
import * as punycode from "punycode";
import "../../styles/styles.css";

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  const validateEmail = (email: string): string | null => {
    if (!email.includes("@")) return "⚠️ Ogiltig e-postadress.";

    const [localPart, domain] = email.split("@");
    if (!domain) return "⚠️ Domän saknas.";

    try {
      const encodedDomain = punycode.toASCII(domain.trim());
      const validEmail = `${localPart}@${encodedDomain}`;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      return emailRegex.test(validEmail) ? null : "⚠️ Ogiltig e-postadress.";
    } catch (error) {
      return "⚠️ Domänen innehåller ogiltiga tecken.";
    }
  };

  const validatePassword = (password: string): boolean => password.length >= 8;

  const validateForm = (): boolean => {
    setError(null);

    if (!email.trim() || !password || !confirmPassword) {
      setError("⚠️ Alla fält måste fyllas i.");
      return false;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return false;
    }

    if (!validatePassword(password)) {
      setError("⚠️ Lösenordet måste vara minst 8 tecken långt.");
      return false;
    }

    if (password !== confirmPassword) {
      setError("⚠️ Lösenorden matchar inte.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const [localPart, domain] = email.split("@");
      if (!domain) throw new Error("⚠️ Domän saknas.");

      const encodedDomain = punycode.toASCII(domain.trim());
      const encodedEmail = `${localPart}@${encodedDomain}`;

      const response = await registerUser(encodedEmail, password);

      if (response) {
        setSuccessMessage("✅ Konto skapades framgångsrikt! Omdirigerar...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError("❌ Registrering misslyckades, kontrollera dina uppgifter.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "❌ Registrering misslyckades.");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="auth-title">📝 Skapa konto</h2>

        {successMessage && <p className="success-message">{successMessage}</p>}
        {error && <p className="error-message">{error}</p>}

        <div className="form-group">
          <label htmlFor="email">📩 E-post:</label>
          <input
          id="email"
          type="text" 
          className="auth-input"
          placeholder="Ange din e-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        </div>

        <div className="form-group">
          <label htmlFor="password">🔑 Lösenord:</label>
          <div className="password-container">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="auth-input"
              placeholder="Minst 8 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button
              type="button"
              className="show-password-button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "👁️‍🗨️" : "👁️"}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">🔄 Bekräfta lösenord:</label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            className="auth-input"
            placeholder="Bekräfta ditt lösenord"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <button className="auth-button" type="submit" disabled={loading}>
          {loading ? "🔄 Registrerar..." : "✅ Skapa konto"}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
