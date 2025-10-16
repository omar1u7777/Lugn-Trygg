import React, { useEffect, useState } from "react";
import { getMoods } from "../api/api";
import { useAuth } from "../contexts/AuthContext";

const MoodList: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [moods, setMoods] = useState<{ mood_text: string; timestamp: string; sentiment?: string; score?: number }[]>([]);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[80vh] flex flex-col">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3 flex-shrink-0">
          <span className="text-2xl">📝</span>
          Dina Humörloggar
        </h3>

        {/* 🔴 Felmeddelande vid misslyckad hämtning */}
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
        ) : moods.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-600 dark:text-slate-400 text-lg">⚠️ <em>Inga humörloggar hittades.</em></p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-4">
              {moods.map((mood, index) => (
                <li key={index} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">📝 {mood.mood_text || 'Ingen text'}</h3>
                  {mood.sentiment && (
                    <p className="text-slate-700 dark:text-slate-300 mb-2">
                      😊 Sentiment: {mood.sentiment}
                      {mood.score !== undefined && ` (${(mood.score * 100).toFixed(0)}%)`}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-400">📅 {new Date(mood.timestamp).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 🚪 Stäng-knapp */}
        <button
          className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg flex-shrink-0"
          onClick={onClose}
          aria-label="Stäng"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default MoodList;
