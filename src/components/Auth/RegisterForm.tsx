import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Box, Typography, IconButton, Alert, TextField } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
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
      console.error("Registration error:", err);
      setError(err.response?.data?.error || err.message);
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
            : "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #faf5ff 100%)",
      }}
      role="main"
      aria-labelledby="register-title"
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "md",
          bgcolor: "background.paper",
          borderRadius: 4,
          boxShadow: 6,
          p: 4,
          border: 1,
          borderColor: "divider",
        }}
      >
        <Box component="header">
          <Typography
            id="register-title"
            variant="h4"
            fontWeight="bold"
            textAlign="center"
            color="text.primary"
            sx={{
              mb: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
            }}
          >
            <Box component="span" sx={{ fontSize: "1.5rem" }} aria-hidden="true">
              👤
            </Box>
            Skapa konto
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            role="alert"
            aria-live="assertive"
            id="register-error"
            sx={{ mb: 3 }}
            icon={<span style={{ fontSize: "1.125rem" }}>⚠️</span>}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            role="status"
            aria-live="polite"
            id="register-success"
            sx={{ mb: 3 }}
            icon={<span style={{ fontSize: "1.125rem" }}>✅</span>}
          >
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }} noValidate>
          <div>
            <Typography
              component="label"
              htmlFor="name"
              variant="body2"
              fontWeight="medium"
              color="text.primary"
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
            >
              <Box component="span" sx={{ color: "primary.main" }} aria-hidden="true">
                👤
              </Box>
              Namn
            </Typography>
            <TextField
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ange ditt namn"
              required
              disabled={loading}
              fullWidth
              inputProps={{
                "aria-describedby": error ? "register-error" : undefined,
                "aria-invalid": !!error,
              }}
            />
          </div>

          <div>
            <Typography
              component="label"
              htmlFor="email"
              variant="body2"
              fontWeight="medium"
              color="text.primary"
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
            >
              <Box component="span" sx={{ color: "primary.main" }} aria-hidden="true">
                📧
              </Box>
              E-postadress
            </Typography>
            <TextField
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ange din e-postadress"
              required
              disabled={loading}
              fullWidth
              inputProps={{
                "aria-describedby": error ? "register-error" : undefined,
                "aria-invalid": !!error,
              }}
            />
          </div>

          {/* Referral Code Input */}
          {referralCode && (
            <Alert
              severity="success"
              role="status"
              aria-live="polite"
              icon={<span style={{ fontSize: "1.5rem" }}>🎁</span>}
              sx={{
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "success.dark" : "success.light",
              }}
            >
              <Typography variant="body2" fontWeight="semibold" gutterBottom>
                Referenskod aktiv!
              </Typography>
              <Typography variant="caption" display="block" gutterBottom>
                Du och din vän får båda 1 vecka gratis premium! 🎉
              </Typography>
              <Typography variant="caption" fontWeight="medium" sx={{ mt: 1.5, display: "block" }}>
                Kod: <Box component="span" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>{referralCode}</Box>
              </Typography>
            </Alert>
          )}

          <div>
            <Typography
              component="label"
              htmlFor="password"
              variant="body2"
              fontWeight="medium"
              color="text.primary"
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
            >
              <Box component="span" sx={{ color: "primary.main" }} aria-hidden="true">
                🔒
              </Box>
              Lösenord
            </Typography>
            <Box sx={{ position: "relative" }}>
              <TextField
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Skapa ett starkt lösenord"
                required
                disabled={loading}
                fullWidth
                inputProps={{
                  "aria-describedby": error ? "register-error" : "password-help",
                  "aria-invalid": !!error,
                }}
                sx={{ pr: 6 }}
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
            <Typography id="password-help" variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Minst 8 tecken, en stor bokstav, en liten bokstav, en siffra och ett specialtecken.
            </Typography>
          </div>

          <div>
            <Typography
              component="label"
              htmlFor="confirmPassword"
              variant="body2"
              fontWeight="medium"
              color="text.primary"
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
            >
              <Box component="span" sx={{ color: "primary.main" }} aria-hidden="true">
                🔒
              </Box>
              Bekräfta lösenord
            </Typography>
            <Box sx={{ position: "relative" }}>
              <TextField
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Bekräfta ditt lösenord"
                required
                disabled={loading}
                fullWidth
                inputProps={{
                  "aria-describedby": error ? "register-error" : undefined,
                  "aria-invalid": !!error,
                }}
                sx={{ pr: 6 }}
              />
              <IconButton
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                title={showConfirmPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-label={showConfirmPassword ? "Dölj lösenord" : "Visa lösenord"}
                aria-pressed={showConfirmPassword}
                sx={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Box>
          </div>

          <Box
            component="button"
            type="submit"
            disabled={loading}
            sx={{
              width: "100%",
              py: 1.5,
              fontSize: "1.125rem",
              fontWeight: "semibold",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              border: "none",
              borderRadius: 1,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: loading ? "primary.main" : "primary.dark",
              },
              "&:disabled": {
                cursor: "not-allowed",
              },
            }}
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
          </Box>
        </Box>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Har du redan ett konto?{" "}
            <Typography
              component={Link}
              to="/login"
              variant="body2"
              color="primary"
              fontWeight="semibold"
              sx={{
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
              aria-label="Gå till inloggningssidan"
            >
              Logga in här
            </Typography>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default RegisterForm;