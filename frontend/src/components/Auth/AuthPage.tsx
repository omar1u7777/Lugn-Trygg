import React, { useState, useEffect } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import "../../styles/styles.css";

const AuthPage: React.FC = () => {
  // 🔹 Hämtar användarens senaste val från localStorage eller default till "login"
  const [activeForm, setActiveForm] = useState<"login" | "register">(() => {
    const storedForm = localStorage.getItem("authForm");
    return storedForm === "login" || storedForm === "register" ? storedForm : "login";
  });

  // 🔹 Uppdaterar localStorage när användaren byter formulär
  useEffect(() => {
    localStorage.setItem("authForm", activeForm);
  }, [activeForm]);

  return (
    <div className="auth-container" aria-label="Autentiseringssida">
      <header className="auth-header">
        <h1 className="app-title" aria-label="Appens namn">Lugn & Trygg</h1>
      </header>

      {/* 🏷️ Flikar för att växla mellan inloggning & registrering */}
      <nav className="auth-tabs" aria-label="Navigering för autentisering">
        <button
          className={`tab-btn ${activeForm === "login" ? "active-tab" : ""}`}
          onClick={() => setActiveForm("login")}
          aria-selected={activeForm === "login"}
          aria-label="Gå till inloggning"
        >
          🔐 Logga in
        </button>
        <button
          className={`tab-btn ${activeForm === "register" ? "active-tab" : ""}`}
          onClick={() => setActiveForm("register")}
          aria-selected={activeForm === "register"}
          aria-label="Gå till registrering"
        >
          📝 Registrera
        </button>
      </nav>

      {/* 📌 Dynamisk rendering av Login eller Register */}
      <main className="auth-content">
        {activeForm === "login" ? <LoginForm /> : <RegisterForm />}
      </main>
    </div>
  );
};

export default AuthPage;
