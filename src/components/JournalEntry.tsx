/**
 * Journal Entry Component
 * Text-based mood logging with guided prompts
 */

import React, { useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Button,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Paper,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../services/analytics';

interface JournalEntryProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (entry: { text: string; prompt: string; tags: string[] }) => void;
  userId?: string;
}

const JOURNAL_PROMPTS = [
  'What made you smile today?',
  'What challenged you today?',
  'What are you grateful for right now?',
  'How did you take care of yourself today?',
  'What emotions did you feel most today?',
  'What would you like to let go of?',
  'What are you looking forward to?',
];

const MOOD_TAGS = [
  'Happy',
  'Sad',
  'Anxious',
  'Calm',
  'Grateful',
  'Stressed',
  'Energetic',
  'Tired',
  'Hopeful',
  'Overwhelmed',
];

export const JournalEntry: React.FC<JournalEntryProps> = ({
  open,
  onClose,
  onSubmit,
  userId,
}) => {
  const { t } = useTranslation();
  const [journalText, setJournalText] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setJournalText(text);
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  };

  const handlePromptClick = (prompt: string) => {
    setSelectedPrompt(prompt);
    if (!journalText) {
      setJournalText(`${prompt}\n\n`);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (journalText.trim()) {
      onSubmit({
        text: journalText,
        prompt: selectedPrompt,
        tags: selectedTags,
      });

      // Track analytics
      trackEvent('journal_entry_submitted', {
        userId,
        wordCount,
        tagsCount: selectedTags.length,
        hasPrompt: !!selectedPrompt,
      });

      // Reset form
      setJournalText('');
      setSelectedPrompt('');
      setSelectedTags([]);
      setWordCount(0);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="journal-entry-dialog"
    >
      <DialogTitle id="journal-entry-dialog">
        {t('journal.title', 'Journal Entry')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: spacing.lg }}>
          <Typography variant="body2" gutterBottom>
            {t('journal.promptLabel', 'Need inspiration? Try a prompt:')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, mt: spacing.sm }}>
            {JOURNAL_PROMPTS.map((prompt, index) => (
              <Chip
                key={index}
                label={prompt}
                onClick={() => handlePromptClick(prompt)}
                color={selectedPrompt === prompt ? 'primary' : 'default'}
                variant={selectedPrompt === prompt ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
                size="small"
              />
            ))}
          </Box>
        </Box>

        <TextField
          multiline
          rows={8}
          fullWidth
          variant="outlined"
          placeholder={t('journal.placeholder', 'Write your thoughts here...')}
          value={journalText}
          onChange={handleTextChange}
          aria-label="Journal text entry"
          sx={{ mb: spacing.md }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.md }}>
          <Typography variant="caption" color="text.secondary">
            {t('journal.wordCount', `${wordCount} words`)}
          </Typography>
        </Box>

        <Box>
          <Typography variant="body2" gutterBottom>
            {t('journal.tagsLabel', 'Tag your emotions:')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            {MOOD_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onClick={() => handleTagToggle(tag)}
                color={selectedTags.includes(tag) ? 'primary' : 'default'}
                variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
                size="small"
              />
            ))}
          </Box>
        </Box>

        {journalText.length > 50 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Paper
              elevation={1}
              sx={{
                mt: spacing.md,
                p: spacing.md,
                backgroundColor: '#E3F2FD',
                borderLeft: '4px solid #2196F3',
              }}
            >
              <Typography variant="body2">
                💡 <strong>Tip:</strong> Writing about your emotions can help you process and understand them better.
              </Typography>
            </Paper>
          </motion.div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!journalText.trim()}
        >
          {t('journal.save', 'Save Entry')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default JournalEntry;
