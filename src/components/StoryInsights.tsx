import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, Box, Chip, Alert } from '@mui/material';
import { TrendingUp, TrendingDown, Star, EmojiEvents, TrackChanges, Favorite } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { getMoods, getWeeklyAnalysis, getChatHistory } from '../api/api';
import useAuth from '../hooks/useAuth';

interface StoryInsightsProps {
  userId?: string;
}

const StoryInsights = ({ userId }: StoryInsightsProps) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.page('Story Insights', {
      component: 'StoryInsights',
      userId,
    });

    loadInsights();
  }, [userId, user]);

  const loadInsights = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load real data from backend APIs
      const [moodsData, weeklyAnalysisData, chatHistoryData] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
        getChatHistory(user.user_id).catch(() => []),
      ]);

      // Calculate insights based on real data
      const totalMoods = moodsData.length;
      const streakDays = weeklyAnalysisData.streak_days || 0;
      const weeklyProgress = weeklyAnalysisData.weekly_progress || 0;
      const weeklyGoal = weeklyAnalysisData.weekly_goal || 7;
      const totalChats = chatHistoryData.length;

      // Calculate average mood
      const averageMood = totalMoods > 0
        ? moodsData.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / totalMoods
        : 0;

      // Generate dynamic insights based on real data
      const insights: any[] = [];

      // Weekly trend insight
      if (totalMoods >= 7) {
        const recentMoods = moodsData.slice(0, 7);
        const avgRecent = recentMoods.reduce((sum: number, mood: any) => sum + (mood.score || 0), 0) / recentMoods.length;
        const trend = avgRecent > averageMood ? 'up' : 'down';

        insights.push({
          id: 'weekly-trend',
          type: 'trend',
          title: 'Din Veckotrend',
          story: `Du har haft ${trend === 'up' ? 'en positiv' : 'en utmanande'} vecka! Ditt genomsnittliga humör är ${avgRecent.toFixed(1)}/10. ${trend === 'up' ? 'Fortsätt det goda arbetet!' : 'Kom ihåg att varje dag är en ny möjlighet.'}`,
          trend,
          color: trend === 'up' ? 'green' : 'orange',
          icon: trend === 'up' ? TrendingUp : TrendingDown,
          action: 'Se detaljer',
          badge: null,
        });
      }

      // Achievement insight
      if (streakDays >= 7) {
        insights.push({
          id: 'streak-achievement',
          type: 'achievement',
          title: 'Streak-prestation!',
          story: `Fantastiskt! Du har loggat humör ${streakDays} dagar i rad. Detta visar på ett starkt engagemang för din mentala hälsa.`,
          trend: null,
          color: 'gold',
          icon: EmojiEvents,
          action: 'Dela prestation',
          badge: '🔥',
        });
      }

      // Goal progress insight
      if (weeklyProgress < weeklyGoal) {
        insights.push({
          id: 'goal-progress',
          type: 'goal',
          title: 'Veckomål på gång',
          story: `Du har ${weeklyProgress} av ${weeklyGoal} humör-inlägg denna vecka. ${weeklyGoal - weeklyProgress} till kvar för att nå ditt mål!`,
          trend: null,
          color: 'orange',
          icon: TrackChanges,
          action: 'Logga nu',
          badge: null,
        });
      }

      // AI interaction insight
      if (totalChats > 0) {
        insights.push({
          id: 'ai-interaction',
          type: 'recommendation',
          title: 'AI-stöd tillgängligt',
          story: `Du har haft ${totalChats} konversationer med AI-terapeuten. AI:n har lärt sig dina mönster och kan ge personliga råd.`,
          trend: null,
          color: 'blue',
          icon: Favorite,
          action: 'Prata med AI',
          badge: null,
        });
      }

      // First mood insight for new users
      if (totalMoods === 1) {
        insights.push({
          id: 'welcome-insight',
          type: 'recommendation',
          title: 'Välkommen till din resa!',
          story: 'Bra jobbat med ditt första humör-inlägg! Konsekvent spårning hjälper dig förstå dina mönster och förbättra ditt välbefinnande.',
          trend: null,
          color: 'blue',
          icon: Star,
          action: 'Fortsätt logga',
          badge: '🎯',
        });
      }

      setInsights(insights);
      announceToScreenReader(`${insights.length} insikter laddade`, 'polite');

    } catch (error) {
      console.error('Failed to load insights:', error);
      announceToScreenReader('Failed to load insights', 'assertive');

      // Set fallback insights
      setInsights([]);
    } finally {
      setLoading(false);
    }
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
              <div className="text-2xl font-bold">{streakDays || 0}</div>
              <div className="text-sm opacity-90">Dagar i rad</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{averageMood.toFixed(1)}</div>
              <div className="text-sm opacity-90">Genomsnittligt humör</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalChats || 0}</div>
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
          <Button variant="contained" startIcon={<Favorite />}>
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