import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Chip,
  Alert,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  Favorite,
  SentimentVeryDissatisfied,
  SentimentDissatisfied,
  SentimentNeutral,
  SentimentSatisfied,
  SentimentVerySatisfied,
  Close,
  Save,
  Psychology,
  SelfImprovement,
  MusicNote,
  Nature,
  Brightness6,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { logMood, analyzeText } from '../api/api';
import useAuth from '../hooks/useAuth';
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import '../styles/world-class-design.css';

interface WorldClassMoodLoggerProps {
  onClose: () => void;
}

interface MoodOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
  score: number;
  color: string;
  icon: React.ReactNode;
}

const WorldClassMoodLogger: React.FC<WorldClassMoodLoggerProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();

  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [moodText, setMoodText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const moodOptions: MoodOption[] = [
    {
      id: 'ecstatic',
      emoji: '🤩',
      label: 'Extatisk',
      description: 'Fantastiskt, överlycklig',
      score: 10,
      color: colors.mood.ecstatic,
      icon: <SentimentVerySatisfied />,
    },
    {
      id: 'happy',
      emoji: '😊',
      label: 'Glad',
      description: 'Positiv och nöjd',
      score: 8,
      color: colors.mood.happy,
      icon: <SentimentSatisfied />,
    },
    {
      id: 'content',
      emoji: '🙂',
      label: 'Nöjd',
      description: 'Fridfull och harmonisk',
      score: 7,
      color: colors.mood.content,
      icon: <SentimentNeutral />,
    },
    {
      id: 'neutral',
      emoji: '😐',
      label: 'Neutral',
      description: 'Varken upp eller ner',
      score: 5,
      color: colors.mood.neutral,
      icon: <SentimentNeutral />,
    },
    {
      id: 'sad',
      emoji: '😢',
      label: 'Ledsen',
      description: 'Nedstämd eller sorgsen',
      score: 3,
      color: colors.mood.anxious,
      icon: <SentimentDissatisfied />,
    },
    {
      id: 'anxious',
      emoji: '😰',
      label: 'Ångest',
      description: 'Orolig eller stressad',
      score: 2,
      color: colors.mood.sad,
      icon: <SentimentDissatisfied />,
    },
    {
      id: 'depressed',
      emoji: '😔',
      label: 'Deprimerad',
      description: 'Djupt nedstämd',
      score: 1,
      color: colors.mood.depressed,
      icon: <SentimentVeryDissatisfied />,
    },
  ];

  useEffect(() => {
    analytics.page('World Class Mood Logger', {
      component: 'WorldClassMoodLogger',
    });

    announceToScreenReader('Mood logger loaded. Select how you are feeling today.', 'polite');
  }, []);

  const handleMoodSelect = async (mood: MoodOption) => {
    setSelectedMood(mood);
    analytics.track('Mood Selected', {
      mood_id: mood.id,
      mood_score: mood.score,
      component: 'WorldClassMoodLogger',
    });

    // Auto-analyze if text is provided
    if (moodText.trim()) {
      await analyzeMoodText();
    }

    announceToScreenReader(`Selected mood: ${mood.label}`, 'polite');
  };

  const analyzeMoodText = async () => {
    if (!moodText.trim()) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeText(moodText);
      setAnalysis(result);
      announceToScreenReader('Text analysis completed', 'polite');
    } catch (error) {
      console.error('Analysis failed:', error);
      announceToScreenReader('Text analysis failed', 'polite');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedMood || !user?.user_id) return;

    setLoading(true);
    try {
      await logMood(user.user_id, moodText || selectedMood.label, selectedMood.score);

      analytics.track('Mood Logged', {
        mood_id: selectedMood.id,
        mood_score: selectedMood.score,
        has_text: !!moodText.trim(),
        component: 'WorldClassMoodLogger',
      });

      setSuccess(true);
      announceToScreenReader('Mood logged successfully!', 'polite');

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to log mood:', error);
      announceToScreenReader('Failed to log mood. Please try again.', 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = () => {
    if (!selectedMood) return [];

    const recommendations = [];

    if (selectedMood.score <= 3) {
      recommendations.push({
        icon: <Psychology />,
        text: 'Överväg att prata med en professionell terapeut',
        type: 'professional',
      });
      recommendations.push({
        icon: <SelfImprovement />,
        text: 'Prova guidad meditation för stressreduktion',
        type: 'meditation',
      });
    }

    if (selectedMood.score >= 7) {
      recommendations.push({
        icon: <MusicNote />,
        text: 'Lyssna på uppmuntrande musik för att behålla det positiva',
        type: 'music',
      });
    }

    recommendations.push({
      icon: <Nature />,
      text: 'Ta en promenad i naturen för bättre perspektiv',
      type: 'nature',
    });

    recommendations.push({
      icon: <Brightness6 />,
      text: 'Se till att få tillräckligt med sömn ikväll',
      type: 'sleep',
    });

    return recommendations;
  };

  if (success) {
    return (
      <Box className="world-class-success-celebration" sx={{ p: spacing.xl, textAlign: 'center' }}>
        <Typography variant="h4" className="world-class-heading-2" gutterBottom>
          🎉 Humör loggat!
        </Typography>
        <Typography variant="body1" className="world-class-body">
          Tack för att du delar dina känslor. Detta hjälper dig förstå dina mönster bättre.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="world-class-app"
      sx={{
        minHeight: '100vh',
        background: colors.background.gradient,
        p: spacing.md,
      }}
    >
      <Card className="world-class-dashboard-card" sx={{ maxWidth: 800, mx: 'auto' }}>
        <CardContent sx={{ p: spacing.xl }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.xl }}>
            <Typography variant="h4" className="world-class-heading-2">
              Hur känns det idag?
            </Typography>
            <IconButton onClick={onClose} aria-label="Close mood logger">
              <Close />
            </IconButton>
          </Box>

          {/* Mood Selection */}
          <Box sx={{ mb: spacing.xxl }}>
            <Typography variant="h6" className="world-class-heading-3" gutterBottom>
              Välj ditt humör
            </Typography>
            <Box className="world-class-mood-selector">
              {moodOptions.map((mood, index) => (
                <Box
                  key={mood.id}
                  className={`world-class-mood-option world-class-animate-fade-in-up ${
                    selectedMood?.id === mood.id ? 'selected' : ''
                  }`}
                  onClick={() => handleMoodSelect(mood)}
                  sx={{
                    animationDelay: `${index * 0.1}s`,
                    cursor: 'pointer',
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select mood: ${mood.label} - ${mood.description}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleMoodSelect(mood);
                    }
                  }}
                >
                  <Box className="world-class-mood-emoji" sx={{ fontSize: '3rem', mb: spacing.md }}>
                    {mood.emoji}
                  </Box>
                  <Typography variant="h6" className="world-class-mood-label">
                    {mood.label}
                  </Typography>
                  <Typography variant="body2" className="world-class-mood-description">
                    {mood.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Text Input */}
          <Box sx={{ mb: spacing.xxl }}>
            <Typography variant="h6" className="world-class-heading-3" gutterBottom>
              Berätta mer (valfritt)
            </Typography>
            <TextField
              multiline
              rows={4}
              fullWidth
              placeholder="Vad händer i ditt liv just nu? Hur påverkar det ditt humör?"
              value={moodText}
              onChange={(e) => setMoodText(e.target.value)}
              className="world-class-textarea"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: borderRadius.lg,
                }
              }}
            />

            {moodText.trim() && (
              <Button
                onClick={analyzeMoodText}
                disabled={isAnalyzing}
                sx={{ mt: spacing.md }}
                variant="outlined"
                startIcon={<Psychology />}
              >
                {isAnalyzing ? 'Analyserar...' : 'Analysera text'}
              </Button>
            )}
          </Box>

          {/* AI Analysis */}
          {analysis && (
            <Box sx={{ mb: spacing.xxl }}>
              <Alert severity="info" sx={{ borderRadius: borderRadius.lg }}>
                <Typography variant="h6" gutterBottom>
                  🤖 AI-analys
                </Typography>
                <Typography variant="body2">
                  {analysis.emotion || 'Din text visar på följande känslor:'}
                  {analysis.sentiment && (
                    <Chip
                      label={analysis.sentiment}
                      size="small"
                      sx={{ ml: spacing.sm }}
                      color={analysis.sentiment === 'POSITIVE' ? 'success' : 'warning'}
                    />
                  )}
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Recommendations */}
          {selectedMood && (
            <Box sx={{ mb: spacing.xxl }}>
              <Typography variant="h6" className="world-class-heading-3" gutterBottom>
                💡 Rekommendationer
              </Typography>
              <Grid container spacing={spacing.md / 8}>
                {getRecommendations().map((rec, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Card
                      sx={{
                        p: spacing.md,
                        borderRadius: borderRadius.md,
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: shadows.md,
                          transform: 'translateY(-2px)',
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                        <Box sx={{ color: 'primary.main' }}>
                          {rec.icon}
                        </Box>
                        <Typography variant="body2">
                          {rec.text}
                        </Typography>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Save Button */}
          <Box sx={{ textAlign: 'center' }}>
            <Button
              onClick={handleSave}
              disabled={!selectedMood || loading}
              className="world-class-btn-primary"
              size="large"
              startIcon={<Save />}
              sx={{
                px: spacing.xxl,
                py: spacing.md,
                fontSize: '1.1rem',
                borderRadius: borderRadius.xl,
              }}
            >
              {loading ? 'Sparar...' : 'Spara humör'}
            </Button>

            {loading && (
              <Box sx={{ mt: spacing.md }}>
                <LinearProgress sx={{ borderRadius: borderRadius.md, height: 8 }} />
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WorldClassMoodLogger;