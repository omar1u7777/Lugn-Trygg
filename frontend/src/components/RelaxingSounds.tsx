import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const RelaxingSounds: React.FC = () => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;

      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration);

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);

      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
      };
    }
  }, [volume]);

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
    <div className="relaxing-sounds">
      <h3 className="sounds-title">
        <i className="fas fa-music"></i> {t('dashboard.relaxingSounds', 'Relaxing Sounds')}
      </h3>

      <div className="sound-player">
        <div className="play-button-container">
          <button
            className={`play-button ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
          >
            <i className={isPlaying ? "fas fa-pause" : "fas fa-play"}></i>
          </button>
        </div>

        <div className="sound-info">
          <div className="track-info">
            <div className="track-title">{t('relaxingSounds.trackTitle', 'Calm Music')}</div>
            <div className="track-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="volume-control">
            <i className="fas fa-volume-down"></i>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
            <i className="fas fa-volume-up"></i>
          </div>
        </div>
      </div>

      <div className="sound-description">
        <p>{t('relaxingSounds.description', '🎵 Calm and relaxing music to help you unwind and feel better.')}</p>
      </div>

      <audio ref={audioRef} src="/audio/calm-music.mp3" loop preload="metadata" />
    </div>
  );
};

export default RelaxingSounds;