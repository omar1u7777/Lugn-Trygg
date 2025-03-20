import React, { useEffect, useState } from "react";
import { getMemories } from "../api/api";
import { useAuth } from "../contexts/AuthContext";

const MemoryList: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<{ id: string; audioUrl: string; timestamp?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !user.email) return;

    const fetchMemories = async () => {
      try {
        const memoryData = await getMemories(user.email);
        if (!memoryData || memoryData.length === 0) {
          setMemories([]);
        } else {
          setMemories(memoryData);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "❌ Ett fel uppstod vid hämtning av minnen.");
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [user]);

  // Funktion för att öppna ljudfilen i en ny flik
  const openInNewTab = (url: string) => {
    window.open(url, "_blank"); // Detta öppnar URL:en i en ny flik
  };

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">🎞 Dina Minnen</h3>

        {/* 🔴 Felmeddelande */}
        {error && (
          <div className="error-message">
            <p>❌ <strong>{error}</strong></p>
          </div>
        )}

        {/* 🔄 Laddningsindikator */}
        {loading ? (
          <p className="loading-message">🔄 Laddar...</p>
        ) : memories.length === 0 ? (
          <p className="info-message">⚠️ <em>Inga minnen sparade ännu.</em></p>
        ) : (
          <ul className="memory-list">
            {memories.map((memory) => {
              // Logga URL för varje minne
              console.log("Audio URL:", memory.audioUrl);

              return (
                <li key={memory.id} className="memory-item">
                  <div className="memory-content">
                    <p className="timestamp">📅 {memory.timestamp ? new Date(memory.timestamp).toLocaleString() : "Okänd tid"}</p>
                    <button onClick={() => openInNewTab(memory.audioUrl)}>Spela upp minne</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 🚪 Stäng-knapp */}
        <button className="close-btn" onClick={onClose}>❌ Stäng</button>
      </div>
    </div>
  );
};

export default MemoryList;
