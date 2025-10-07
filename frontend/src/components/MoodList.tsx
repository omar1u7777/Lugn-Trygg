import React, { useEffect, useState } from "react";
import { getMoods } from "../api/api";
import { useAuth } from "../contexts/AuthContext";

const MoodList: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [moods, setMoods] = useState<{ mood: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMoods = async () => {
      try {
        const moodData = await getMoods(user.user_id);
        setMoods(moodData);
      } catch (err: any) {
        setError(err.response?.data?.error || "❌ Ett fel uppstod vid hämtning av humörloggar.");
      } finally {
        setLoading(false);
      }
    };

    fetchMoods();
  }, [user]);

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">📋 Dina Humörloggar</h3>

        {/* 🔴 Felmeddelande vid misslyckad hämtning */}
        {error && (
          <div className="error-message">
            <p>❌ <strong>{error}</strong></p>
          </div>
        )}

        {/* 🔄 Laddningsindikator */}
        {loading ? (
          <p className="loading-message">🔄 Laddar...</p>
        ) : moods.length === 0 ? (
          <p className="info-message">⚠️ <em>Inga humörloggar hittades.</em></p>
        ) : (
          <ul className="mood-list">
            {moods.map((mood, index) => (
              <li key={index} className="mood-item">
                <h3 className="mood-text">📝 {mood.mood}</h3>
                <p className="timestamp">📅 {new Date(mood.timestamp).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}

        {/* 🚪 Stäng-knapp (Fixad, endast EN ruta och knapp) */}
        <button className="close-btn" onClick={onClose}>❌ Stäng</button>
      </div>
    </div>
  );
};

export default MoodList;
