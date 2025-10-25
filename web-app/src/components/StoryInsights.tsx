import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, Box, Chip, Alert } from '@mui/material';
import { TrendingUp, TrendingDown, Star, Award, Target, Heart } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';

interface StoryInsightsProps {
  userId?: string;
}

const StoryInsights: React.FC<StoryInsightsProps> = ({ userId }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    analytics.page('Story Insights', {
      component: 'StoryInsights',
      userId,
    });

    loadInsights();
  }, [userId]);

  const loadInsights = () => {
    // Mock insights data - replace with real API calls
    const mockInsights = [
      {
        id: '1',
        type: 'trend',
        title: 'Din Veckotrend',
        story: 'Du har haft en fantastisk vecka! Ditt humör har ökat med 15% jämfört med förra veckan. Detta visar på positiva förändringar i ditt välbefinnande.',
        trend: 'up',
        color: 'green',
        icon: TrendingUp,
        action: 'Se detaljer',
        badge: null,
      },
      {
        id: '2',
        type: 'achievement',
        title: 'Milstolpe Uppnådd!',
        story: 'Grattis! Du har nu loggat humör 50 dagar i rad. Det är en imponerande prestation som visar ditt engagemang för bättre mental hälsa.',
        trend: null,
        color: 'gold',
        icon: Award,
        action: 'Dela prestation',
        badge: '🏆',
      },
      {
        id: '3',
        type: 'recommendation',
        title: 'AI Rekommendation',
        story: 'Baserat på dina mönster rekommenderar vi att du provar mindfulness-övningar på morgonen. Detta kan hjälpa till att starta dagen på ett mer balanserat sätt.',
        trend: null,
        color: 'blue',
        icon: Heart,
        action: 'Prova nu',
        badge: null,
      },
      {
        id: '4',
        type: 'goal',
        title: 'Veckomål Nästan Klar',
        story: 'Du har 6 av 7 humör-inlägg denna vecka. Bara ett till för att nå ditt mål! Konsekvent spårning hjälper dig förstå dina mönster bättre.',
        trend: null,
        color: 'orange',
        icon: Target,
        action: 'Logga nu',
        badge: null,
      },
    ];

    setInsights(mockInsights);
    announceToScreenReader(`${mockInsights.length} insikter laddade`, 'polite');
  };

  const handleInsightAction = (insight: any) => {
    analytics.track('Insight Action Taken', {
      insight_id: insight.id,
      insight_type: insight.type,
      action: insight.action,
      component: 'StoryInsights',
    });

    // Handle different actions
    switch (insight.action) {
      case 'Se detaljer':
        // Navigate to detailed analytics
        break;
      case 'Dela prestation':
        // Open share dialog
        break;
      case 'Prova nu':
        // Navigate to mindfulness exercises
        break;
      case 'Logga nu':
        // Navigate to mood logger
        break;
    }

    announceToScreenReader(`Åtgärd utförd: ${insight.action}`, 'polite');
  };

  const getColorClasses = (color: string) => {
    const colors = {
      green: 'border-green-500 bg-green-50 dark:bg-green-900/20',
      gold: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
      blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      orange: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getIconColor = (color: string) => {
    const colors = {
      green: 'text-green-600',
      gold: 'text-yellow-600',
      blue: 'text-blue-600',
      orange: 'text-orange-600',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Dina Insikter
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Personliga berättelser om din mentala hälsa resa
        </p>
      </div>

      <div className="space-y-6">
        {insights.map((insight) => {
          const IconComponent = insight.icon;

          return (
            <Card
              key={insight.id}
              className={`border-l-4 ${getColorClasses(insight.color)} hover:shadow-lg transition-all duration-300`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon/Badge */}
                  <div className="flex-shrink-0">
                    {insight.badge ? (
                      <div className="text-4xl">{insight.badge}</div>
                    ) : (
                      <IconComponent className={`text-3xl ${getIconColor(insight.color)}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Typography variant="h6" className="font-semibold mb-1">
                          {insight.title}
                        </Typography>

                        {/* Trend indicator */}
                        {insight.trend && (
                          <div className="flex items-center gap-1 mb-2">
                            {insight.trend === 'up' ? (
                              <TrendingUp className="text-green-600 text-sm" />
                            ) : (
                              <TrendingDown className="text-red-600 text-sm" />
                            )}
                            <span className="text-sm text-gray-600">
                              {insight.trend === 'up' ? 'Trend uppåt' : 'Trend nedåt'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Type chip */}
                      <Chip
                        label={insight.type}
                        size="small"
                        variant="outlined"
                        className="capitalize"
                      />
                    </div>

                    {/* Story */}
                    <Typography variant="body1" className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                      {insight.story}
                    </Typography>

                    {/* Action button */}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleInsightAction(insight)}
                      className="hover:scale-105 transition-transform"
                    >
                      {insight.action}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card className="mt-8 bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Star className="text-yellow-300 text-2xl" />
            <Typography variant="h6" className="font-semibold">
              Din Hälsaresa Översikt
            </Typography>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">50</div>
              <div className="text-sm opacity-90">Dagar i rad</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">7.2</div>
              <div className="text-sm opacity-90">Genomsnittligt humör</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">23</div>
              <div className="text-sm opacity-90">AI-konversationer</div>
            </div>
          </div>

          <Alert severity="info" className="bg-white/10 text-white border-white/20">
            <Typography variant="body2">
              Du gör fantastiska framsteg! Fortsätt logga ditt humör regelbundet för att få ännu bättre insikter.
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="mt-8 text-center">
        <Typography variant="h6" gutterBottom>
          Vad vill du göra nu?
        </Typography>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="contained" startIcon={<Heart />}>
            Logga humör
          </Button>
          <Button variant="outlined" startIcon={<Star />}>
            Prata med AI
          </Button>
          <Button variant="outlined" startIcon={<TrendingUp />}>
            Se statistik
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryInsights;