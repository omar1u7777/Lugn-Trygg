import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import useAuth from '../hooks/useAuth';
import { AIStory, getStories, generateStory } from '../api/ai';
import {
  BookOpenIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  HeartIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { Button, Alert, Card } from './ui/tailwind';
import { logger } from '../utils/logger';




const ALLOWED_LOCALES = ['sv', 'en', 'no'] as const;
const DEFAULT_LOCALE = 'sv';

const getMoodColor = (mood: string) => {
  const colorMap = {
    happy: 'bg-green-500',
    calm: 'bg-blue-500',
    anxious: 'bg-orange-500',
    sad: 'bg-purple-500',
    stressed: 'bg-red-500',
    neutral: 'bg-gray-500'
  };
  return colorMap[mood as keyof typeof colorMap] || colorMap.neutral;
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const AIStories: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  // isDarkMode hanteras av Tailwind dark: classes
  const [stories, setStories] = useState<AIStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<AIStory | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [generating, setGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const selectedStoryRef = useRef<AIStory | null>(null);

  const favoritesKey = useMemo(() => {
    return user?.user_id ? `lugn_trygg_favorite_stories_${user.user_id}` : null;
  }, [user?.user_id]);

  const locale = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || DEFAULT_LOCALE;
    return ALLOWED_LOCALES.includes(lang as typeof ALLOWED_LOCALES[number]) ? lang : DEFAULT_LOCALE;
  }, [i18n.language]);

  const loadFavorites = useCallback((loadedStories: AIStory[]) => {
    if (!favoritesKey) return loadedStories;
    try {
      const saved = localStorage.getItem(favoritesKey);
      if (!saved) return loadedStories;
      const favoriteIds: string[] = JSON.parse(saved);
      return loadedStories.map(story => ({
        ...story,
        isFavorite: favoriteIds.includes(story.id),
      }));
    } catch {
      // localStorage may be unavailable or corrupt
      return loadedStories;
    }
  }, [favoritesKey]);

  const saveFavorites = useCallback((updatedStories: AIStory[]) => {
    if (!favoritesKey) return;
    try {
      const favoriteIds = updatedStories.filter(s => s.isFavorite).map(s => s.id);
      localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds));
    } catch {
      // localStorage may be unavailable
    }
  }, [favoritesKey]);

  const loadStories = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      setLoading(true);
      setError(null);
      const loadedStories = await getStories();
      setStories(loadFavorites(loadedStories));
    } catch (err) {
      setError(t('ai.stories.loadError'));
      logger.error('Failed to load AI stories:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, t, loadFavorites]);

  useEffect(() => {
    if (user?.user_id) {
      loadStories();
    } else {
      setStories([]);
      setLoading(false);
    }
  }, [user?.user_id, loadStories]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      generatingRef.current = false;
    };
  }, []);

  const generateNewStory = useCallback(async () => {
    if (!user?.user_id) {
      setError(t('ai.stories.loginRequiredGenerate'));
      return;
    }
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);

    try {
      const newStory = await generateStory(locale);
      setStories(prev => [newStory, ...prev]);
    } catch (err) {
      setError(t('ai.stories.generateError'));
      logger.error('Failed to generate story:', err);
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, [user?.user_id, t, locale]);

  const toggleFavorite = useCallback((storyId: string) => {
    setStories(prev => {
      const updated = prev.map(story =>
        story.id === storyId
          ? { ...story, isFavorite: !story.isFavorite }
          : story
      );
      saveFavorites(updated);
      return updated;
    });
  }, [saveFavorites]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pauseStory = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playStory = useCallback((story: AIStory) => {
    if (!story?.duration) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const isResuming = selectedStoryRef.current?.id === story.id && currentTimeRef.current > 0 && currentTimeRef.current < story.duration;

    setSelectedStory(story);
    selectedStoryRef.current = story;
    setIsPlaying(true);
    if (!isResuming) {
      setCurrentTime(0);
      currentTimeRef.current = 0;
    }

    // In a real implementation, this would integrate with text-to-speech.
    // For now, we simulate playback with a timer.
    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 1;
        if (next >= story.duration) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setIsPlaying(false);
          currentTimeRef.current = 0;
          return 0;
        }
        currentTimeRef.current = next;
        return next;
      });
    }, 1000);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const closePlayer = useCallback(() => {
    stopPlayback();
    setSelectedStory(null);
    selectedStoryRef.current = null;
  }, [stopPlayback]);

  // ESC key handler for player dialog
  useEffect(() => {
    if (!selectedStory) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePlayer();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedStory, closePlayer]);

  // Body scroll lock when dialog is open
  useEffect(() => {
    if (selectedStory) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedStory]);

  if (loading) {
    return (
          <div className="flex justify-center items-center min-h-[200px]">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user?.user_id) {
    return (
      <div className="p-6">
        <Alert variant="warning">
          {t('ai.stories.loginRequired', 'Logga in för att se dina AI-berättelser.')}
        </Alert>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpenIcon className="w-8 h-8 text-primary-600" />
            {t('ai.stories.title')}
          </h1>
          <Button
            onClick={generateNewStory}
            disabled={generating}
            className="bg-linear-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/50 hover:shadow-xl"
          >
            {generating ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <ArrowPathIcon className="w-5 h-5 mr-2" />
            )}
            {generating ? t('ai.stories.generating') : t('ai.stories.generateNew')}
          </Button>
        </div>

        {error && (
          <Alert variant="error" className="mb-6">
            <div className="flex justify-between items-center gap-4">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="p-1 rounded-sm hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                aria-label={t('common.close', 'Stäng')}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </Alert>
        )}

        {stories.length === 0 && !generating && (
          <div className="text-center py-12">
            <BookOpenIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {t('ai.stories.empty', 'Inga berättelser ännu. Generera din första AI-berättelse!')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {stories.map((story, index) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="h-full flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  onClick={() => playStory(story)}
                >
                  <div className="grow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white grow mr-2">
                        {story.title}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(story.id);
                        }}
                        className="shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label={story.isFavorite ? t('ai.stories.removeFavorite', 'Ta bort favorit') : t('ai.stories.addFavorite', 'Lägg till favorit')}
                      >
                        {story.isFavorite ? (
                          <HeartIconSolid className="w-6 h-6 text-red-500" />
                        ) : (
                          <HeartIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getMoodColor(story.mood)}`}>
                        {story.category}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-full text-gray-700 dark:text-gray-300">
                        {formatDuration(story.duration)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
                      {story.content
                        ? (story.content.length > 150 ? `${story.content.substring(0, 150)}...` : story.content)
                        : t('ai.stories.noContent')}
                    </p>
                  </div>

                  <div className="p-6 pt-0">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        playStory(story);
                      }}
                    >
                      <PlayIcon className="w-5 h-5 mr-2" />
                      {t('ai.stories.play')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Story Player Dialog */}
        <AnimatePresence>
          {selectedStory && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closePlayer}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 grow mr-4">
                  <BookOpenIcon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedStory.title}
                  </h2>
                  <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getMoodColor(selectedStory.mood)}`}>
                    {selectedStory.category}
                  </span>
                </div>
                <button
                  onClick={closePlayer}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label={t('common.close', 'Stäng')}
                >
                  <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
                <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {selectedStory.content || t('ai.stories.noContentForStory')}
                </p>
              </div>

              {/* Audio Controls */}
              <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={isPlaying ? pauseStory : () => playStory(selectedStory)}
                    className="p-3 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    aria-label={isPlaying ? t('ai.stories.pause', 'Pausa') : t('ai.stories.play', 'Spela upp')}
                  >
                    {isPlaying ? (
                      <PauseIcon className="w-6 h-6" />
                    ) : (
                      <PlayIcon className="w-6 h-6" />
                    )}
                  </button>

                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label={isMuted ? t('ai.stories.unmute', 'Sätt på ljud') : t('ai.stories.mute', 'Ljud av')}
                  >
                    {isMuted ? (
                      <SpeakerXMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <SpeakerWaveIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>

                  <div className="grow mx-4">
                    <div className="h-1 bg-gray-300 dark:bg-gray-600 rounded-full relative overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            (currentTime / Math.max(selectedStory.duration, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {formatTime(currentTime)} / {formatTime(selectedStory.duration)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-0">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={closePlayer}
                >
                  {t('common.close')}
                </Button>
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AIStories;
