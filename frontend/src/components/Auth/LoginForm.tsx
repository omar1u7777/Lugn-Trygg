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
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
        <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-8 flex items-center justify-center gap-3">
          <span className="text-primary-500 text-2xl">🔐</span>
          Logga in
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <p className="text-red-800 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500">📧</span>
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
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="text-primary-500">🔒</span>
              Lösenord
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pr-12"
                placeholder="Ange ditt lösenord"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-200"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                title={showPassword ? "Dölj lösenord" : "Visa lösenord"}
              >
                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 text-lg font-semibold"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Loggar in...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt mr-2"></i>
                Logga in
              </>
            )}
          </button>
        </form>

        <div className="flex items-center my-8">
          <div className="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
          <span className="px-4 text-sm text-slate-500 dark:text-slate-400 font-medium">eller</span>
          <div className="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-400 dark:hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Fortsätt med Google
        </button>

        <div className="mt-8 text-center space-y-2">
          <p className="text-slate-600 dark:text-slate-400">
            Har du inget konto?{" "}
            <Link
              to="/register"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold transition-colors duration-200"
            >
              Registrera dig här
            </Link>
          </p>
          <button
            type="button"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold transition-colors duration-200 text-sm"
            onClick={() => setShowForgotPassword(true)}
            disabled={loading}
          >
            Glömt lösenord?
          </button>
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