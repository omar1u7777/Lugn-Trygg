import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  BackwardIcon,
  ForwardIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import {
  getAudioLibrary,
  saveMeditationSession,
  type AudioTrack,
  type AudioLibrary
} from "../api/api";
import { API_ENDPOINTS } from '../api/constants';
import { tokenStorage } from '../utils/secureStorage';
import { logger } from '../utils/logger';

// Lazy load AI Music Generator for better performance
const AIMusicGenerator = lazy(() => import('./AIMusicGenerator'));

type SoundTab = 'library' | 'ai-music';

interface RelaxingSoundsProps {
  onClose: () => void;
  embedded?: boolean;
}

const RelaxingSounds: React.FC<RelaxingSoundsProps> = ({ onClose, embedded = false }) => {
  const { t, i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fallbackUrlRef = useRef<string | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerBaseVolumeRef = useRef<number>(0.5);
  const [activeTab, setActiveTab] = useState<SoundTab>('library');
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
  const [audioLoadingFallback, setAudioLoadingFallback] = useState(false);
  const [usingFallbackAudio, setUsingFallbackAudio] = useState(false);
  const playbackStartRef = useRef<Date | null>(null);
  const selectedTrackRef = useRef<AudioTrack | null>(null);

  // Sleep timer state
  const [timerRemaining, setTimerRemaining] = useState<number>(0);
  const [timerDuration, setTimerDuration] = useState<number>(0);

  // ── Sleep timer with fade-out ────────────────────────────────────────────

  const clearTimerInterval = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const restoreVolume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const baseVolume = timerBaseVolumeRef.current;
    audio.volume = baseVolume;
    setVolume(baseVolume);
  }, []);

  const cancelTimer = useCallback(() => {
    clearTimerInterval();
    setTimerRemaining(0);
    setTimerDuration(0);
    restoreVolume();
  }, [clearTimerInterval, restoreVolume]);

  const startTimer = useCallback((minutes: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    cancelTimer();
    const seconds = minutes * 60;
    timerBaseVolumeRef.current = audio.volume;
    setTimerDuration(seconds);
    setTimerRemaining(seconds);
  }, [cancelTimer]);

  // Countdown and fade-out effect
  useEffect(() => {
    if (timerRemaining <= 0) {
      clearTimerInterval();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    timerIntervalRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        const next = prev - 1;
        const base = timerBaseVolumeRef.current;

        // Fade out over the last 30 seconds
        if (next <= 30 && next > 0) {
          const fadeRatio = next / 30;
          const targetVolume = Math.max(0.01, base * fadeRatio);
          if (audioRef.current) {
            audioRef.current.volume = targetVolume;
          }
          setVolume(targetVolume);
        }

        if (next <= 0) {
          // Timer done: pause and restore volume
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
          setTimerDuration(0);
          setTimeout(() => restoreVolume(), 50);
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => clearTimerInterval();
  }, [timerRemaining, clearTimerInterval, restoreVolume]);

  // Keep ref in sync for unmount cleanup
  selectedTrackRef.current = selectedTrack;

  const savePlaybackSession = useCallback(() => {
    if (!playbackStartRef.current || !selectedTrackRef.current) return;
    const elapsedMs = new Date().getTime() - playbackStartRef.current.getTime();
    const elapsedMinutes = Math.round(elapsedMs / 1000 / 60);
    if (elapsedMinutes < 1) return;
    const track = selectedTrackRef.current;
    saveMeditationSession({
      type: 'soundscape',
      duration: elapsedMinutes,
      technique: track.title || track.titleEn || 'Ambient sound',
      completedCycles: 1,
      notes: 'Relaxing sounds session'
    }).catch(e => logger.error('Failed to save relaxing sounds session:', e));
    playbackStartRef.current = null;
  }, []);

  // Fetch audio library from backend
  const fetchAudioLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const library = await getAudioLibrary();
      if (Object.keys(library).length > 0) {
        setAudioLibrary(library);
        // Set first category as default if current doesn't exist
        if (!library[selectedCategory]) {
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
  }, [t, selectedCategory]);

  useEffect(() => {
    fetchAudioLibrary();
    return () => {
      if (fallbackUrlRef.current) {
        URL.revokeObjectURL(fallbackUrlRef.current);
        fallbackUrlRef.current = null;
      }
      clearTimerInterval();
      savePlaybackSession();
    };
  }, [fetchAudioLibrary, clearTimerInterval, savePlaybackSession]);

  const currentCategory = audioLibrary[selectedCategory];
  const currentPlaylist = useMemo(() => currentCategory?.tracks || [], [currentCategory]);
  const categories = Object.values(audioLibrary);

  // Get localized text based on current language
  const getLocalizedText = (item: { title?: string; titleEn?: string; name?: string; nameEn?: string }) => {
    const isSwedish = i18n.language === 'sv';
    const svText = item.title || item.name || '';
    const enText = item.titleEn || item.nameEn || svText;
    return isSwedish ? svText : enText;
  };

  const loadFallbackAudio = useCallback(async (brainwave: string = 'alpha', duration: number = 300) => {
      if (audioLoadingFallback) return;
    
      setAudioLoadingFallback(true);
      setAudioError(null);
    
      try {
        // Use the project's secure tokenStorage instead of localStorage; the access token is
        // stored in memory by AuthContext and never under the 'token' localStorage key.
        const token = await tokenStorage.getAccessToken();
        if (!token) {
          setAudioError(t('audio.authRequired', 'Autentisering krävs för att generera audio.'));
          return;
        }

        // Call fallback audio generation endpoint
        const response = await fetch(
          `${API_ENDPOINTS.AUDIO.GENERATE}?type=ambient&brainwave=${brainwave}&duration=${duration}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Revoke previous fallback blob URL to prevent memory leak
        if (fallbackUrlRef.current) {
          URL.revokeObjectURL(fallbackUrlRef.current);
        }
        fallbackUrlRef.current = audioUrl;

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.load();
          setUsingFallbackAudio(true);
          setAudioError(t('audio.usingGeneratedAudio', 'Använder genererad meditation...'));
        
          if (isPlaying) {
            await audioRef.current.play();
          }
        }
      } catch (err) {
        logger.error('Failed to load fallback audio:', err);
        setAudioError(t('audio.fallbackFailed', 'Kunde inte ladda meditation. Försök igen senare.'));
        setIsPlaying(false);
      } finally {
        setAudioLoadingFallback(false);
      }
    }, [audioLoadingFallback, isPlaying, t]);

  const handleNextTrack = useCallback(() => {
    if (currentPlaylist.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    const nextTrack = currentPlaylist[nextIndex];
    if (nextTrack) selectTrack(nextTrack, nextIndex);
  }, [currentPlaylist, currentTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => handleNextTrack();
    const handleError = () => {
      logger.warn(`Audio error for track: ${selectedTrack?.id}`);
      if (selectedTrack && !usingFallbackAudio) {
        void loadFallbackAudio('alpha', 300);
      } else {
        setAudioError(t('audio.playbackError', 'Kunde inte spela upp ljudet. Försök med ett annat spår.'));
        setIsPlaying(false);
      }
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
  }, [handleNextTrack, loadFallbackAudio, selectedTrack, usingFallbackAudio, volume, t]);

  useEffect(() => {
    if (selectedTrack && audioRef.current) {
      setAudioError(null);
      audioRef.current.src = selectedTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play()?.catch(() => {
          setAudioError(t('audio.playbackError', 'Kunde inte spela upp ljudet.'));
          setIsPlaying(false);
        });
      }
    }
  }, [isPlaying, selectedTrack, t]);

  const selectTrack = (track: AudioTrack, index: number) => {
    savePlaybackSession();
    playbackStartRef.current = new Date();
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
        cancelTimer(); // Stop sleep timer when user manually pauses
        savePlaybackSession();
      } else {
        await audioRef.current.play();
        if (!playbackStartRef.current) playbackStartRef.current = new Date();
        setIsPlaying(true);
      }
    } catch (err) {
      logger.error('Playback error:', err);
      setAudioError(t('audio.playbackError', 'Kunde inte spela upp ljudet.'));
      setIsPlaying(false);
    }
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
    // Update saved timer base volume unless we are currently fading out
    if (timerRemaining > 30 || timerRemaining === 0) {
      timerBaseVolumeRef.current = newVolume;
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

  const formatTimerTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('common.close', 'Stäng')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`px-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 ${embedded ? 'px-0' : ''}`}>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'library'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <span className="mr-2">📚</span>
              {t('sounds.library', 'Ljudbibliotek')}
            </button>
            <button
              onClick={() => setActiveTab('ai-music')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'ai-music'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <span className="mr-2">🤖</span>
              {t('sounds.aiMusic', 'AI-Musik')}
              <span className="ml-2 px-2 py-0.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">
                {t('common.new', 'Ny')}
              </span>
            </button>
          </div>
        </div>

        {/* AI Music Tab */}
        {activeTab === 'ai-music' && (
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600 dark:text-slate-400">{t('common.loading', 'Laddar...')}</p>
                </div>
              </div>
            }>
              <AIMusicGenerator />
            </Suspense>
          </div>
        )}

        {/* Library Tab */}
        {activeTab === 'library' && (
          <>
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
                                    {isPlaying ? `🔊 ${t('audio.playing', 'Spelar')}` : `⏸️ ${t('audio.paused', 'Pausad')}`}
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

                      {/* Sleep Timer */}
                      {selectedTrack && (
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              ⏰ {t('audio.sleepTimer', 'Sleeptimer')}
                            </span>
                            {timerRemaining > 0 && (
                              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                                {formatTimerTime(timerRemaining)} {t('audio.remaining', 'kvar')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {[15, 30, 60].map((minutes) => {
                              const isActive = timerRemaining > 0 && timerDuration === minutes * 60;
                              return (
                                <button
                                  key={minutes}
                                  onClick={() => startTimer(minutes)}
                                  disabled={!isPlaying}
                                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                                    isActive
                                      ? 'bg-primary-500 text-white'
                                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50'
                                  }`}
                                >
                                  {minutes} {t('audio.min', 'min')}
                                </button>
                              );
                            })}
                            <button
                              onClick={cancelTimer}
                              disabled={timerRemaining === 0}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 min-h-[36px]"
                            >
                              {t('audio.timerOff', 'Av')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Control Buttons */}
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <button
                          onClick={handlePreviousTrack}
                          disabled={!selectedTrack || currentPlaylist.length === 0}
                          aria-label={t('audio.previous', 'Föregående')}
                          className="w-12 h-12 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <BackwardIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        </button>

                        <button
                          onClick={togglePlay}
                          disabled={!selectedTrack}
                          aria-label={isPlaying ? t('audio.pause', 'Pausa') : t('audio.play', 'Spela')}
                          className="w-16 h-16 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                          <span className="text-2xl">{isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7 ml-0.5" />}</span>
                        </button>

                        <button
                          onClick={handleNextTrack}
                          disabled={!selectedTrack || currentPlaylist.length === 0}
                          aria-label={t('audio.next', 'Nästa')}
                          className="w-12 h-12 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ForwardIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        </button>
                      </div>

                      {/* Volume Control */}
                      <div className="flex items-center gap-3 mt-auto">
                        <SpeakerXMarkIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <SpeakerWaveIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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
          </>
        )}

        {/* Close Button - Only show if NOT embedded */}
        {!embedded && (
          <button
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
            onClick={onClose}
            aria-label={t('common.close', 'Stäng')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
};

export default RelaxingSounds;
