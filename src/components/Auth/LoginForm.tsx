import { useState, useEffect } from "react"
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { Link } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Box, Typography, IconButton, Divider, Alert } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { loginUser, api } from "../../api/api";
import { useAuth } from "../../contexts/AuthContext";
import { auth as firebaseAuth } from "../../firebase-config";
import ForgotPassword from "./ForgotPassword";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../LoadingStates";
import { useAccessibility } from "../../hooks/useAccessibility";
import AccessibleDialog from "../Accessibility/AccessibleDialog";
import { ScreenReaderAnnouncer } from "../Accessibility/ScreenReader";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login } = useAuth();
  const { announceToScreenReader } = useAccessibility();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    announceToScreenReader("Loggar in...", "polite");

    try {
      const data = await loginUser(email, password);
      login(data.access_token, email, data.user_id);
      announceToScreenReader("Inloggning lyckades", "polite");
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      announceToScreenReader(`Inloggning misslyckades: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    announceToScreenReader("Loggar in med Google...", "polite");

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
      // Note: baseURL is http://localhost:54112, blueprint is /api/auth, so full path is /api/auth/google-login
      const response = await api.post('/api/auth/google-login', {
        id_token: idToken
      });

      const data = response.data;
      login(data.access_token, user.email!, data.user_id);
      announceToScreenReader("Google-inloggning lyckades", "polite");
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Google-inloggning misslyckades';
      setError(errorMessage);
      announceToScreenReader(`Google-inloggning misslyckades: ${errorMessage}`, "assertive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 6,
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)"
            : "linear-gradient(135deg, #eff6ff 0%, colors.text.inverse 50%, #faf5ff 100%)",
      }}
      role="main"
      aria-labelledby="login-title"
    >
      <Card sx={{ width: "100%", maxWidth: "md" }} elevation={3}>
        <Box sx={{ textAlign: "center", mb: spacing.xl }}>
          <Typography
            id="login-title"
            variant="h4"
            fontWeight="bold"
            color="text.primary"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
            }}
          >
            <Box component="span" sx={{ fontSize: "1.5rem" }} aria-hidden="true">
              🔐
            </Box>
            Logga in
          </Typography>
        </Box>

        {error && (
          <Alert
            id="login-error"
            severity="error"
            role="alert"
            aria-live="assertive"
            sx={{ mb: spacing.lg }}
            icon={<span style={{ fontSize: "1.125rem" }}>⚠️</span>}
          >
            {error}
          </Alert>
        )}

        <LoadingSpinner isLoading={loading} message="Loggar in...">
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
            role="form"
            aria-labelledby="login-title"
          >
            <div>
              <Input
                label="📧 E-postadress"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ange din e-postadress"
                required
                disabled={loading}
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={!!error}
              />
            </div>

            <div>
              <Typography
                component="label"
                htmlFor="password"
                variant="body2"
                fontWeight="medium"
                color="text.primary"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                  mb: spacing.sm,
                }}
              >
                <Box component="span" sx={{ color: "primary.main" }} aria-hidden="true">
                  🔒
                </Box>
                Lösenord
              </Typography>
              <Box sx={{ position: "relative" }}>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ange ditt lösenord"
                  required
                  disabled={loading}
                  sx={{ pr: 6 }}
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={!!error}
                />
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  title={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                  aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                  aria-pressed={showPassword}
                  sx={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </Box>
            </div>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              <i className="fas fa-sign-in-alt mr-2"></i>
              Logga in
            </Button>
          </Box>
        </LoadingSpinner>

        <Divider sx={{ my: 4 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            eller
          </Typography>
        </Divider>

        <Button
          variant="outlined"
          fullWidth
          onClick={handleGoogleSignIn}
          disabled={loading}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
          }}
        >
          <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Fortsätt med Google
        </Button>

        <Box sx={{ mt: spacing.xl, textAlign: "center", display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <Typography variant="body2" color="text.secondary">
            Har du inget konto?{" "}
            <Typography
              component={Link}
              to="/register"
              variant="body2"
              color="primary"
              fontWeight="semibold"
              sx={{
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
              aria-label="Gå till registreringssidan"
            >
              Registrera dig här
            </Typography>
          </Typography>
          <Typography
            component="button"
            variant="body2"
            color="primary"
            fontWeight="semibold"
            onClick={() => setShowForgotPassword(true)}
            disabled={loading}
            aria-label="Öppna glömt lösenord-dialog"
            aria-haspopup="dialog"
            sx={{
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Glömt lösenord?
          </Typography>
        </Box>
      </Card>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
          onSuccess={() => setShowForgotPassword(false)}
        />
      )}
    </Box>
  );
};

export default LoginForm;