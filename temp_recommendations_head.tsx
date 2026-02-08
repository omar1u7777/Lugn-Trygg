import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { Card, CardContent, Typography, Button, Box, Chip, Avatar, Rating } from '@mui/material';
import { Lightbulb, ThumbUp, ThumbDown, Bookmark, Share, PlayArrow } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';

interface RecommendationsProps {
  userId?: string;
}

interface Recommendation {
  id: string;
  type: 'exercise' | 'article' | 'meditation' | 'challenge' | 'insight';
  title: string;
  description: string;
  content: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration?: number; // in minutes
  rating?: number;
  completed?: boolean;
  saved?: boolean;
  image?: string;
  category: string;
}

const Recommendations: React.FC<RecommendationsProps> = ({ userId }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>(['mindfulness', 'stress', 'anxiety']);

  useEffect(() => {
    analytics.page('Recommendations', {
      component: 'Recommendations',
      userId,
    });

    loadRecommendations();
  }, [userId]);

  const loadRecommendations = () => {
    // Mock personalized recommendations based on user data
    const mockRecommendations: Recommendation[] = [
      {
        id: '1',
        type: 'meditation',
        title: '4-7-8 Andningsövning',
        description: 'En kraftfull teknik för att minska stress och förbättra sömn',
        content: 'Denna enkla andningsövning tar bara 4 minuter och kan hjälpa dig att lugna ner dig snabbt.',
        tags: ['andning', 'stress', 'sömn', 'snabb'],
        difficulty: 'beginner',
        duration: 4,
        rating: 4.8,
        category: 'Andning',
        image: '🫁',
      },
      {
        id: '2',
        type: 'exercise',
        title: 'KBT-övning: Kognitiva Förvrängningar',
        description: 'Identifiera och utmana negativa tankemönster',
        content: 'Lär dig att känna igen vanliga tankefällor och hur du kan utmana dem för bättre mental hälsa.',
        tags: ['kbt', 'tankar', 'negativa', 'kognitiv'],
        difficulty: 'intermediate',
        duration: 15,
        rating: 4.6,
        category: 'KBT',
        image: '🧠',
      },
      {
        id: '3',
        type: 'article',
        title: 'Varför Sömn är Nyckeln till Mental Hälsa',
        description: 'Förstå sambandet mellan sömn och ditt psykiska välbefinnande',
        content: 'Vetenskapliga studier visar att sömn inte bara påverkar din energi utan också din mentala hälsa.',
        tags: ['sömn', 'vetenskap', 'hälsa', 'energi'],
        difficulty: 'beginner',
        duration: 5,
        rating: 4.9,
        category: 'Utbildning',
        image: '📚',
      },
      {
        id: '4',
        type: 'challenge',
        title: '7-Dagars Tacksamhetsutmaning',
        description: 'Utveckla en mer positiv syn genom daglig tacksamhet',
        content: 'Skriv ner tre saker du är tacksam för varje dag i en vecka.',
        tags: ['tacksamhet', 'positivitet', 'utmaning', 'dagbok'],
        difficulty: 'beginner',
        duration: 5,
        rating: 4.7,
        category: 'Utmaningar',
        image: '🙏',
      },
      {
        id: '5',
        type: 'insight',
        title: 'Din Humörtrend Analys',
        description: 'Personlig analys av dina humörmönster',
        content: 'Baserat på dina senaste loggningar visar dina mönster en förbättring på 15% jämfört med förra veckan.',
        tags: ['analys', 'trender', 'förbättring', 'insikter'],
        difficulty: 'intermediate',
        category: 'Insikter',
        image: '📊',
      },
    ];

    setRecommendations(mockRecommendations);
    announceToScreenReader(`${mockRecommendations.length} personalized recommendations loaded`, 'polite');
  };

  const handleRecommendationAction = (recommendation: Recommendation, action: 'start' | 'save' | 'share' | 'feedback') => {
    analytics.track('Recommendation Action', {
      recommendationId: recommendation.id,
      recommendationType: recommendation.type,
      action,
      component: 'Recommendations',
    });

    switch (action) {
      case 'start':
        // Navigate to content or start exercise
        break;
      case 'save':
        setRecommendations(prev =>
          prev.map(r =>
            r.id === recommendation.id ? { ...r, saved: !r.saved } : r
          )
        );
        break;
      case 'share':
        // Open share dialog
        break;
      case 'feedback':
        // Handle feedback
        break;
    }

    announceToScreenReader(`Action ${action} performed on ${recommendation.title}`, 'polite');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'meditation': return '🧘';
      case 'exercise': return '💪';
      case 'article': return '📖';
      case 'challenge': return '🎯';
      case 'insight': return '💡';
      default: return '📋';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Personliga Rekommendationer 💡
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Innehåll anpassat efter dina behov och framsteg
        </p>
      </div>

      {/* User Preferences */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <Typography variant="h6" gutterBottom>
            Dina Intressen
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {userPreferences.map((pref, index) => (
              <Chip
                key={index}
                label={pref}
                variant="outlined"
                color="primary"
                size="small"
              />
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary" className="mt-2">
            Vi anpassar rekommendationer baserat på dina intressen och aktivitet
          </Typography>
        </CardContent>
      </Card>

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {recommendations.map((recommendation) => (
          <Card
            key={recommendation.id}
            className="hover:shadow-lg transition-all duration-300 group"
          >
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{recommendation.image || getTypeIcon(recommendation.type)}</div>
                  <div>
                    <Chip
                      label={recommendation.category}
                      size="small"
                      variant="outlined"
                      className="mb-1"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {recommendation.type}
                    </Typography>
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    size="small"
                    onClick={() => handleRecommendationAction(recommendation, 'save')}
                    className={recommendation.saved ? 'text-yellow-600' : ''}
                  >
                    <Bookmark fontSize="small" />
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleRecommendationAction(recommendation, 'share')}
                  >
                    <Share fontSize="small" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="mb-4">
                <Typography variant="h6" gutterBottom className="line-clamp-2">
                  {recommendation.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" className="mb-3 line-clamp-3">
                  {recommendation.description}
                </Typography>

                {/* Tags */}
                <Box display="flex" flexWrap="wrap" gap={0.5} mb={3}>
                  {recommendation.tags.slice(0, 3).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      variant="outlined"
                      className="text-xs"
                    />
                  ))}
                </Box>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-3">
                    <Chip
                      label={recommendation.difficulty}
                      size="small"
                      color={getDifficultyColor(recommendation.difficulty)}
                      variant="filled"
                    />
                    {recommendation.duration && (
                      <span>{recommendation.duration} min</span>
                    )}
                  </div>

                  {recommendation.rating && (
                    <div className="flex items-center gap-1">
                      <Rating value={recommendation.rating} readOnly size="small" />
                      <span className="text-xs">({recommendation.rating})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<PlayArrow />}
                  onClick={() => handleRecommendationAction(recommendation, 'start')}
                  className="group-hover:scale-105 transition-transform"
                >
                  {recommendation.type === 'meditation' ? 'Starta' :
                   recommendation.type === 'exercise' ? 'Börja' :
                   recommendation.type === 'article' ? 'Läs' :
                   recommendation.type === 'challenge' ? 'Påbörja' : 'Utforska'}
                </Button>
              </div>

              {/* Feedback */}
              <div className="flex justify-center gap-2 mt-3">
                <Button
                  size="small"
                  startIcon={<ThumbUp />}
                  onClick={() => handleRecommendationAction(recommendation, 'feedback')}
                  className="text-green-600"
                >
                  Hjälpsam
                </Button>
                <Button
                  size="small"
                  startIcon={<ThumbDown />}
                  onClick={() => handleRecommendationAction(recommendation, 'feedback')}
                  className="text-red-600"
                >
                  Inte relevant
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Inspiration */}
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <CardContent className="p-6 text-center">
          <Lightbulb sx={{ fontSize: 48, mb: spacing.md, opacity: 0.8 }} />
          <Typography variant="h6" gutterBottom>
            Dagens Inspiration
          </Typography>
          <Typography variant="body1" className="mb-4 opacity-90">
            "Varje dag är en ny möjlighet att ta hand om din mentala hälsa.
            Små steg leder till stora förändringar."
          </Typography>
          <Button variant="outlined" className="border-white text-white hover:bg-white hover:text-purple-600">
            Få Dagliga Påminnelser
          </Button>
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <Typography variant="h6" gutterBottom>
            Dina Framsteg Denna Vecka
          </Typography>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Typography variant="h4" className="font-bold text-blue-600">
                3
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Övningar Gjorda
              </Typography>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Typography variant="h4" className="font-bold text-green-600">
                12
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Minuter Meditation
              </Typography>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Typography variant="h4" className="font-bold text-purple-600">
                2
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Artiklar Lästa
              </Typography>
            </div>

            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <Typography variant="h4" className="font-bold text-orange-600">
                85%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Mål Uppnått
              </Typography>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Recommendations;
