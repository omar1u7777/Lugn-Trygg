import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/api';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AutoStories as StoriesIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  Refresh as RefreshIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
} from '@mui/icons-material';

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
  const { isDarkMode, muiTheme } = useTheme();
  const [stories, setStories] = useState<AIStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<AIStory | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/ai/stories', {
        params: { user_id: user?.user_id }
      });
      setStories(response.data.stories || []);
    } catch (err) {
      setError(t('ai.stories.loadError'));
      console.error('Failed to load AI stories:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateNewStory = async () => {
    try {
      setGenerating(true);
      const response = await api.post('/api/ai/story', {
        user_id: user?.user_id,
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
    // For now, just toggle locally since backend doesn't have this endpoint yet
    setStories(prev => prev.map(story =>
      story.id === storyId
        ? { ...story, isFavorite: !story.isFavorite }
        : story
    ));
  };

  const playStory = (story: AIStory) => {
    setSelectedStory(story);
    setIsPlaying(true);
    // In a real implementation, this would integrate with text-to-speech
    // For now, we'll simulate playback with a timer
    const timer = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= story.duration) {
          setIsPlaying(false);
          clearInterval(timer);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const pauseStory = () => {
    setIsPlaying(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const getMoodColor = (mood: string) => {
    const colors = {
      happy: '#4CAF50',
      calm: '#2196F3',
      anxious: '#FF9800',
      sad: '#9C27B0',
      stressed: '#F44336',
      neutral: '#607D8B'
    };
    return colors[mood as keyof typeof colors] || colors.neutral;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoriesIcon color="primary" />
            {t('ai.stories.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={generateNewStory}
            disabled={generating}
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
            }}
          >
            {generating ? t('ai.stories.generating') : t('ai.stories.generateNew')}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={3}>
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
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: muiTheme.shadows[8],
                    },
                  }}
                  onClick={() => playStory(story)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h2" sx={{ flexGrow: 1, mr: 1 }}>
                        {story.title}
                      </Typography>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(story.id);
                        }}
                        size="small"
                      >
                        {story.isFavorite ? (
                          <FavoriteIcon color="error" />
                        ) : (
                          <FavoriteBorderIcon />
                        )}
                      </IconButton>
                    </Box>

                    <Box display="flex" gap={1} mb={2}>
                      <Chip
                        label={story.category}
                        size="small"
                        sx={{ backgroundColor: getMoodColor(story.mood) }}
                      />
                      <Chip
                        label={`${story.duration || 0} min`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {story.content ? story.content.substring(0, 150) + '...' : 'Ingen innehåll tillgänglig'}
                    </Typography>
                  </CardContent>

                  <Box p={2} pt={0}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<PlayIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        playStory(story);
                      }}
                    >
                      {t('ai.stories.play')}
                    </Button>
                  </Box>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>

        {/* Story Player Dialog */}
        <Dialog
          open={!!selectedStory}
          onClose={() => {
            setSelectedStory(null);
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          maxWidth="md"
          fullWidth
        >
          {selectedStory && (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StoriesIcon />
                {selectedStory.title}
                <Chip
                  label={selectedStory.category}
                  size="small"
                  sx={{ ml: 'auto', backgroundColor: getMoodColor(selectedStory.mood) }}
                />
              </DialogTitle>

              <DialogContent>
                <Typography variant="body1" paragraph>
                  {selectedStory.content || 'Ingen innehåll tillgänglig för denna berättelse.'}
                </Typography>

                {/* Audio Controls */}
                <Box display="flex" alignItems="center" gap={2} mt={3}>
                  <IconButton onClick={isPlaying ? pauseStory : () => playStory(selectedStory)}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </IconButton>

                  <IconButton onClick={toggleMute}>
                    {isMuted ? <MuteIcon /> : <VolumeIcon />}
                  </IconButton>

                  <Box flexGrow={1} mx={2}>
                    <Box
                      sx={{
                        height: 4,
                        backgroundColor: 'grey.300',
                        borderRadius: 2,
                        position: 'relative',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          backgroundColor: 'primary.main',
                          borderRadius: 2,
                          width: `${(currentTime / selectedStory.duration) * 100}%`,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} / {Math.floor((selectedStory.duration || 0) / 60)}:{(((selectedStory.duration || 0) % 60)).toString().padStart(2, '0')}
                  </Typography>
                </Box>
              </DialogContent>

              <DialogActions>
                <Button onClick={() => setSelectedStory(null)}>
                  {t('common.close')}
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </motion.div>
  );
};

export default AIStories;