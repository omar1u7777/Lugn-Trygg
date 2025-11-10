import React, { useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Rating,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Stack
} from '@mui/material';
import { Feedback, Send, CheckCircle } from '@mui/icons-material';
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

interface FeedbackData {
  rating: number;
  category: string;
  message: string;
  feature_request?: string | undefined;
  bug_report?: string | undefined;
}

const FeedbackSystem: React.FC<{ userId: string }> = ({ userId }) => {
  const [rating, setRating] = useState<number>(0);
  const [category, setCategory] = useState<string>('general');
  const [message, setMessage] = useState('');
  const [featureRequest, setFeatureRequest] = useState('');
  const [bugReport, setBugReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please provide a rating');
      return;
    }

    if (!message && !featureRequest && !bugReport) {
      setError('Please provide some feedback');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const feedbackData: FeedbackData = {
        rating,
        category,
        message,
        feature_request: featureRequest || undefined,
        bug_report: bugReport || undefined
      };

      await api.post('/api/feedback/submit', {
        user_id: userId,
        ...feedbackData,
        timestamp: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(true);
      // Reset form
      setRating(0);
      setCategory('general');
      setMessage('');
      setFeatureRequest('');
      setBugReport('');

      setTimeout(() => setSuccess(false), 5000);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const quickFeedbackTags = [
    'Easy to use',
    'Helpful insights',
    'Great design',
    'Bug found',
    'Feature request',
    'Slow performance',
    'Love it!',
    'Confusing UI'
  ];

  const addQuickTag = (tag: string) => {
    setMessage((prev) => (prev ? `${prev}, ${tag}` : tag));
  };

  return (
    <Card sx={{ maxWidth: 700, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Feedback color="primary" />
          Send Feedback
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.lg }}>
          Your feedback helps us improve Lugn & Trygg. Share your thoughts, report bugs, or suggest new features.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: spacing.md }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: spacing.md }}>
            Thank you for your feedback! We'll review it and use it to improve the app.
          </Alert>
        )}

        {/* Rating */}
        <Box sx={{ mb: spacing.lg }}>
          <Typography variant="subtitle1" gutterBottom>
            How would you rate your experience?
          </Typography>
          <Rating
            name="user-rating"
            value={rating}
            onChange={(_, newValue) => setRating(newValue || 0)}
            size="large"
          />
        </Box>

        {/* Category */}
        <FormControl component="fieldset" sx={{ mb: spacing.lg }}>
          <FormLabel component="legend">Feedback Category</FormLabel>
          <RadioGroup
            row
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <FormControlLabel value="general" control={<Radio />} label="General" />
            <FormControlLabel value="bug" control={<Radio />} label="Bug Report" />
            <FormControlLabel value="feature" control={<Radio />} label="Feature Request" />
            <FormControlLabel value="ui" control={<Radio />} label="UI/UX" />
          </RadioGroup>
        </FormControl>

        {/* Quick Tags */}
        <Box sx={{ mb: spacing.lg }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Tags (click to add)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {quickFeedbackTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onClick={() => addQuickTag(tag)}
                variant="outlined"
                size="small"
                sx={{ mb: spacing.sm }}
              />
            ))}
          </Stack>
        </Box>

        {/* General Message */}
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Your Feedback"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what you think..."
          sx={{ mb: spacing.lg }}
        />

        {/* Bug Report (conditional) */}
        {category === 'bug' && (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Bug Details"
            value={bugReport}
            onChange={(e) => setBugReport(e.target.value)}
            placeholder="Describe the bug: What happened? What did you expect? Steps to reproduce?"
            sx={{ mb: spacing.lg }}
          />
        )}

        {/* Feature Request (conditional) */}
        {category === 'feature' && (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Feature Request"
            value={featureRequest}
            onChange={(e) => setFeatureRequest(e.target.value)}
            placeholder="Describe the feature you'd like to see and why it would be helpful..."
            sx={{ mb: spacing.lg }}
          />
        )}

        {/* Submit Button */}
        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<Send />}
          onClick={handleSubmit}
          disabled={loading || success}
        >
          {loading ? 'Sending...' : success ? 'Sent!' : 'Send Feedback'}
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ mt: spacing.md, display: 'block', textAlign: 'center' }}>
          💙 We read every piece of feedback and use it to make Lugn & Trygg better for everyone.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default FeedbackSystem;
