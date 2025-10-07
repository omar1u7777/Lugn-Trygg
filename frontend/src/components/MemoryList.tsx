import React, { useEffect, useState } from "react";
import { getMemories, getMemoryUrl } from "../api/api";
import { useAuth } from "../contexts/AuthContext";

const parseTimestamp = (timestamp: string): Date | null => {
  if (!timestamp || timestamp.length !== 14) return null;
  const year = parseInt(timestamp.substring(0, 4));
  const month = parseInt(timestamp.substring(4, 6)) - 1; // JS months are 0-based
  const day = parseInt(timestamp.substring(6, 8));
  const hour = parseInt(timestamp.substring(8, 10));
  const minute = parseInt(timestamp.substring(10, 12));
  const second = parseInt(timestamp.substring(12, 14));
  return new Date(year, month, day, hour, minute, second);
};

const MemoryList: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<{ id: string; title: string; audioUrl: string; timestamp?: string; date?: Date }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.user_id) return;

    const fetchMemories = async () => {
      try {
        const memoryData = await getMemories(user.user_id);
        // Fetch signed URLs for each memory
        const memoriesWithUrls = await Promise.all(
          memoryData.map(async (mem: any) => {
            try {
              const url = await getMemoryUrl(user.user_id, mem.file_path);
              const date = parseTimestamp(mem.timestamp);
              return { id: mem.id, title: `Minne ${mem.timestamp}`, audioUrl: url, timestamp: mem.timestamp, date };
            } catch {
              const date = parseTimestamp(mem.timestamp);
              return { id: mem.id, title: `Minne ${mem.timestamp}`, audioUrl: "", timestamp: mem.timestamp, date };
            }
          })
        );
        setMemories(memoriesWithUrls);
      } catch (err: any) {
        setError(err.response?.data?.error || "❌ Ett fel uppstod vid hämtning av minnen.");
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [user]);

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
            {memories.map((memory) => (
              <li key={memory.id} className="memory-item">
                <div className="memory-content">
                  <h3 className="memory-title">📌 {memory.title}</h3>
                  <p className="timestamp">📅 {memory.date ? memory.date.toLocaleString() : "Okänd tid"}</p>
                  {memory.audioUrl ? (
                    <audio controls className="audio-player">
                      <source src={memory.audioUrl} type="audio/mpeg" />
                      Din webbläsare stöder inte uppspelning av ljud.
                    </audio>
                  ) : (
                    <p className="audio-error">🎵 Ljudfilen kunde inte laddas.</p>
                  )}
                </div>
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

export default MemoryList;
