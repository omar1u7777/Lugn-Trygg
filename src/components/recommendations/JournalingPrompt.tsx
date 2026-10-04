import React, { useState } from 'react';
import { useJournaling } from '../../hooks/useJournaling';
import type { User } from '../../types/index';

interface JournalingPromptProps {
  onClose?: () => void;
  user?: User | null;
  announce?: (message: string, priority?: 'polite' | 'assertive') => void;
  onProgress?: (type: string, amount: number) => void;
}

export const JournalingPrompt: React.FC<JournalingPromptProps> = ({ onClose, user, announce, onProgress }) => {
  const [showJournalHistory, setShowJournalHistory] = useState(false);

  const {
    content: journalContent,
    setContent: setJournalContent,
    mood: journalMood,
    setMood: setJournalMood,
    tags: journalTags,
    setTags: setJournalTags,
    entries: journalEntries,
    isSaving: isSavingJournal,
    isLoading: isLoadingJournal,
    saveEntry: handleSaveJournalEntry,
    loadHistory: handleLoadJournalHistory
  } = useJournaling({
    user: user || null,
    announce: announce || (() => {}),
    onProgress: onProgress || (() => {})
  });

  return (
    <div className="bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-blue-200 dark:border-blue-800">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
        📝 Journaling för Mental Klarhet
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
        Skriv ner dina tankar för att skapa klarhet och få perspektiv på dina känslor.
      </p>

      {/* Journal Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Dina Tankar & Känslor
          </label>
          <textarea
            value={journalContent}
            onChange={(e) => setJournalContent(e.target.value)}
            placeholder="Skriv fritt om vad som händer i ditt liv just nu... Vad känner du? Vad tänker du? Vad har hänt idag?"
            className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isSavingJournal}
          />
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {journalContent.length} tecken
          </p>
        </div>

        {/* Mood Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Humör (valfritt)
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mood) => (
              <button
                key={mood}
                onClick={() => setJournalMood(journalMood === mood ? undefined : mood)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${journalMood === mood
                  ? 'bg-blue-500 text-white scale-110'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  } `}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Taggar (valfritt)
          </label>
          <div className="flex flex-wrap gap-2">
            {['stress', 'ångest', 'glädje', 'oro', 'tacksamhet', 'reflektion', 'mål', 'relationer'].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setJournalTags(prev =>
                    prev.includes(tag)
                      ? prev.filter(t => t !== tag)
                      : [...prev, tag]
                  );
                }}
                className={`px-3 py-1 rounded-full text-sm transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${journalTags.includes(tag)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  } `}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Journal History Toggle */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={async () => {
            setShowJournalHistory(!showJournalHistory);
            if (!showJournalHistory) {
              await handleLoadJournalHistory();
            }
          }}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <span>{showJournalHistory ? '▼' : '▶'}</span>
          {showJournalHistory ? 'Dölj tidigare anteckningar' : 'Visa tidigare anteckningar'}
          {journalEntries.length > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">
              {journalEntries.length}
            </span>
          )}
        </button>

        {showJournalHistory && (
          <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
            {isLoadingJournal ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Laddar journal...</p>
              </div>
            ) : journalEntries.length > 0 ? (
              journalEntries.map((entry) => (
                <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('sv-SE') : 'N/A'}
                    </span>
                    {entry.mood && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        Humör: {entry.mood}/10
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {entry.content}
                  </p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.map((tag: string) => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Inga tidigare journalanteckningar än.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={async () => await handleSaveJournalEntry()}
          disabled={!journalContent.trim() || isSavingJournal}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {isSavingJournal ? '💾 Sparar...' : '📝 Spara Journalanteckning'}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Stäng
        </button>
      </div>
    </div>
  );
};

export default JournalingPrompt;
