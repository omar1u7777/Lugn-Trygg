import React, { useEffect, useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { Box, Button, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { analyzeText } from '../api/api';

type AnalysisResult = {
  sentiment: string;
  score: number;
  emotions: string[];
  intensity?: number;
};

const MoodAnalyzer: React.FC = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // lightweight client-side hinting or local analysis could be added here
  }, []);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeText(text);

      setResult({
        sentiment: data.sentiment || data.sentiment_label || 'NEUTRAL',
        score: typeof data.score === 'number' ? data.score : Number(data.sentiment_score || 0),
        emotions: data.emotions || data.emotions_detected || [],
        intensity: data.intensity
      });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 720, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h6">Mood Analyzer</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.md }}>
          Paste a short text about how you're feeling and get a quick sentiment analysis.
        </Typography>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          style={{ width: '100%', padding: 8, fontSize: 14 }}
          aria-label="Beskriv hur du känner dig"
        />

        <Box sx={{ mt: spacing.md, display: 'flex', gap: spacing.md, alignItems: 'center' }}>
          <Button variant="contained" onClick={analyze} disabled={!text || loading}>
            Analyze
          </Button>
          {loading && <CircularProgress size={20} />}
        </Box>

        {error && (
          <Typography color="error" sx={{ mt: spacing.md }}>
            {error}
          </Typography>
        )}

        {result && (
          <Box sx={{ mt: spacing.lg }}>
            <Typography variant="subtitle1">Result</Typography>
            <Typography>Sentiment: {result.sentiment}</Typography>
            <Typography>Score: {result.score.toFixed(2)}</Typography>
            <Typography>Emotions: {result.emotions.join(', ') || 'none detected'}</Typography>
            <Typography>Intensity: {result.intensity ?? 'n/a'}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MoodAnalyzer;
