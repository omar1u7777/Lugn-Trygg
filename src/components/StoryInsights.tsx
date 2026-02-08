import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, Chip, Alert } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { getMoods, getWeeklyAnalysis, getChatHistory } from '../api/api';
import useAuth from '../hooks/useAuth';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  HeartIcon,
  StarIcon,
  FireIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

interface StoryInsightsProps {
  userId?: string;
}

const StoryInsights = ({ userId }: StoryInsightsProps) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    streakDays: 0,
    averageMood: 0,
    totalChats: 0,
  });

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
          icon:
            trend === 'up' ? <ArrowTrendingUpIcon className="w-6 h-6" /> : <ArrowTrendingDownIcon className="w-6 h-6" />,
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
          icon: <FireIcon className="w-6 h-6" />,
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
          icon: <BoltIcon className="w-6 h-6" />,
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
          icon: <ChatBubbleLeftRightIcon className="w-6 h-6" />,
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
          icon: <StarIcon className="w-6 h-6" />,
          action: 'Fortsätt logga',
          badge: '🎯',
        });
      }

      setInsights(insights);
      setSummary({
        streakDays,
        averageMood,
        totalChats,
      });
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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        </div>
      );
    }

    if (!user?.user_id) {
      return (
        <Alert variant="warning">
          {t('insights.loginRequired', 'Logga in för att visa dina berättelseinsikter.')}
        </Alert>
      );
    }

    if (insights.length === 0) {
      return (
        <Alert variant="info">
          {t('insights.noData', 'Logga fler humör eller prata med AI-terapeuten för att få insikter.')}
        </Alert>
      );
    }

    return (
      <div className="space-y-6">
        {insights.map((insight) => (
          <Card
            key={insight.id}
            className={`border-l-4 ${getColorClasses(insight.color)} hover:shadow-lg transition-all duration-300`}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {insight.badge ? (
                    <div className="text-4xl">{insight.badge}</div>
                  ) : (
                    <div className={`text-3xl ${getIconColor(insight.color)}`}>{insight.icon}</div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Typography variant="h6" className="font-semibold mb-1">
                        {insight.title}
                      </Typography>

                      {insight.trend && (
                        <div className="flex items-center gap-1 mb-2">
                          {insight.trend === 'up' ? (
                            <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                          ) : (
                            <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-600">
                            {insight.trend === 'up' ? 'Trend uppåt' : 'Trend nedåt'}
                          </span>
                        </div>
                      )}
                    </div>

                    <Chip label={insight.type} size="small" variant="outline" className="capitalize" />
                  </div>

                  <Typography variant="body1" className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                    {insight.story}
                  </Typography>

                  <Button
                    variant="outline"
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
        ))}
      </div>
    );
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

      {renderContent()}

      {/* Summary Card */}
      <Card className="mt-8 bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <StarIcon className="text-yellow-300 w-6 h-6" />
            <Typography variant="h6" className="font-semibold">
              Din Hälsaresa Översikt
            </Typography>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.streakDays}</div>
              <div className="text-sm opacity-90">Dagar i rad</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.averageMood.toFixed(1)}</div>
              <div className="text-sm opacity-90">Genomsnittligt humör</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.totalChats}</div>
              <div className="text-sm opacity-90">AI-konversationer</div>
            </div>
          </div>

          <Alert variant="info" className="bg-white/10 text-white border-white/20">
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
          <Button variant="primary" startIcon={<HeartIcon className="w-5 h-5" />}>
            Logga humör
          </Button>
          <Button variant="outline" startIcon={<StarIcon className="w-5 h-5" />}>
            Prata med AI
          </Button>
          <Button variant="outline" startIcon={<ArrowTrendingUpIcon className="w-5 h-5" />}>
            Se statistik
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryInsights;
