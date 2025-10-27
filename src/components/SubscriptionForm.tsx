import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/api';

const SubscriptionForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!user?.user_id || !user?.email) {
      setError('Användarinformation saknas');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/subscription/create-session', {
        user_id: user.user_id,
        email: user.email
      });

      // Redirect to Stripe Checkout
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        setError('Kunde inte skapa betalningssession');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.response?.data?.error || 'Ett fel uppstod vid prenumeration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-form">
      <div className="subscription-card">
        <h3>💎 Uppgradera till Premium</h3>
        <div className="pricing">
          <div className="price">99 SEK<span className="period">/månad</span></div>
        </div>

        <div className="features">
          <h4>Premium-funktioner:</h4>
          <ul>
            <li>✅ Obegränsade minnen</li>
            <li>✅ Avancerade AI-insikter</li>
            <li>✅ CBT-övningar och mindfulness</li>
            <li>✅ Detaljerade analysdiagram</li>
            <li>✅ Prioriterad support</li>
          </ul>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="subscribe-button"
          aria-label="Uppgradera till premiumprenumeration för 99 kronor per månad"
        >
          {loading ? '⏳ Bearbetar...' : '🚀 Uppgradera Nu'}
        </button>

        <p className="disclaimer">
          Du kan när som helst avbryta prenumerationen. Ingen bindningstid.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionForm;