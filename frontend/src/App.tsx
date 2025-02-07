import { useState, useEffect } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";
import "./styles.css";

// 🔹 Importera  Firebase-konfiguration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 🔹 Initiera Firebase endast om det inte redan är initierat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      newErrors.email = "E-post krävs";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Ogiltig e-postadress";
    }

    if (!password) {
      newErrors.password = "Lösenord krävs";
    } else if (password.length < 8) {
      newErrors.password = "Lösenord måste vara minst 8 tecken";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Lösenorden matchar inte";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccessMessage("Registrering lyckades!");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setErrors({ form: "E-postadressen används redan. Försök logga in istället." });
      } else if (error.code === "auth/invalid-email") {
        setErrors({ email: "Ogiltig e-postadress." });
      } else if (error.code === "auth/weak-password") {
        setErrors({ password: "Lösenordet är för svagt. Minst 6 tecken krävs." });
      } else {
        setErrors({ form: "Något gick fel. Försök igen." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">Registrering</h1>

      {successMessage && <div className="success-message">{successMessage}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="email">E-post</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={errors.email ? "error" : ""}
            disabled={isSubmitting}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Lösenord</label>
          <div className="password-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? "error" : ""}
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Dölj" : "Visa"}
            </button>
          </div>
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Bekräfta lösenord</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={errors.confirmPassword ? "error" : ""}
            disabled={isSubmitting}
          />
          {errors.confirmPassword && (
            <span className="error-message">{errors.confirmPassword}</span>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Registrerar..." : "Registrera"}
        </button>

        {errors.form && <div className="form-error">{errors.form}</div>}
      </form>
    </div>
  );
}

export default App;
