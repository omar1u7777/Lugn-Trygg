import React, { useState, useEffect } from 'react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import { saveJournalEntry } from '../api/journaling';
import { getVoiceRecordings, VoiceRecording } from '../api/voice';
import { logMood } from '../api/api';
import { saveMeditationSession } from '../api/meditation';
import useAuth from '../hooks/useAuth';

// Emotion to mood score mapping (same as in SuperMoodLogger)
const voiceEmotionToMoodScore = (emotion: string): number => {
  const emotionMap: { [key: string]: number } = {
    happy: 9,
    sad: 3,
    anxious: 4,
    angry: 2,
    calm: 7,
    neutral: 5,
    tired: 3,
  };
  return emotionMap[emotion] || 5;
};

const emotionEmojis: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  anxious: '😰',
  angry: '😠',
  calm: '😌',
  neutral: '😐',
  tired: '😴',
};

export const VoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [voiceHistory, setVoiceHistory] = useState<VoiceRecording[]>([]);
  const [integrationSettings, setIntegrationSettings] = useState({
    saveToJournal: true,
    logMood: true,
    saveMindfulness: true,
  });

  const handleTranscriptComplete = async (transcript: string, emotion?: string, audioDurationMs?: number) => {
    logger.debug('Transcript received', { transcript });
    logger.debug('Emotion detected', { emotion });

    if (user?.user_id && transcript) {
      // Auto-save to journal
      if (integrationSettings.saveToJournal) {
        try {
          await saveJournalEntry(
            user.user_id,
            transcript,
            undefined,
            emotion ? [emotion] : undefined
          );
          logger.info('Voice transcript saved to journal');
        } catch (error) {
          logger.error('Failed to save transcript to journal:', error);
        }
      }

      // Auto-log mood from voice emotion
      if (emotion && integrationSettings.logMood) {
        const moodScore = voiceEmotionToMoodScore(emotion);
        try {
          await logMood(user.user_id, {
            score: moodScore,
            mood_text: emotion,
            note: transcript,
            tags: [emotion],
          });
          logger.info('Voice emotion logged as mood', { emotion, moodScore });
        } catch (error) {
          logger.error('Failed to log mood from voice emotion:', error);
        }

        // Save as mindfulness/meditation session
        if (integrationSettings.saveMindfulness) {
          try {
            await saveMeditationSession({
              type: 'voice_reflection',
              duration: Math.round((audioDurationMs || 0) / 1000),
              technique: 'voice_mindfulness',
              moodBefore: moodScore,
              moodAfter: moodScore,
              notes: transcript,
            });
            logger.info('Voice recording saved as mindfulness session');
          } catch (error) {
            logger.error('Failed to save mindfulness session:', error);
          }
        }
      }
    }
  };

  // Load voice recordings history
  useEffect(() => {
    const loadVoiceHistory = async () => {
      if (user?.user_id) {
        try {
          const data = await getVoiceRecordings(20);
          setVoiceHistory(data.recordings);
        } catch (error) {
          logger.error('Failed to load voice history:', error);
        }
      }
    };

    loadVoiceHistory();
  }, [user?.user_id]);

  // Calculate stats
  const todayRecordings = voiceHistory.filter(rec => {
    const recDate = new Date(rec.created_at * 1000);
    const today = new Date();
    return recDate.toDateString() === today.toDateString();
  }).length;

  const lastEmotion = voiceHistory.length > 0 ? voiceHistory[0].primary_emotion : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
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

        {/* Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{todayRecordings}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Inspelningar idag</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="text-2xl">
              {lastEmotion ? emotionEmojis[lastEmotion] || '🎭' : '—'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Senaste känsla</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{voiceHistory.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Totalt inspelningar</div>
          </div>
        </div>

        {/* Integration Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Automatisk integration
          </h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={integrationSettings.saveToJournal}
                onChange={(e) => setIntegrationSettings(prev => ({ ...prev, saveToJournal: e.target.checked }))}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">📝 Spara till journal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={integrationSettings.logMood}
                onChange={(e) => setIntegrationSettings(prev => ({ ...prev, logMood: e.target.checked }))}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">😊 Logga humör</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={integrationSettings.saveMindfulness}
                onChange={(e) => setIntegrationSettings(prev => ({ ...prev, saveMindfulness: e.target.checked }))}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">🧘 Mindfulness session</span>
            </label>
          </div>
        </div>

        {/* Voice Recorder */}
        <VoiceRecorder
          onTranscriptComplete={handleTranscriptComplete}
          maxDuration={10000}
          autoAnalyzeEmotion={true}
        />

        {/* Voice History & Trend Analysis */}
        {voiceHistory.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📈 Röstinspelningar & Trendanalys
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              {/* Emotion Trend Summary */}
              <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Känslotrend (senaste {voiceHistory.length} inspelningar)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const emotionCounts = voiceHistory.reduce((acc, rec) => {
                      const emotion = rec.primary_emotion || 'neutral';
                      acc[emotion] = (acc[emotion] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    return Object.entries(emotionCounts).map(([emotion, count]) => (
                      <span key={emotion} className="text-sm bg-white dark:bg-gray-700 px-3 py-1 rounded-full">
                        {emotionEmojis[emotion] || '🎭'} {emotion}: {count}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Voice History List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {voiceHistory.map((recording) => (
                  <div key={recording.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {emotionEmojis[recording.primary_emotion] || '🎭'}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {recording.primary_emotion || 'Okänd'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(recording.created_at * 1000).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      "{recording.transcript}"
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>⚡ {recording.energy_level}</span>
                      <span>🗣️ {recording.speaking_pace}</span>
                      <span>🔊 {recording.volume_variation}</span>
                      {recording.valence !== undefined && <span>Valence: {recording.valence.toFixed(2)}</span>}
                      {recording.arousal !== undefined && <span>Arousal: {recording.arousal.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoicePage;
