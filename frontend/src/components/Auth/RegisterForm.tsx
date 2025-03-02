import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../../api/api";
import "../../styles/styles.css";

const RegisterForm: React.FC = () => {
  // Hanterar användarens inputfält
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  // Funktion för att validera e-postformat
  const validateEmail = (email: string): boolean => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
  };

  // Funktion för att validera lösenordets längd
  const validatePassword = (password: string): boolean => password.length >= 8;

  // Funktion för att validera hela formuläret
  const validateForm = (): boolean => {
    setError(null);
    if (!email.trim() || !password || !confirmPassword) {
      setError("⚠️ Alla fält måste fyllas i.");
      return false;
    }
    if (!validateEmail(email)) {
      setError("⚠️ Ogiltig e-postadress.");
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

  // Hantera formulärinlämning
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return; // Validera formuläret innan submission

    setLoading(true); // Sätt inläsning tillstånd till true
    setError(null); // Rensa tidigare felmeddelanden
    setSuccessMessage(null); // Rensa eventuella framgångsmeddelanden

    try {
      // Försök att registrera användaren
      const response = await registerUser(email.trim(), password, confirmPassword);
      if (response) {
        setSuccessMessage("✅ Konto skapades framgångsrikt! Du kan nu logga in.");
        setTimeout(() => {
          navigate("/login"); // Omdirigera användaren till login-sidan
        }, 2000);
      } else {
        setError("❌ Registrering misslyckades, kontrollera dina uppgifter.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "❌ Registrering misslyckades.");
      setPassword(""); // Rensa lösenord
      setConfirmPassword(""); // Rensa bekräftat lösenord
    } finally {
      setLoading(false); // Sätt inläsning tillstånd tillbaka till false
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        backgroundColor: "#f0f8f8",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem"
      }}
      aria-label="Registreringssektion"
    >
      <form
        onSubmit={handleSubmit}
        className="auth-form"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
          padding: "2rem",
          maxWidth: "400px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1rem"
        }}
        aria-label="Registreringsformulär"
      >
        <h2
          className="auth-title"
          style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: "1rem" }}
        >
          📝 Skapa konto
        </h2>

        {/* Framgångsmeddelande vid lyckad registrering */}
        {successMessage && (
          <p
            className="success-message"
            style={{ color: "#28a745", fontWeight: "bold", textAlign: "center" }}
          >
            {successMessage}
          </p>
        )}

        {/* Felmeddelanden */}
        {error && (
          <p
            className="error-message"
            role="alert"
            style={{ color: "#d93025", fontWeight: "bold", textAlign: "center" }}
          >
            {error}
          </p>
        )}

        {/* E-postfält */}
        <div className="form-group">
          <label htmlFor="email">📩 E-post:</label>
          <input
            id="email"
            type="email"
            className="auth-input"
            placeholder="Ange din e-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>

        {/* Lösenordfält */}
        <div className="form-group">
          <label htmlFor="password">🔑 Lösenord:</label>
          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="auth-input"
              placeholder="Minst 8 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              style={{ width: "100%", paddingRight: "40px" }}
            />
            <button
              type="button"
              className="show-password-button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "10px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "1.2rem"
              }}
            >
              {showPassword ? "👁️‍🗨️" : "👁️"}
            </button>
          </div>
        </div>

        {/* Bekräfta lösenord-fält */}
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
            autoComplete="new-password"
          />
        </div>

        {/* Skapa konto-knapp */}
        <button
          className="auth-button"
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#4caf50",
            color: "#fff",
            fontSize: "1.1rem",
            fontWeight: "bold",
            padding: "0.75rem",
            borderRadius: "5px",
            border: "none",
            cursor: "pointer",
            marginTop: "1rem"
          }}
        >
          {loading ? "🔄 Registrerar..." : "✅ Skapa konto"}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
