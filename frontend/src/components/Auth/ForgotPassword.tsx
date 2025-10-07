import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth as firebaseAuth } from "../../firebase-config";

interface ForgotPasswordProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setMessage("Återställningslänk har skickats till din e-postadress!");
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError("Ingen användare hittades med denna e-postadress.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Ogiltig e-postadress.");
      } else {
        setError("Ett fel uppstod. Försök igen senare.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-container">
      <div className="popup-container">
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        <div className="popup-title">
          <i className="fas fa-key"></i>
          Återställ Lösenord
        </div>

        {message && (
          <div className="success-message">
            <i className="fas fa-check-circle"></i>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-email" className="form-label">
              <i className="fas fa-envelope"></i> E-postadress
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="Ange din e-postadress"
              required
              disabled={loading}
            />
            <small className="password-hint">
              Vi skickar en återställningslänk till denna adress
            </small>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Skickar...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i> Skicka Återställningslänk
              </>
            )}
          </button>
        </form>

        <div className="auth-links" style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            className="forgot-password-link"
            onClick={onClose}
            disabled={loading}
          >
            Tillbaka till inloggning
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;