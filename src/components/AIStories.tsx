import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
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

interface AIStory {
  id: string;
  title: string;
  content: string;
  mood: string;
  category: string;
  duration: number;
  isFavorite: boolean;
  createdAt: string;
}

const AIStories: React.FC = () => {
  const { t } = useTranslation();
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

  const loadStories = useCallback(async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/ai/stories', {
        params: { user_id: user.user_id }
      });
      setStories(response.data?.stories || []);
    } catch (err) {
      setError(t('ai.stories.loadError'));
      console.error('Failed to load AI stories:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, t]);

  useEffect(() => {
    if (user?.user_id) {
      loadStories();
    } else {
      setStories([]);
    }
  }, [user?.user_id, loadStories]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const generateNewStory = async () => {
    if (!user?.user_id) {
      setError('Du måste vara inloggad för att generera berättelser');
      return;
    }
    
    try {
      setGenerating(true);
      const response = await api.post('/api/ai/story', {
        user_id: user.user_id,
        locale: 'sv'
      });
      setStories(prev => [response.data, ...prev]);
    } catch (err) {
      setError(t('ai.stories.generateError'));
      console.error('Failed to generate story:', err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleFavorite = async (storyId: string) => {
    setStories(prev => prev.map(story =>
      story.id === storyId
        ? { ...story, isFavorite: !story.isFavorite }
        : story
    ));
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const playStory = (story: AIStory) => {
    if (!story) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setSelectedStory(story);
    setIsPlaying(true);
    setCurrentTime(0);
    // In a real implementation, this would integrate with text-to-speech
    // For now, we'll simulate playback with a timer
    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= (story.duration || 0)) {
          stopPlayback();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const pauseStory = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

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
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/50 hover:shadow-xl"
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
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {stories.map((story, index) => (
              <motion.div
                key={story.id || `story-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="h-full flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  onClick={() => playStory(story)}
                >
                  <div className="flex-grow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex-grow mr-2">
                        {story.title}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(story.id);
                        }}
                        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                        {story.duration || 0} min
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
                      {story.content ? story.content.substring(0, 150) + '...' : 'Ingen innehåll tillgänglig'}
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
        {selectedStory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 flex-grow mr-4">
                  <BookOpenIcon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedStory.title}
                  </h2>
                  <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getMoodColor(selectedStory.mood)}`}>
                    {selectedStory.category}
                  </span>
                </div>
                <button
                  onClick={() => {
                    stopPlayback();
                    setSelectedStory(null);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {selectedStory.content || 'Ingen innehåll tillgänglig för denna berättelse.'}
                </p>
              </div>

              {/* Audio Controls */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={isPlaying ? pauseStory : () => playStory(selectedStory)}
                    className="p-3 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors"
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
                  >
                    {isMuted ? (
                      <SpeakerXMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <SpeakerWaveIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>

                  <div className="flex-grow mx-4">
                    <div className="h-1 bg-gray-300 dark:bg-gray-600 rounded-full relative overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            (currentTime / Math.max(selectedStory.duration || 1, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {Math.floor(currentTime / 60)}:
                    {(currentTime % 60).toString().padStart(2, '0')} /{' '}
                    {Math.floor(Math.max(selectedStory.duration || 0, 0) / 60)}:
                    {Math.floor(Math.max((selectedStory.duration || 0) % 60, 0))
                      .toString()
                      .padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-0">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    stopPlayback();
                    setSelectedStory(null);
                  }}
                >
                  {t('common.close')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AIStories;
