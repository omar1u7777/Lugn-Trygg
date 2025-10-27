import React, { useEffect, useState } from "react";
import { getMoods } from "../api/api";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

const MoodList: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [moods, setMoods] = useState<{
    id?: string;
    mood_text: string;
    timestamp: string | any;
    sentiment?: string;
    score?: number;
    emotions_detected?: string[];
    sentiment_analysis?: any;
    voice_analysis?: any;
    ai_analysis?: any;
  }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  useEffect(() => {
    if (!user) return;

    const fetchMoods = async () => {
      try {
        setLoading(true);
        setError(null);
        const moodData = await getMoods(user.user_id);
        console.log("📊 Hämtade humördata:", moodData);
        
        // Sort by timestamp, newest first
        const sortedMoods = (moodData || []).sort((a: any, b: any) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return timeB - timeA;
        });
        
        setMoods(sortedMoods);
      } catch (err: any) {
        console.error("❌ Fel vid hämtning av humör:", err);
        setError(err.message || "Ett fel uppstod vid hämtning av humörloggar.");
      } finally {
        setLoading(false);
      }
    };

    fetchMoods();

    // Refresh moods every 30 seconds to show latest entries
    const interval = setInterval(fetchMoods, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Filter moods based on sentiment
  const filteredMoods = moods.filter(mood => {
    if (filter === 'all') return true;
    const sentiment = (mood.sentiment || 'NEUTRAL').toUpperCase();
    if (filter === 'positive') return sentiment === 'POSITIVE';
    if (filter === 'negative') return sentiment === 'NEGATIVE';
    if (filter === 'neutral') return sentiment === 'NEUTRAL';
    return true;
  });

  // Format timestamp to readable format
  const formatTimestamp = (timestamp: any) => {
    try {
      // Handle Firestore Timestamp objects
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'Okänt datum';
      
      // Format as "DD MMM YYYY, HH:MM"
      return new Intl.DateTimeFormat('sv-SE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'Okänt datum';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <span className="text-2xl">📝</span>
            Dina Humörloggar
          </h3>
          
          {/* Close button */}
          <button
            className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-6 flex-shrink-0 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'all'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Alla ({moods.length})
          </button>
          <button
            onClick={() => setFilter('positive')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'positive'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            😊 Positiva
          </button>
          <button
            onClick={() => setFilter('negative')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'negative'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            😢 Negativa
          </button>
          <button
            onClick={() => setFilter('neutral')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'neutral'
                ? 'bg-slate-500 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            😐 Neutrala
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex-shrink-0">
            <p className="text-red-800 dark:text-red-300 font-medium">
              <span className="text-lg mr-2">❌</span>
              <strong>{error}</strong>
            </p>
          </div>
        )}

        {/* Loading indicator */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 text-lg">Laddar humörloggar...</p>
            </div>
          </div>
        ) : filteredMoods.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl mb-4 block">📭</span>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                {filter === 'all' 
                  ? 'Inga humörloggar hittades. Börja logga ditt humör idag!'
                  : `Inga ${filter === 'positive' ? 'positiva' : filter === 'negative' ? 'negativa' : 'neutrala'} humörloggar hittades.`
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4">
              {filteredMoods.map((mood, index) => {
                // Get the best available mood text
                const displayMood = mood.mood_text || 'neutral';
                const sentiment = (mood.sentiment || 'NEUTRAL').toUpperCase();
                const score = mood.score ?? 0;
                
                // Get emotions from either source
                const analysis = mood.sentiment_analysis || mood.voice_analysis || mood.ai_analysis || {};
                const emotions = mood.emotions_detected || analysis.emotions || [];

                // Format sentiment for display
                const sentimentEmoji = {
                  'POSITIVE': '😊',
                  'NEGATIVE': '😢',
                  'NEUTRAL': '😐'
                }[sentiment] || '😐';

                const sentimentText = {
                  'POSITIVE': 'Positiv',
                  'NEGATIVE': 'Negativ',
                  'NEUTRAL': 'Neutral'
                }[sentiment] || sentiment;

                const sentimentColor = {
                  'POSITIVE': 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
                  'NEGATIVE': 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
                  'NEUTRAL': 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
                }[sentiment] || 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700';

                return (
                  <div 
                    key={mood.id || index} 
                    className={`rounded-lg p-5 border-2 transition-all duration-200 hover:shadow-md ${sentimentColor}`}
                  >
                    {/* Mood Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="text-2xl">{sentimentEmoji}</span>
                        {displayMood.charAt(0).toUpperCase() + displayMood.slice(1)}
                      </h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatTimestamp(mood.timestamp)}
                      </span>
                    </div>

                    {/* Sentiment Info */}
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Känsla:
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {sentimentText}
                        </span>
                      </div>
                      
                      {score !== 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Styrka:
                          </span>
                          <span className={`text-sm font-semibold px-2 py-1 rounded ${
                            score > 0 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : score < 0
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {(Math.abs(score) * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Emotions */}
                    {emotions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Identifierade känslor:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {emotions.map((emotion: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium"
                            >
                              {emotion}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoodList;
