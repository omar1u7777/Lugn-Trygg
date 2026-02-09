import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getAudioLibrary,
  type AudioTrack,
  type AudioLibrary
} from "../api/api";
import { logger } from '../utils/logger';

interface RelaxingSoundsProps {
  onClose: () => void;
  embedded?: boolean;
}

const RelaxingSounds: React.FC<RelaxingSoundsProps> = ({ onClose, embedded = false }) => {
  const { t, i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('nature');
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioLibrary, setAudioLibrary] = useState<AudioLibrary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Fetch audio library from backend
  const fetchAudioLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const library = await getAudioLibrary();
      if (Object.keys(library).length > 0) {
        setAudioLibrary(library);
        // Set first category as default if current doesn't exist
        if (library[selectedCategory]) {
          // Keep current
        } else {
          // Default to first
          const firstKey = Object.keys(library)[0];
          if (firstKey) setSelectedCategory(firstKey);
        }
      } else {
        setError(t('audio.noTracks', 'Inga ljudspår tillgängliga just nu.'));
      }
    } catch (err) {
      logger.error('Failed to fetch audio library:', err);
      setError(t('audio.loadError', 'Kunde inte ladda ljudbiblioteket.'));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, t]);

  useEffect(() => {
    fetchAudioLibrary();
  }, [fetchAudioLibrary]);

  const currentCategory = audioLibrary[selectedCategory];
  const currentPlaylist = currentCategory?.tracks || [];
  const categories = Object.values(audioLibrary);

  // Get localized text based on current language
  const getLocalizedText = (item: { title?: string; titleEn?: string; name?: string; nameEn?: string }) => {
    const isSwedish = i18n.language === 'sv';
    const svText = item.title || item.name || '';
    const enText = item.titleEn || item.nameEn || svText;
    return isSwedish ? svText : enText;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => handleNextTrack();
    const handleError = () => {
      setAudioError(t('audio.playbackError', 'Kunde inte spela upp ljudet. Försök med ett annat spår.'));
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [volume, t]);

  useEffect(() => {
    if (selectedTrack && audioRef.current) {
      setAudioError(null);
      audioRef.current.src = selectedTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          setAudioError(t('audio.playbackError', 'Kunde inte spela upp ljudet.'));
          setIsPlaying(false);
        });
      }
    }
  }, [selectedTrack, t]);

  const selectTrack = (track: AudioTrack, index: number) => {
    setSelectedTrack(track);
    setCurrentTrackIndex(index);
    setAudioError(null);
  };

  const togglePlay = async () => {
    if (!audioRef.current || !selectedTrack) return;

    setAudioError(null);
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      logger.error('Playback error:', err);
      setAudioError(t('audio.playbackError', 'Kunde inte spela upp ljudet.'));
      setIsPlaying(false);
    }
  };

  const handleNextTrack = () => {
    if (currentPlaylist.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    const nextTrack = currentPlaylist[nextIndex];
    if (nextTrack) selectTrack(nextTrack, nextIndex);
  };

  const handlePreviousTrack = () => {
    if (currentPlaylist.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? currentPlaylist.length - 1 : currentTrackIndex - 1;
    const prevTrack = currentPlaylist[prevIndex];
    if (prevTrack) selectTrack(prevTrack, prevIndex);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} `;
  };

  const containerClasses = embedded
    ? "w-full min-h-[500px] flex flex-col bg-transparent"
    : "fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4";

  const cardClasses = embedded
    ? "bg-transparent w-full flex flex-col h-full"
    : "bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[95vh] w-full max-w-6xl flex flex-col";

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        <div className={`p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 ${embedded ? 'px-0 pt-0' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <span className="text-2xl">🎵</span>
              {t('dashboard.relaxingSounds', 'Lugn Musik')}
            </h3>
            {!embedded && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label={t('common.close', 'Stäng')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">{t('common.loading', 'Laddar...')}</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <span className="text-5xl mb-4 block">😔</span>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchAudioLibrary}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('common.retry', 'Försök igen')}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && categories.length > 0 && (
          <>
            {/* Category Selection */}
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 ${embedded ? 'px-0' : ''}`}>
              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${selectedCategory === category.id
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <span className="mr-2">{category.icon}</span>
                    {getLocalizedText(category)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Track List */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 ${embedded ? 'px-0' : ''}`}>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{currentCategory?.icon}</span>
                    {currentCategory && getLocalizedText(currentCategory)}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{currentCategory?.description}</p>
                </div>

                <div className={`flex-1 overflow-y-auto px-6 py-4 ${embedded ? 'px-0' : ''}`}>
                  <div className="space-y-3">
                    {currentPlaylist.map((track, index) => (
                      <div
                        key={track.id}
                        onClick={() => selectTrack(track, index)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${selectedTrack?.id === track.id
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {getLocalizedText(track)}
                            </h5>
                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{track.artist}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-2">{track.description}</p>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{track.duration}</div>
                            {selectedTrack?.id === track.id && (
                              <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                                {isPlaying ? '🔊 Spelar' : '⏸️ Pausad'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player Controls - Always Visible */}
              <div className="lg:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700">
                <div className={`p-6 h-full flex flex-col ${embedded ? 'px-4' : ''}`}>
                  <div className="text-center mb-6">
                    <div
                      className="w-20 h-20 mx-auto mb-4 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg cursor-pointer hover:bg-primary-600 transition-colors"
                      onClick={togglePlay}
                    >
                      {isPlaying ? '⏸️' : '▶️'}
                    </div>
                    {selectedTrack ? (
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 truncate">
                          {getLocalizedText(selectedTrack)}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{selectedTrack.artist}</p>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{t('music.selectTrack', 'Välj en låt för att börja')}</p>
                    )}
                  </div>

                  {/* Audio Error Message */}
                  {audioError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{audioError}</p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {selectedTrack && (
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Control Buttons */}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                      onClick={handlePreviousTrack}
                      disabled={!selectedTrack || currentPlaylist.length === 0}
                      className="w-12 h-12 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ⏮️
                    </button>

                    <button
                      onClick={togglePlay}
                      disabled={!selectedTrack}
                      className="w-16 h-16 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      <span className="text-2xl">{isPlaying ? '⏸️' : '▶️'}</span>
                    </button>

                    <button
                      onClick={handleNextTrack}
                      disabled={!selectedTrack || currentPlaylist.length === 0}
                      className="w-12 h-12 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ⏭️
                    </button>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-3 mt-auto">
                    <span className="text-sm text-slate-600 dark:text-slate-400">🔉</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">🔊</span>
                  </div>

                  {/* License Info */}
                  {selectedTrack && (
                    <div className="mt-4 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {t('audio.license', 'Licens')}: {selectedTrack.license}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Close Button - Only show if NOT embedded */}
        {!embedded && (
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        )}
      </div>

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />
    </div>
  );
};

export default RelaxingSounds;
