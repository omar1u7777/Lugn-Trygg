/**
 * Emoji Mood Selector Component
 * Quick and visual way to log mood with emoji picker
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../services/analytics';

interface EmojiMoodOption {
  emoji: string;
  label: string;
  value: string;
  color: string;
}

const MOOD_OPTIONS: EmojiMoodOption[] = [
  { emoji: '😊', label: 'Happy', value: 'happy', color: '#4CAF50' },
  { emoji: '😌', label: 'Calm', value: 'calm', color: '#81C784' },
  { emoji: '😐', label: 'Neutral', value: 'neutral', color: '#9E9E9E' },
  { emoji: '😔', label: 'Sad', value: 'sad', color: '#64B5F6' },
  { emoji: '😰', label: 'Anxious', value: 'anxious', color: '#FFB74D' },
  { emoji: '😡', label: 'Angry', value: 'angry', color: '#E57373' },
  { emoji: '😴', label: 'Tired', value: 'tired', color: '#9575CD' },
  { emoji: '😃', label: 'Excited', value: 'excited', color: '#FFD54F' },
];

interface EmojiMoodSelectorProps {
  open: boolean;
  onClose: () => void;
  onMoodSelected: (mood: string, emoji: string) => void;
  userId?: string;
}

export const EmojiMoodSelector: React.FC<EmojiMoodSelectorProps> = ({
  open,
  onClose,
  onMoodSelected,
  userId,
}) => {
  const { t } = useTranslation();
  const [selectedMood, setSelectedMood] = useState<EmojiMoodOption | null>(null);
  const [intensity, setIntensity] = useState<number>(3);

  const handleMoodClick = (mood: EmojiMoodOption) => {
    setSelectedMood(mood);
  };

  const handleConfirm = () => {
    if (selectedMood) {
      onMoodSelected(selectedMood.value, selectedMood.emoji);
      
      // Track analytics
      trackEvent('quick_mood_logged', {
        userId,
        mood: selectedMood.value,
        intensity,
        method: 'emoji',
      });

      // Reset and close
      setSelectedMood(null);
      setIntensity(3);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="emoji-mood-selector"
    >
      <DialogTitle id="emoji-mood-selector">
        {t('mood.quickLog', 'Quick Mood Log')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
          {t('mood.selectEmoji', 'How are you feeling right now?')}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {MOOD_OPTIONS.map((mood) => (
            <Grid xs={3} key={mood.value}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={() => handleMoodClick(mood)}
                  sx={{
                    width: '100%',
                    height: 80,
                    flexDirection: 'column',
                    backgroundColor:
                      selectedMood?.value === mood.value
                        ? mood.color
                        : 'transparent',
                    border: `2px solid ${
                      selectedMood?.value === mood.value ? mood.color : '#ddd'
                    }`,
                    borderRadius: 2,
                    '&:hover': {
                      backgroundColor: `${mood.color}22`,
                    },
                  }}
                  aria-label={`Select ${mood.label} mood`}
                  role="button"
                  tabIndex={0}
                >
                  <Typography variant="h2" sx={{ mb: 0.5 }}>
                    {mood.emoji}
                  </Typography>
                  <Typography variant="caption">{mood.label}</Typography>
                </Button>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {selectedMood && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              {t('mood.intensity', 'How intense is this feeling?')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Chip
                  key={level}
                  label={level}
                  onClick={() => setIntensity(level)}
                  color={intensity === level ? 'primary' : 'default'}
                  variant={intensity === level ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer' }}
                  aria-label={`Intensity level ${level}`}
                  role="radio"
                  aria-checked={intensity === level}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={!selectedMood}
        >
          {t('mood.logMood', 'Log Mood')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmojiMoodSelector;
