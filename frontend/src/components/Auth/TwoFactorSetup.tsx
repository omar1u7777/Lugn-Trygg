import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/api';

const TwoFactorSetup: React.FC = () => {
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEnable2FA = async () => {
    if (!user?.user_id) {
      setError('Användarinformation saknas');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Telefonnummer krävs');
      return;
    }

    // Basic validation for Swedish phone numbers
    const phoneRegex = /^\+46\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setError('Använd format: +46712345678');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/enable-2fa', {
        user_id: user.user_id,
        phone_number: phoneNumber
      });

      setSuccess(true);
      setPhoneNumber('');
    } catch (err: any) {
      console.error('2FA setup error:', err);
      setError(err.response?.data?.error || 'Kunde inte aktivera 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user?.user_id) {
      setError('Användarinformation saknas');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/auth/disable-2fa/${user.user_id}`);
      setSuccess(true);
    } catch (err: any) {
      console.error('2FA disable error:', err);
      setError(err.response?.data?.error || 'Kunde inte inaktivera 2FA');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="two-factor-setup success">
        <div className="setup-card">
          <h3>✅ Klart!</h3>
          <p>2FA-inställningarna har uppdaterats.</p>
          <button
            onClick={() => setSuccess(false)}
            className="setup-button"
          >
            Stäng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="two-factor-setup">
      <div className="setup-card">
        <h3>🔐 Tvåfaktorsautentisering (2FA)</h3>
        <p>
          Skydda ditt konto med SMS-koder. Du kommer att få en kod via SMS varje gång du loggar in.
        </p>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <div className="setup-form">
          <div className="form-group">
            <label htmlFor="phone-input">
              Telefonnummer (Svenskt format)
            </label>
            <input
              id="phone-input"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+46712345678"
              className="phone-input"
              aria-describedby="phone-help"
            />
            <small id="phone-help" className="help-text">
              Ange ditt telefonnummer i formatet +46XXXXXXXXX
            </small>
          </div>

          <div className="button-group">
            <button
              onClick={handleEnable2FA}
              disabled={loading || !phoneNumber.trim()}
              className="enable-button"
              aria-label="Aktivera 2FA med angivet telefonnummer"
            >
              {loading ? '⏳ Aktiverar...' : '📱 Aktivera 2FA'}
            </button>

            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className="disable-button"
              aria-label="Inaktivera 2FA"
            >
              {loading ? '⏳ Inaktiverar...' : '🚫 Inaktivera 2FA'}
            </button>
          </div>
        </div>

        <div className="info-box">
          <h4>📋 Vad händer när 2FA är aktiverat?</h4>
          <ul>
            <li>Du får en SMS-kod vid varje inloggning</li>
            <li>Koden är giltig i 5 minuter</li>
            <li>Du kan när som helst inaktivera 2FA</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;