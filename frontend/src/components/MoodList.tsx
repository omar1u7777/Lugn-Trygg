import React, { useEffect, useState } from "react";
import { getMoods } from "../api/api";
import { useAuth } from "../contexts/AuthContext";

const MoodList: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [moods, setMoods] = useState<{ mood: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch mood logs when user data is available
  useEffect(() => {
    if (!user) return;

    const fetchMoods = async () => {
      try {
        // Fetch moods from the API
        const moodData = await getMoods(user.email);
        setMoods(moodData);  // Update state with fetched moods
      } catch (err: any) {
        // General error handling
        setError(err?.response?.data?.error || "❌ Ett fel uppstod vid hämtning av humörloggar.");
      } finally {
        setLoading(false);
      }
    };

    fetchMoods();  // Initiating the fetch process
  }, [user]);  // Re-run the effect when the user data changes

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">📋 Dina Humörloggar</h3>

        {/* 🔴 Error message if the API request fails */}
        {error && (
          <div className="error-message">
            <p>❌ <strong>{error}</strong></p>
          </div>
        )}

        {/* 🔄 Show loading state while fetching data */}
        {loading ? (
          <p className="loading-message">🔄 Laddar...</p>
        ) : moods.length === 0 ? (
          // Display if no mood logs are found
          <p className="info-message">⚠️ <em>Inga humörloggar hittades.</em></p>
        ) : (
          // Display the list of moods
          <ul className="mood-list">
            {moods.map((mood, index) => (
              <li key={index} className="mood-item">
                <h3 className="mood-text">📝 {mood.mood}</h3>
                <p className="timestamp">📅 {new Date(mood.timestamp).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}

        {/* 🚪 Close button */}
        <button className="close-btn" onClick={onClose}>❌ Stäng</button>
      </div>
    </div>
  );
};

export default MoodList;
