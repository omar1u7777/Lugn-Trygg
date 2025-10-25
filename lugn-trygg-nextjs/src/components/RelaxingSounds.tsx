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
          artist: t('music.cosmicSounds', 'Kosmiska Ljud'),
          duration: '20:10',
          src: '/audio/ambient/floating-dreams.mp3',
          description: t('music.floatingDreamsDesc', 'Drömliknande atmosfär')
        }
      ]
    }
  ];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration);
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
      };
    }
  }, [selectedTrack]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTrackSelect = (track: MusicTrack, index: number) => {
    setSelectedTrack(track);
    setCurrentTrackIndex(index);
    setTimeout(() => handlePlay(), 100);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedTrack(null);
    setCurrentTrackIndex(0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setCurrentTime(Number(e.target.value));
    }
  };

  const currentCategory = musicCategories.find((cat) => cat.id === selectedCategory);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.1)', padding: 24, position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
      <h2 style={{ textAlign: 'center', marginBottom: 16 }}>{t('music.relaxingSounds', 'Avslappnande Ljud')}</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {musicCategories.map((cat) => (
          <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} style={{ flex: 1, padding: 8, borderRadius: 8, border: selectedCategory === cat.id ? '2px solid #1976d2' : '1px solid #ccc', background: selectedCategory === cat.id ? '#e3f2fd' : '#f5f5f5', fontWeight: 600, cursor: 'pointer' }}>
            <span style={{ fontSize: 20, marginRight: 6 }}>{cat.icon}</span> {cat.name}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#666', textAlign: 'center' }}>{currentCategory?.description}</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        {currentCategory?.tracks.map((track, idx) => (
          <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, background: selectedTrack?.id === track.id ? '#e3f2fd' : 'transparent', borderRadius: 8, padding: 8 }}>
            <button onClick={() => handleTrackSelect(track, idx)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: selectedTrack?.id === track.id ? '#1976d2' : '#888' }}>{selectedTrack?.id === track.id && isPlaying ? '⏸️' : '▶️'}</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{track.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{track.artist} • {track.duration}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{track.description}</div>
            </div>
          </div>
        ))}
      </div>
      {selectedTrack && (
        <div style={{ marginBottom: 16 }}>
          <audio ref={audioRef} src={selectedTrack.src} onEnded={() => setIsPlaying(false)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={isPlaying ? handlePause : handlePlay} style={{ border: 'none', background: '#1976d2', color: 'white', borderRadius: 6, padding: '6px 16px', fontWeight: 600, cursor: 'pointer' }}>{isPlaying ? 'Pausa' : 'Spela'}</button>
            <input type="range" min={0} max={duration} value={currentTime} onChange={handleSeek} style={{ flex: 1 }} />
            <span style={{ fontSize: 12 }}>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12 }}>Volym</span>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={handleVolumeChange} style={{ flex: 1 }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default RelaxingSounds;
