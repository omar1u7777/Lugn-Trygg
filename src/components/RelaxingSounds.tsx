import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  src: string;
  description: string;
}

interface MusicCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  tracks: MusicTrack[];
}

const RelaxingSounds: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('nature');
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // Music categories with tracks
  const musicCategories: MusicCategory[] = [
    {
      id: 'nature',
      name: t('music.nature', 'Natur'),
      icon: '🌿',
      description: t('music.natureDesc', 'Naturliga ljud för avslappning'),
      tracks: [
        {
          id: 'forest-rain',
          title: t('music.forestRain', 'Skog och Regn'),
          artist: t('music.naturalSounds', 'Naturliga Ljud'),
          duration: '15:30',
          src: '/audio/nature/forest-rain.mp3',
          description: t('music.forestRainDesc', 'Lugn skog med mjuk regn')
        },
        {
          id: 'ocean-waves',
          title: t('music.oceanWaves', 'Havsvåg'),
          artist: t('music.naturalSounds', 'Naturliga Ljud'),
          duration: '12:45',
          src: '/audio/nature/ocean-waves.mp3',
          description: t('music.oceanWavesDesc', 'Kalm havsbris')
        },
        {
          id: 'birds-singing',
          title: t('music.birdsSinging', 'Fågelsång'),
          artist: t('music.naturalSounds', 'Naturliga Ljud'),
          duration: '18:20',
          src: '/audio/nature/birds-singing.mp3',
          description: t('music.birdsSingingDesc', 'Morgon fågelsång i skogen')
        }
      ]
    },
    {
      id: 'ambient',
      name: t('music.ambient', 'Ambient'),
      icon: '🌌',
      description: t('music.ambientDesc', 'Eteriska ljudlandskap'),
      tracks: [
        {
          id: 'deep-space',
          title: t('music.deepSpace', 'Djupt Utrymme'),
          artist: t('music.cosmicSounds', 'Kosmiska Ljud'),
          duration: '25:00',
          src: '/audio/ambient/deep-space.mp3',
          description: t('music.deepSpaceDesc', 'Resa genom universum')
        },
        {
          id: 'floating-dreams',
          title: t('music.floatingDreams', 'Flytande Drömmar'),
          artist: t('music.ambientArtists', 'Ambient Konstnärer'),
          duration: '22:15',
          src: '/audio/ambient/floating-dreams.mp3',
          description: t('music.floatingDreamsDesc', 'Eteriska ljud för meditation')
        }
      ]
    },
    {
      id: 'meditation',
      name: t('music.meditation', 'Meditation'),
      icon: '🧘',
      description: t('music.meditationDesc', 'Guidad meditation och mindfulness'),
      tracks: [
        {
          id: 'mindful-breathing',
          title: t('music.mindfulBreathing', 'Medveten Andning'),
          artist: t('music.meditationGuide', 'Meditation Guide'),
          duration: '20:00',
          src: '/audio/meditation/mindful-breathing.mp3',
          description: t('music.mindfulBreathingDesc', 'Guidad andningsövning')
        },
        {
          id: 'body-scan',
          title: t('music.bodyScan', 'Kroppsscanning'),
          artist: t('music.meditationGuide', 'Meditation Guide'),
          duration: '30:00',
          src: '/audio/meditation/body-scan.mp3',
          description: t('music.bodyScanDesc', 'Progressiv avslappning')
        }
      ]
    },
    {
      id: 'classical',
      name: t('music.classical', 'Klassisk'),
      icon: '🎼',
      description: t('music.classicalDesc', 'Klassisk musik för lugn'),
      tracks: [
        {
          id: 'moonlight-sonata',
          title: t('music.moonlightSonata', 'Månskenssonaten'),
          artist: 'Ludwig van Beethoven',
          duration: '14:50',
          src: '/audio/classical/moonlight-sonata.mp3',
          description: t('music.moonlightSonataDesc', 'Beethovens mästerverk')
        },
        {
          id: 'nocturnes-chopin',
          title: t('music.nocturnes', 'Nokturner'),
          artist: 'Frédéric Chopin',
          duration: '8:30',
          src: '/audio/classical/nocturnes-chopin.mp3',
          description: t('music.nocturnesDesc', 'Chopins nattliga musik')
        }
      ]
    },
    {
      id: 'binaural',
      name: t('music.binaural', 'Binaural'),
      icon: '🎧',
      description: t('music.binauralDesc', 'Binaural beats för fokus'),
      tracks: [
        {
          id: 'alpha-waves',
          title: t('music.alphaWaves', 'Alfa-våg'),
          artist: t('music.brainwaves', 'Hjärnvåg'),
          duration: '45:00',
          src: '/audio/binaural/alpha-waves.mp3',
          description: t('music.alphaWavesDesc', '10Hz för avslappning')
        },
        {
          id: 'theta-healing',
          title: t('music.thetaHealing', 'Theta-läkning'),
          artist: t('music.brainwaves', 'Hjärnvåg'),
          duration: '60:00',
          src: '/audio/binaural/theta-healing.mp3',
          description: t('music.thetaHealingDesc', '6Hz för läkning')
        }
      ]
    }
  ];

  const currentCategory = musicCategories.find(cat => cat.id === selectedCategory);
  const currentPlaylist = currentCategory?.tracks || [];

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;

      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration);

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleNextTrack);

      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleNextTrack);
      };
    }
  }, [volume]);

  useEffect(() => {
    if (selectedTrack && audioRef.current) {
      audioRef.current.src = selectedTrack.src;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  }, [selectedTrack]);

  const selectTrack = (track: MusicTrack, index: number) => {
    setSelectedTrack(track);
    setCurrentTrackIndex(index);
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNextTrack = () => {
    const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    if (currentPlaylist[nextIndex]) {
      selectTrack(currentPlaylist[nextIndex], nextIndex);
    }
  };

  const handlePreviousTrack = () => {
    const prevIndex = currentTrackIndex === 0 ? currentPlaylist.length - 1 : currentTrackIndex - 1;
    if (currentPlaylist[prevIndex]) {
      selectTrack(currentPlaylist[prevIndex], prevIndex);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[95vh] w-full max-w-6xl flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <span className="text-2xl">🎵</span>
            {t('dashboard.relaxingSounds', 'Lugn Musik')}
          </h3>
        </div>

        {/* Category Selection */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex flex-wrap gap-3">
            {musicCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category.id
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Track List */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{currentCategory?.icon}</span>
                {currentCategory?.name}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">{currentCategory?.description}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {currentPlaylist.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => selectTrack(track, index)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedTrack?.id === track.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-slate-900 dark:text-slate-100 truncate">{track.title}</h5>
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
            <div className="p-6 h-full flex flex-col">
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
                  {isPlaying ? '⏸️' : '▶️'}
                </div>
                {selectedTrack ? (
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 truncate">{selectedTrack.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{selectedTrack.artist}</p>
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('music.selectTrack', 'Välj en låt för att börja')}</p>
                )}
              </div>

              {/* Progress Bar */}
              {selectedTrack && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={handlePreviousTrack}
                  disabled={!selectedTrack}
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
                  disabled={!selectedTrack}
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
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          onClick={onClose}
          aria-label="Stäng"
        >
          ✕
        </button>
      </div>

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
};

export default RelaxingSounds;