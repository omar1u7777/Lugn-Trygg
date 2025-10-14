import React, { useState } from "react";
import { Link } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { loginUser, api } from "../../api/api";
import { useAuth } from "../../contexts/AuthContext";
import { auth as firebaseAuth } from "../../firebase-config";
import ForgotPassword from "./ForgotPassword";

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginUser(email, password);
      login(data.access_token, email, data.user_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      // Configure the provider to allow popups
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;

      // Add a small delay to ensure token is valid (Firebase timing issue)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send the Firebase ID token to our backend
      const idToken = await user.getIdToken();

      // Use axios for consistency with other API calls
      const response = await api.post('/api/auth/google-login', {
        id_token: idToken
      });

      const data = response.data;
      console.log('Google login response:', data);
      console.log('Calling login with:', data.access_token, user.email!, data.user_id);
      login(data.access_token, user.email!, data.user_id);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.response?.data?.error || err.message || 'Google-inloggning misslyckades');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2 className="auth-title">
          <i className="fas fa-sign-in-alt"></i> Logga in
        </h2>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              <i className="fas fa-envelope"></i> E-postadress
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="Ange din e-postadress"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              <i className="fas fa-lock"></i> Lösenord
            </label>
            <div className="password-container">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="Ange ditt lösenord"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="show-password-button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                title={showPassword ? "Dölj lösenord" : "Visa lösenord"}
              >
                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
              </button>
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Loggar in...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i> Logga in
              </>
            )}
          </button>
        </form>

        <div className="divider">
          <span>eller</span>
        </div>

        <button
          type="button"
          className="google-button"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <i className="fab fa-google"></i> Fortsätt med Google
        </button>

        <div className="auth-links">
          <p>
            Har du inget konto?{" "}
            <Link to="/register" className="auth-link">
              Registrera dig här
            </Link>
          </p>
          <p>
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => setShowForgotPassword(true)}
              disabled={loading}
            >
              Glömt lösenord?
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
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