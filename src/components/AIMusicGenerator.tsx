import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/tailwind';
import { logger } from '@/utils/logger';

/**
 * AIMusicGenerator - AI-powered ambient soundscape generator
 * 
 * Features:
 * - Real-time AI-generated binaural beats and isochronic tones
 * - Brainwave entrainment (delta, theta, alpha, beta, gamma)
 * - Adaptive soundscapes based on mood
 * - Psychological research-backed frequencies
 * 
 * Research foundations:
 * - Dr. Gerald Oster (1973) - Binaural beats research
 * - Dr. Jeffrey Thompson - Clinical sound therapy
 * - HeartMath Institute - Cardiac coherence
 */

interface SoundscapeType {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  brainwave: string;
  best_for: string[];
  icon: string;
  color: string;
}

interface GeneratedTrack {
  track_id: string;
  type: string;
  duration_seconds: number;
  audio_url: string;
  download_url: string;
  parameters: {
    binaural_frequency: number;
    carrier_frequency: number;
    brainwave_state: string;
  };
  created_at: string;
}

export const AIMusicGenerator: React.FC = () => {
  const { t, i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [soundscapes, setSoundscapes] = useState<SoundscapeType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('meditation');
  const [duration, setDuration] = useState<number>(300); // 5 min default
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<GeneratedTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [error, setError] = useState<string | null>(null);
  const [showBrainwaveInfo, setShowBrainwaveInfo] = useState(false);

  // Fetch available soundscapes
  const fetchSoundscapes = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/ai-music/soundscapes', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSoundscapes(data.data.soundscapes);
      }
    } catch (err) {
      logger.error('Failed to fetch soundscapes:', err);
    }
  }, []);

  useEffect(() => {
    fetchSoundscapes();
  }, [fetchSoundscapes]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError(t('aiMusic.playbackError', 'Kunde inte spela upp ljudet'));
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [t]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Generate AI soundscape
  const generateSoundscape = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ai-music/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          type: selectedType,
          duration: duration,
          mood: 'relaxed' // Could be made dynamic based on user's current mood
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate soundscape');
      }

      const data = await response.json();
      setCurrentTrack(data.data);
      
      // Auto-play
      if (audioRef.current && data.data.audio_url) {
        audioRef.current.src = data.data.audio_url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      logger.error('Failed to generate soundscape:', err);
      setError(t('aiMusic.generationError', 'Kunde inte generera musik'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Play/Pause toggle
  const togglePlayback = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Download track
  const downloadTrack = () => {
    if (!currentTrack) return;
    
    const link = document.createElement('a');
    link.href = currentTrack.download_url;
    link.download = `lugn-trygg-${currentTrack.type}.wav`;
    link.click();
  };

  // Get localized text
  const getLocalizedText = (item: { name?: string; name_en?: string; description?: string; description_en?: string }) => {
    const isSwedish = i18n.language === 'sv';
    return {
      name: isSwedish ? item.name : (item.name_en || item.name),
      description: isSwedish ? item.description : (item.description_en || item.description)
    };
  };

  const selectedSoundscape = soundscapes.find(s => s.id === selectedType);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" />

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('aiMusic.title', 'AI-Music Generator')}
        </h1>
        <p className="text-gray-600">
          {t('aiMusic.subtitle', 'Neural ambient soundscapes with brainwave entrainment')}
        </p>
      </div>

      {/* Brainwave Info Toggle */}
      <div className="mb-6 text-center">
        <button
          onClick={() => setShowBrainwaveInfo(!showBrainwaveInfo)}
          className="text-teal-600 hover:text-teal-700 underline text-sm"
        >
          {showBrainwaveInfo 
            ? t('aiMusic.hideInfo', 'Dölj information') 
            : t('aiMusic.showInfo', 'Vad är hjärnvågsfrekvenser?')
          }
        </button>
      </div>

      {/* Brainwave Information */}
      {showBrainwaveInfo && (
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-4">
            {t('aiMusic.brainwaveTitle', 'Hjärnvågsfrekvenser & Entrainment')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white p-3 rounded">
              <strong className="text-purple-700">Delta (0.5-4 Hz):</strong>
              <p className="text-gray-600">Djup sömn, fysisk återhämtning, läkning</p>
            </div>
            <div className="bg-white p-3 rounded">
              <strong className="text-indigo-700">Theta (4-8 Hz):</strong>
              <p className="text-gray-600">Meditation, kreativitet, djup avslappning</p>
            </div>
            <div className="bg-white p-3 rounded">
              <strong className="text-teal-700">Alpha (8-13 Hz):</strong>
              <p className="text-gray-600">Lugnt vaken tillstånd, mindfulness, fokus</p>
            </div>
            <div className="bg-white p-3 rounded">
              <strong className="text-green-700">Beta (13-30 Hz):</strong>
              <p className="text-gray-600">Aktivt tänkande, problemlösning, alerthet</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-blue-700">
            {t('aiMusic.researchNote', 'Baserat på forskning av Dr. Gerald Oster, Dr. Jeffrey Thompson och HeartMath Institute')}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Soundscape Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('aiMusic.selectType', 'Välj typ av soundscape')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {soundscapes.map((soundscape) => {
            const localized = getLocalizedText(soundscape);
            const isSelected = selectedType === soundscape.id;
            
            return (
              <button
                key={soundscape.id}
                onClick={() => setSelectedType(soundscape.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-2xl mb-2">{soundscape.icon}</div>
                <h3 className="font-semibold text-gray-900">{localized.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{localized.description}</p>
                <div className="mt-2 text-xs text-teal-600">
                  {soundscape.brainwave}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Soundscape Details */}
      {selectedSoundscape && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{selectedSoundscape.icon}</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">
                {getLocalizedText(selectedSoundscape).name}
              </h3>
              <p className="text-gray-600 mt-1">
                {getLocalizedText(selectedSoundscape).description}
              </p>
              
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 text-sm mb-2">
                  {t('aiMusic.bestFor', 'Bäst för:')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSoundscape.best_for?.map((use, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs"
                    >
                      {use}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duration Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('aiMusic.duration', 'Varaktighet')}
        </h2>
        <div className="flex gap-3 flex-wrap">
          {[300, 600, 900, 1200].map((seconds) => (
            <button
              key={seconds}
              onClick={() => setDuration(seconds)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                duration === seconds
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-gray-200 hover:border-teal-300'
              }`}
            >
              {seconds / 60} {t('aiMusic.minutes', 'min')}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="text-center mb-8">
        <Button
          onClick={generateSoundscape}
          disabled={isGenerating}
          className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-lg text-lg font-medium disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin inline-block mr-2">⚡</span>
              {t('aiMusic.generating', 'Genererar AI-musik...')}
            </>
          ) : (
            <>
              <span className="mr-2">🎵</span>
              {t('aiMusic.generate', 'Generera Soundscape')}
            </>
          )}
        </Button>
        <p className="text-sm text-gray-500 mt-2">
          {t('aiMusic.generationNote', 'Varje generation skapar unik, procedurgenererad musik')}
        </p>
      </div>

      {/* Player Controls */}
      {currentTrack && (
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                {t('aiMusic.nowPlaying', 'Nu spelas:')} {currentTrack.type}
              </h3>
              <p className="text-sm text-gray-600">
                {currentTrack.duration_seconds / 60} {t('aiMusic.minutes', 'min')} • 
                {currentTrack.parameters.brainwave_state}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={togglePlayback}
                className="p-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition-colors"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <button
                onClick={downloadTrack}
                className="p-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
                title={t('aiMusic.download', 'Ladda ner')}
              >
                ⬇️
              </button>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 w-12">{Math.round(volume * 100)}%</span>
          </div>

          {/* Technical Details */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
            <p>
              {t('aiMusic.technicalDetails', 'Tekniska detaljer:')} 
              {' '}
              {t('aiMusic.binauralFreq', 'Binaural frekvens:')} {currentTrack.parameters.binaural_frequency} Hz • 
              {t('aiMusic.carrierFreq', 'Bärvågsfrekvens:')} {currentTrack.parameters.carrier_frequency} Hz
            </p>
            <p className="mt-1">
              {t('aiMusic.headphonesRecommended', 'Rekommenderas med hörlurar för binaural effekt')}
            </p>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>{t('aiMusic.disclaimer', 'AI-genererad musik för avslappning och meditation.')}</p>
        <p className="mt-1">
          {t('aiMusic.notMedical', 'Ersätter inte professionell medicinsk behandling.')}
        </p>
      </div>
    </div>
  );
};

export default AIMusicGenerator;
