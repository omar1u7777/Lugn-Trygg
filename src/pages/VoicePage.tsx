import React from 'react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';

export const VoicePage: React.FC = () => {
  const navigate = useNavigate();

  const handleTranscriptComplete = (transcript: string, emotion?: string) => {
    logger.debug('Transcript received', { transcript });
    logger.debug('Emotion detected', { emotion });
    // You can save to journal, mood log, etc.
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 mb-4 inline-flex items-center"
          >
            <span className="mr-2">←</span>
            Tillbaka
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Röstinspelning & Analys
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Spela in din röst för automatisk transkribering och känsloanalys
          </p>
        </div>

        {/* Voice Recorder */}
        <VoiceRecorder
          onTranscriptComplete={handleTranscriptComplete}
          maxDuration={10000}
          autoAnalyzeEmotion={true}
        />

        {/* Feature Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="text-4xl mb-3">🎤</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Rösttranskribering
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Konvertera din röst till text med Google Cloud Speech-to-Text API
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="text-4xl mb-3">🎭</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Känsloanalys
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analysera känslor baserat på röstton, energi och innehåll
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Röstegenskaper
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analysera energinivå, talhastighet och volymvariation
            </p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-12 bg-teal-50 dark:bg-teal-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            💡 Användningsområden
          </h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="mr-2">📝</span>
              <span>Snabb journalföring - tala istället för att skriva</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">😊</span>
              <span>Humörspårning - identifiera känslor automatiskt</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">🧘</span>
              <span>Mindfulness - reflektera över din röst och känsloläge</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">📈</span>
              <span>Trendanalys - spåra känslomönster över tid</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoicePage;
