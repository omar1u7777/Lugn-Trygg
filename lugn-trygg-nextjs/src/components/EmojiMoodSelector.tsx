import React, { useState } from 'react';
import { Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Grid } from '@mui/material';
import { motion } from 'framer-motion';

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
}

const EmojiMoodSelector: React.FC<EmojiMoodSelectorProps> = ({ open, onClose, onMoodSelected }) => {
  const [selectedMood, setSelectedMood] = useState<EmojiMoodOption | null>(null);
  const [intensity, setIntensity] = useState<number>(3);

  const handleMoodClick = (mood: EmojiMoodOption) => setSelectedMood(mood);
  const handleConfirm = () => {
    if (selectedMood) {
      onMoodSelected(selectedMood.value, selectedMood.emoji);
      setSelectedMood(null);
      setIntensity(3);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="emoji-mood-selector">
      <DialogTitle id="emoji-mood-selector">Quick Mood Log</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>How are you feeling right now?</Typography>
        <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
          {MOOD_OPTIONS.map((mood) => (
            <Box key={mood.value} sx={{ flex: '1 1 22%', minWidth: 80 }}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={() => handleMoodClick(mood)} sx={{ width: '100%', height: 80, flexDirection: 'column', backgroundColor: selectedMood?.value === mood.value ? mood.color : 'transparent', border: `2px solid ${selectedMood?.value === mood.value ? mood.color : '#ddd'}`, borderRadius: 2, '&:hover': { backgroundColor: `${mood.color}22` } }} aria-label={`Select ${mood.label} mood`} role="button" tabIndex={0}>
                  <Typography variant="h2" sx={{ mb: 0.5 }}>{mood.emoji}</Typography>
                  <Typography variant="caption">{mood.label}</Typography>
                </Button>
              </motion.div>
            </Box>
          ))}
        </Box>
        {selectedMood && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>How intense is this feeling?</Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Chip key={level} label={level} onClick={() => setIntensity(level)} color={intensity === level ? 'primary' : 'default'} variant={intensity === level ? 'filled' : 'outlined'} sx={{ cursor: 'pointer' }} aria-label={`Intensity level ${level}`} role="radio" aria-checked={intensity === level} />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary" disabled={!selectedMood}>Log Mood</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmojiMoodSelector;
