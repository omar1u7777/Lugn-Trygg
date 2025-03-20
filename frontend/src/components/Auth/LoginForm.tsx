import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../api/api";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/styles.css";

const LoginForm: React.FC = () => {
  //  Hanterar e-post och lösenordstillstånd
  const [email, setEmail] = useState(localStorage.getItem("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  //  Validering av e-postformat
  const validateEmail = (inputEmail: string): boolean => {
    const regex = /^[a-zA-ZåäöÅÄÖ0-9._%+\-]+@[a-zA-ZåäöÅÄÖ0-9.\-]+\.[a-zA-Z]{2,}$/;
    return regex.test(inputEmail);
  };

  //  Validering av lösenordslängd
  const validatePassword = (inputPassword: string): boolean => inputPassword.length >= 8;

  //  Hantering av formulärinlämning
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return; //  Undviker flera inlämningar samtidigt

    setError(null);
    setLoading(true);

    //  Kontrollera e-postformat
    if (!validateEmail(email.trim())) {
      setError("⚠️ Ogiltig e-postadress.");
      setLoading(false);
      return;
    }

    //  Kontrollera lösenordets längd
    if (!validatePassword(password)) {
      setError("⚠️ Lösenordet måste vara minst 8 tecken långt.");
      setLoading(false);
      return;
    }

    try {
      console.log("🔍 Försöker logga in med:", email);
      const response = await loginUser(email.trim(), password);

      if (response?.access_token && response?.user_id && response?.email) {
        console.log("✅ Inloggning lyckades!", response);

        // 🔒 Spara token och användardata i LocalStorage
        localStorage.setItem("token", response.access_token);
        localStorage.setItem("user", JSON.stringify({ email: response.email, user_id: response.user_id }));

        // 🔓 Använd login-metoden från AuthContext
        login(response.access_token, response.email, response.user_id);

        setPassword(""); // Rensar lösenordet efter lyckad inloggning
        navigate("/dashboard", { replace: true }); // 🚀 Omdirigerar användaren
      } else {
        console.warn("⚠️ Inloggning lyckades, men saknar nödvändig data:", response);
        setError("❌ Något gick fel, försök igen.");
      }
    } catch (err: any) {
      console.error("❌ Login error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "❌ Inloggning misslyckades. Försök igen senare.");
      setPassword(""); // Rensar lösenordet vid fel
    } finally {
      setLoading(false);
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
        padding: "1rem",
      }}
      aria-label="Inloggningssektion"
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
          gap: "1rem",
        }}
        aria-label="Logga in formulär"
      >
        <h2
          className="auth-title"
          style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: "1rem" }}
        >
          🔒 Logga in
        </h2>

        {error && (
          <p className="error-message" role="alert" style={{ color: "#d93025", fontWeight: "bold" }}>
            {error}
          </p>
        )}

        <div className="form-group">
          <label htmlFor="email" style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
            📩 E-post:
          </label>
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
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
            🔑 Lösenord:
          </label>
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
              autoComplete="current-password"
              style={{
                width: "100%",
                paddingRight: "2.5rem",
                padding: "0.75rem",
                fontSize: "1rem",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
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
                fontSize: "1.2rem",
              }}
            >
              {showPassword ? "👁️‍🗨️" : "👁️"}
            </button>
          </div>
        </div>

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
            marginTop: "1rem",
          }}
        >
          {loading ? "🔄 Loggar in..." : "✅ Logga in"}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
