import React, { useEffect, useState } from "react";
import { getMemories, getMemoryUrl } from "../api/api";
import { useAuth } from "../contexts/AuthContext";
import { logger } from '../utils/logger';


const parseTimestamp = (timestamp: string): Date | null => {
  if (!timestamp || timestamp.length !== 14) return null;
  const year = parseInt(timestamp.substring(0, 4));
  const month = parseInt(timestamp.substring(4, 6)) - 1; // JS months are 0-based
  const day = parseInt(timestamp.substring(6, 8));
  const hour = parseInt(timestamp.substring(8, 10));
  const minute = parseInt(timestamp.substring(10, 12));
  const second = parseInt(timestamp.substring(12, 14));

  // Create date in UTC first, then convert to local timezone
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
  return utcDate;
};

const MemoryList: React.FC<{ onClose?: () => void; inline?: boolean }> = ({ onClose, inline = false }) => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<{ id: string; title: string; audioUrl: string; timestamp?: string; date?: Date; filePath?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.user_id) return;

    const fetchMemories = async () => {
      try {
        const memoryData = await getMemories(user.user_id);
        // Don't fetch signed URLs immediately to avoid rate limiting
        const memoriesWithoutUrls = memoryData.map((mem: any) => {
          const date = parseTimestamp(mem.timestamp);
          return { id: mem.id, title: `Minne ${mem.timestamp}`, audioUrl: "", timestamp: mem.timestamp, date, filePath: mem.file_path };
        });
        setMemories(memoriesWithoutUrls);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
          ? String(err.response.data.error)
          : "❌ Ett fel uppstod vid hämtning av minnen.";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [user]);

  return (
    <div className={inline ? "w-full" : "fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"}>
      <div className={inline
        ? "bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-h-[70vh] flex flex-col"
        : "bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[80vh] flex flex-col"
      }>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3 flex-shrink-0">
          <span className="text-2xl">💭</span>
          Dina Minnen
        </h3>

        {/* 🔴 Felmeddelande */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex-shrink-0">
            <p className="text-red-800 dark:text-red-300 font-medium">
              <span className="text-lg mr-2">❌</span>
              <strong>{error}</strong>
            </p>
          </div>
        )}

        {/* 🔄 Laddningsindikator */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-600 dark:text-slate-400 text-lg">🔄 Laddar...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-600 dark:text-slate-400 text-lg">⚠️ <em>Inga minnen sparade ännu.</em></p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-4">
              {memories.map((memory) => (
                <li key={memory.id} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                  <div className="memory-content">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">📌 {memory.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">📅 {memory.date ? memory.date.toLocaleString('sv-SE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    }) : "Okänd tid"}</p>
                    {memory.audioUrl ? (
                      <audio controls className="w-full">
                        <source src={memory.audioUrl} type="audio/mpeg" />
                        Din webbläsare stöder inte uppspelning av ljud.
                      </audio>
                    ) : memory.filePath ? (
                      <button
                        onClick={async () => {
                          try {
                            const url = await getMemoryUrl(memory.id);
                            setMemories(prev => prev.map(m =>
                              m.id === memory.id ? { ...m, audioUrl: url } : m
                            ));
                          } catch (err) {
                            logger.error("Failed to load audio URL:", err);
                          }
                        }}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        🎵 Ladda ljud
                      </button>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">🎵 Ljudfilen kunde inte laddas.</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 🚪 Stäng-knapp */}
        {!inline && (
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg flex-shrink-0"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default MemoryList;
