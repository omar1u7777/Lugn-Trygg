import React, { useEffect, useState } from "react";
import { getMoods } from "../api/api";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useTranslation } from "react-i18next";
import { analytics } from "../services/analytics";
import { useAccessibility } from "../hooks/useAccessibility";
import { logger } from '../utils/logger';


const MoodList: React.FC<{ onClose?: () => void; inline?: boolean }> = ({ onClose, inline = false }) => {
  logger.debug('🗂️ MoodList component rendered with onClose:', typeof onClose);
  const { user } = useAuth();
  const { isPremium, plan } = useSubscription();
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  
  // History limit for free users (7 days)
  const historyDays = isPremium ? -1 : plan.limits.historyDays;
  
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
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    analytics.page('Mood List', {
      component: 'MoodList',
      userId: user?.user_id,
    });

    announceToScreenReader('Mood list loaded. Showing all your mood entries.', 'polite');
  }, [user?.user_id, announceToScreenReader]);

  useEffect(() => {
    if (!user) return;

    const fetchMoods = async () => {
      try {
        setLoading(true);
        setError(null);
        let moodData = await getMoods(user.user_id);

        // REAL SUBSCRIPTION LIMIT: Filter moods for free users (7 days only)
        if (historyDays > 0) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - historyDays);
          const originalCount = moodData.length;
          moodData = moodData.filter((mood: any) => {
            const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
            return moodDate >= cutoffDate;
          });
          logger.debug(`📋 MoodList - Filtered moods: ${originalCount} → ${moodData.length} (${historyDays} days limit)`);
        }

        // Sort by timestamp, newest first
        const sortedMoods = (moodData || []).sort((a: any, b: any) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return timeB - timeA;
        });

        setMoods(sortedMoods);

        analytics.track('Moods Loaded', {
          count: sortedMoods.length,
          component: 'MoodList',
          userId: user.user_id,
        });
      } catch (err: unknown) {
        logger.error("❌ Fel vid hämtning av humör:", err);
        const errorMessage = err instanceof Error ? err.message : "Ett fel uppstod vid hämtning av humörloggar.";
        setError(errorMessage);

        analytics.track('Mood Load Error', {
          error: errorMessage,
          component: 'MoodList',
          userId: user.user_id,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMoods();

    // Refresh moods every 30 seconds to show latest entries
    const interval = setInterval(fetchMoods, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Filter moods based on sentiment, search, and date range
  const filteredMoods = moods.filter(mood => {
    // Sentiment filter
    if (filter !== 'all') {
      const sentiment = (mood.sentiment || 'NEUTRAL').toUpperCase();
      if (filter === 'positive' && sentiment !== 'POSITIVE') return false;
      if (filter === 'negative' && sentiment !== 'NEGATIVE') return false;
      if (filter === 'neutral' && sentiment !== 'NEUTRAL') return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const moodText = (mood.mood_text || '').toLowerCase();
      const emotions = (mood.emotions_detected || []).join(' ').toLowerCase();
      if (!moodText.includes(searchLower) && !emotions.includes(searchLower)) {
        return false;
      }
    }

    // Date range filter
    if (dateRange !== 'all') {
      const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
      const now = new Date();
      const diffTime = now.getTime() - moodDate.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);

      if (dateRange === 'week' && diffDays > 7) return false;
      if (dateRange === 'month' && diffDays > 30) return false;
      if (dateRange === 'year' && diffDays > 365) return false;
    }

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

  const handleDeleteMood = async (moodId: string) => {
    if (!user?.user_id || !moodId) return;

    setDeleting(true);
    try {
      logger.debug('🗑️ Deleting mood:', moodId);

      // Import API function dynamically to avoid circular dependency
      const { api } = await import('../api/api');
      const { API_ENDPOINTS } = await import('../api/constants');

      // Make API call to delete the mood using axios (correct baseURL)
      const response = await api.delete(`${API_ENDPOINTS.MOOD.DELETE}/${moodId}`);

      logger.debug('✅ Mood deleted successfully:', response.data);

      // Remove the mood from local state
      setMoods(prevMoods => prevMoods.filter(mood => mood.id !== moodId));

      analytics.track('Mood Deleted', {
        moodId,
        component: 'MoodList',
        userId: user.user_id,
      });

      announceToScreenReader('Humör raderat framgångsrikt', 'polite');
    } catch (error: any) {
      logger.error('Failed to delete mood:', error);
      analytics.track('Mood Delete Failed', {
        moodId,
        error: error?.response?.data?.error || error?.message || 'Unknown error',
        component: 'MoodList',
        userId: user.user_id,
      });
      announceToScreenReader('Misslyckades att radera humör', 'assertive');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleExportMoods = async (format: 'csv' | 'json') => {
    if (!user?.user_id) return;

    setExporting(true);
    try {
      const dataToExport = filteredMoods.map(mood => ({
        date: formatTimestamp(mood.timestamp),
        mood: mood.mood_text,
        sentiment: mood.sentiment,
        score: mood.score,
        emotions: mood.emotions_detected?.join(', ') || '',
        timestamp: mood.timestamp?.toDate ? mood.timestamp.toDate().toISOString() : mood.timestamp,
      }));

      if (format === 'csv') {
        const csvContent = [
          ['Datum', 'Humör', 'Känsla', 'Poäng', 'Känslor', 'Timestamp'],
          ...dataToExport.map(row => [
            row.date,
            row.mood,
            row.sentiment || '',
            row.score?.toString() || '',
            row.emotions,
            row.timestamp
          ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mood-data-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } else {
        const jsonContent = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mood-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
      }

      analytics.track('Moods Exported', {
        format,
        count: dataToExport.length,
        component: 'MoodList',
        userId: user.user_id,
      });

      announceToScreenReader(`Humördata exporterad som ${format.toUpperCase()}`, 'polite');
    } catch (error) {
      logger.error('Failed to export moods:', error);
      announceToScreenReader('Misslyckades att exportera humördata', 'assertive');
    } finally {
      setExporting(false);
    }
  };

  // Calculate statistics
  const getMoodStats = () => {
    const total = filteredMoods.length;
    const positive = filteredMoods.filter(m => (m.sentiment || 'NEUTRAL').toUpperCase() === 'POSITIVE').length;
    const negative = filteredMoods.filter(m => (m.sentiment || 'NEUTRAL').toUpperCase() === 'NEGATIVE').length;
    const neutral = filteredMoods.filter(m => (m.sentiment || 'NEUTRAL').toUpperCase() === 'NEUTRAL').length;
    const avgScore = total > 0 ? filteredMoods.reduce((sum, m) => sum + (m.score || 0), 0) / total : 0;

    return { total, positive, negative, neutral, avgScore };
  };

  const stats = getMoodStats();

  return (
    <div className={inline ? "w-full" : "fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"}>
      {/* Invisible backdrop click area */}
      {!inline && (
        <div
          className="absolute inset-0"
          onClick={() => {
            logger.debug('🗂️ MoodList backdrop clicked - closing modal');
            onClose?.();
          }}
        />
      )}

      <div className={inline
        ? "bg-white dark:bg-slate-800 rounded-lg p-6 w-full"
        : "bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[85vh] flex flex-col relative z-10"
      }>
        {/* Free Tier History Limit Banner */}
        {!isPremium && historyDays > 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <span className="font-medium">Visar endast senaste {historyDays} dagars historik</span>
            </div>
            <a 
              href="/upgrade" 
              className="px-3 py-1 bg-white text-amber-600 font-bold rounded text-sm hover:bg-gray-100 transition-colors"
            >
              Lås upp allt
            </a>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <span className="text-2xl">📝</span>
            Dina Humörloggar
          </h3>

          {/* Close button */}
          {!inline && (
            <button
              className="w-12 h-12 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 text-xl font-bold"
              onClick={(e) => {
                e.stopPropagation(); // Prevent backdrop click
                logger.debug('🗂️ MoodList close button clicked directly');
                logger.debug('🗂️ Calling onClose function...');
                onClose?.();
                logger.debug('🗂️ onClose function called successfully');
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                logger.debug('🗂️ MoodList close button touch start');
              }}
              aria-label="Stäng"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6 flex-shrink-0">
          {/* Search */}
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Sök i humör, känslor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExportMoods('csv')}
                disabled={exporting || filteredMoods.length === 0}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? '⏳' : '📊'} CSV
              </button>
              <button
                onClick={() => handleExportMoods('json')}
                disabled={exporting || filteredMoods.length === 0}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? '⏳' : '📄'} JSON
              </button>
            </div>
          </div>

          {/* Date Range and Sentiment Filters */}
          <div className="flex gap-2 flex-wrap">
            {/* Date Range */}
            <div className="flex gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 self-center">Period:</span>
              <button
                onClick={() => setDateRange('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateRange === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Alla
              </button>
              <button
                onClick={() => setDateRange('week')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateRange === 'week'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                7 dagar
              </button>
              <button
                onClick={() => setDateRange('month')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateRange === 'month'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                30 dagar
              </button>
              <button
                onClick={() => setDateRange('year')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateRange === 'year'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                År
              </button>
            </div>
          </div>

          {/* Sentiment Filters */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 self-center">Känsla:</span>
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
              😊 Positiva ({stats.positive})
            </button>
            <button
              onClick={() => setFilter('negative')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filter === 'negative'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              😢 Negativa ({stats.negative})
            </button>
            <button
              onClick={() => setFilter('neutral')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filter === 'neutral'
                  ? 'bg-slate-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              😐 Neutrala ({stats.neutral})
            </button>
          </div>

          {/* Statistics */}
          {filteredMoods.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">📊 Statistik</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.total}</div>
                  <div className="text-slate-600 dark:text-slate-400">Totalt</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.positive}</div>
                  <div className="text-slate-600 dark:text-slate-400">Positiva</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.negative}</div>
                  <div className="text-slate-600 dark:text-slate-400">Negativa</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.avgScore.toFixed(1)}</div>
                  <div className="text-slate-600 dark:text-slate-400">Snittpoäng</div>
                </div>
              </div>
            </div>
          )}
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
          <div className="overflow-y-auto pr-2" style={inline ? {} : { flex: 1 }}>
            <div className="space-y-4">
              {filteredMoods.map((mood, index) => {
                // Get the best available mood text, handle encrypted data
                let displayMood = mood.mood_text || 'neutral';
                
                // Check if mood text is encrypted (starts with U2FsdGVk)
                if (displayMood.startsWith('U2FsdGVk')) {
                  // Fallback to score-based label if encrypted
                  const s = mood.score ?? 5;
                  if (s >= 8) displayMood = 'Glad';
                  else if (s >= 6) displayMood = 'Bra';
                  else if (s >= 4) displayMood = 'Neutral';
                  else if (s >= 2) displayMood = 'Orolig';
                  else displayMood = 'Ledsen';
                }
                
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTimestamp(mood.timestamp)}
                        </span>
                        <button
                          onClick={() => setShowDeleteConfirm(mood.id || index.toString())}
                          className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                          aria-label="Radera detta humör"
                          disabled={deleting}
                        >
                          🗑️
                        </button>
                      </div>
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
                            {Math.abs(score) > 1 ? `${Math.abs(score).toFixed(0)}%` : `${(Math.abs(score) * 100).toFixed(0)}%`}
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                🗑️ Radera humör?
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Är du säker på att du vill radera detta humör? Detta kan inte ångras.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleDeleteMood(showDeleteConfirm)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {deleting ? 'Raderar...' : 'Radera'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoodList;
