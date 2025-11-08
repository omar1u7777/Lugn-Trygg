import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Chip, Button, LinearProgress, Avatar, Badge } from '@mui/material';
import { EmojiEvents, Star, TrendingUp, LocalFireDepartment, Psychology, Favorite } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { getMoods, getWeeklyAnalysis } from '../api/api';
import useAuth from '../hooks/useAuth';

interface GamificationProps {
  userId?: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
}

interface StreakData {
  current: number;
  longest: number;
  lastLogDate?: Date;
}

const Gamification = ({ userId }: GamificationProps) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streak, setStreakData] = useState<StreakData>({ current: 0, longest: 0 });
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpToNext, setXpToNext] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.page('Gamification', {
      component: 'Gamification',
      userId,
    });

    loadGamificationData();
  }, [userId, user]);

  const loadGamificationData = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load real data from backend APIs
      const [moodsData, weeklyAnalysisData] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
      ]);

      // Calculate achievements based on real data
      const totalMoods = moodsData.length;
      const streakDays = weeklyAnalysisData.streak_days || 0;
      const weeklyProgress = weeklyAnalysisData.weekly_progress || 0;

      // Calculate XP based on activities (10 XP per mood, 5 XP per chat, etc.)
      const baseXp = totalMoods * 10; // 10 XP per mood logged
      const streakBonus = streakDays * 5; // 5 XP per streak day
      const totalXp = baseXp + streakBonus;
      const currentLevel = Math.floor(totalXp / 100) + 1;
      const xpInLevel = totalXp % 100;
      const xpToNextLevel = 100 - xpInLevel;

      // Generate achievements based on real data
      const achievements: Achievement[] = [
        {
          id: 'first_mood',
          title: 'Första Steget',
          description: 'Logga ditt första humör',
          icon: '🎯',
          unlocked: totalMoods >= 1,
          progress: Math.min(totalMoods, 1),
          maxProgress: 1,
          rarity: 'common',
          unlockedAt: totalMoods >= 1 ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) : undefined,
        },
        {
          id: 'week_warrior',
          title: 'Veckokrigare',
          description: 'Logga humör 7 dagar i rad',
          icon: '⚔️',
          unlocked: streakDays >= 7,
          progress: Math.min(streakDays, 7),
          maxProgress: 7,
          rarity: 'rare',
          unlockedAt: streakDays >= 7 ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) : undefined,
        },
        {
          id: 'consistent_logger',
          title: 'Konsekvent Logger',
          description: 'Logga humör 30 dagar totalt',
          icon: '📅',
          unlocked: totalMoods >= 30,
          progress: Math.min(totalMoods, 30),
          maxProgress: 30,
          rarity: 'epic',
          unlockedAt: totalMoods >= 30 ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 1) : undefined,
        },
        {
          id: 'streak_master',
          title: 'Streakmästare',
          description: 'Uppnå 14 dagar i rad',
          icon: '🔥',
          unlocked: streakDays >= 14,
          progress: Math.min(streakDays, 14),
          maxProgress: 14,
          rarity: 'epic',
        },
        {
          id: 'legendary_logger',
          title: 'Legendarisk Logger',
          description: 'Logga humör 100 dagar totalt',
          icon: '👑',
          unlocked: totalMoods >= 100,
          progress: Math.min(totalMoods, 100),
          maxProgress: 100,
          rarity: 'legendary',
        },
      ];

      setAchievements(achievements);
      setStreakData({
        current: streakDays,
        longest: Math.max(streakDays, weeklyAnalysisData.longest_streak || 0),
        lastLogDate: moodsData.length > 0 ? new Date(moodsData[0].timestamp || Date.now()) : undefined
      });
      setLevel(currentLevel);
      setXp(totalXp);
      setXpToNext(xpToNextLevel);

      const unlockedCount = achievements.filter(a => a.unlocked).length;
      announceToScreenReader(`${unlockedCount} achievements unlocked`, 'polite');

    } catch (error) {
      console.error('Failed to load gamification data:', error);
      announceToScreenReader('Failed to load gamification data', 'assertive');

      // Set fallback data
      setAchievements([]);
      setStreakData({ current: 0, longest: 0 });
      setLevel(1);
      setXp(0);
      setXpToNext(100);
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'bg-gray-100 text-gray-800',
      rare: 'bg-blue-100 text-blue-800',
      epic: 'bg-purple-100 text-purple-800',
      legendary: 'bg-yellow-100 text-yellow-800',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'rare': return '💎';
      case 'epic': return '🌟';
      case 'legendary': return '👑';
      default: return '🏅';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Dina Prestationer 🏆
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Följ dina framsteg och lås upp nya badges
        </p>
      </div>

      {/* Level & XP Progress */}
      <Card className="mb-8 bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge badgeContent={level} color="secondary">
                <Avatar sx={{ width: 60, height: 60 }} className="bg-white/20">
                  <Star sx={{ fontSize: 30 }} />
                </Avatar>
              </Badge>
              <div>
                <Typography variant="h5" className="font-bold">
                  Nivå {level}
                </Typography>
                <Typography variant="body2" className="opacity-90">
                  {xp} / {xp + xpToNext} XP
                </Typography>
              </div>
            </div>

            <div className="text-right">
              <Typography variant="h6" className="font-bold">
                {Math.round((xp / (xp + xpToNext)) * 100)}% klart
              </Typography>
              <Typography variant="body2" className="opacity-90">
                {xpToNext} XP till nästa nivå
              </Typography>
            </div>
          </div>

          <LinearProgress
            variant="determinate"
            value={(xp / (xp + xpToNext)) * 100}
            className="h-3 rounded-full"
            sx={{
              backgroundColor: 'rgba(255,255,255,0.3)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'white',
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Current Streak */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              <LocalFireDepartment className="text-orange-500" sx={{ fontSize: 48 }} />
            </div>
            <div className="flex-1">
              <Typography variant="h6" gutterBottom>
                Nuvarande Streak
              </Typography>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <Typography variant="h4" className="font-bold text-orange-600">
                    {streak.current}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    dagar
                  </Typography>
                </div>
                <div className="text-center">
                  <Typography variant="h6" className="font-semibold">
                    {streak.longest}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    längst streak
                  </Typography>
                </div>
              </div>
            </div>
            <Chip
              label="Pågående! 🔥"
              color="warning"
              variant="filled"
            />
          </div>
        </CardContent>
      </Card>

      {/* Achievements Grid */}
      <div className="mb-8">
        <Typography variant="h5" gutterBottom className="flex items-center gap-2">
          <EmojiEvents />
          Dina Achievements
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                achievement.unlocked
                  ? 'border-2 border-green-200 bg-green-50 dark:bg-green-900/20'
                  : 'border border-gray-200'
              }`}
            >
              <CardContent className="p-6">
                {/* Rarity Badge */}
                <div className="absolute top-3 right-3">
                  <Chip
                    label={`${getRarityIcon(achievement.rarity)} ${achievement.rarity}`}
                    size="small"
                    className={`text-xs ${getRarityColor(achievement.rarity)}`}
                  />
                </div>

                {/* Achievement Icon */}
                <div className="text-center mb-4">
                  <div className={`text-5xl mb-2 ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
                    {achievement.icon}
                  </div>

                  {achievement.unlocked && (
                    <div className="absolute top-3 left-3">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Achievement Details */}
                <div className="text-center">
                  <Typography variant="h6" gutterBottom className={achievement.unlocked ? '' : 'text-gray-500'}>
                    {achievement.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className="mb-4">
                    {achievement.description}
                  </Typography>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Framsteg</span>
                      <span>{achievement.progress}/{achievement.maxProgress}</span>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={(achievement.progress / achievement.maxProgress) * 100}
                      className="h-2 rounded-full"
                      color={achievement.unlocked ? 'success' : 'primary'}
                    />
                  </div>

                  {/* Unlock Date */}
                  {achievement.unlocked && achievement.unlockedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Upplåst {achievement.unlockedAt.toLocaleDateString()}
                    </Typography>
                  )}

                  {/* Action Button for Incomplete */}
                  {!achievement.unlocked && (
                    <Button
                      variant="outlined"
                      size="small"
                      className="mt-3"
                      onClick={() => {
                        analytics.track('Achievement Action', {
                          achievementId: achievement.id,
                          component: 'Gamification',
                        });
                      }}
                    >
                      Fortsätt
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <Card>
        <CardContent className="p-6">
          <Typography variant="h6" gutterBottom className="flex items-center gap-2">
            <TrendingUp />
            Din Statistik
          </Typography>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Typography variant="h4" className="font-bold text-primary-600">
                {achievements.filter(a => a.unlocked).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upplåsta Achievements
              </Typography>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Typography variant="h4" className="font-bold text-secondary-600">
                {streak.longest}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Längsta Streak
              </Typography>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Typography variant="h4" className="font-bold text-success-600">
                {level}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nuvarande Nivå
              </Typography>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Typography variant="h4" className="font-bold text-warning-600">
                {xp}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total XP
              </Typography>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Motivational Message */}
      <Card className="mt-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <CardContent className="p-6 text-center">
          <Typography variant="h6" gutterBottom>
            Fortsätt din resa! 🌟
          </Typography>
          <Typography variant="body1" className="opacity-90">
            Varje liten steg räknas. Du gör fantastiska framsteg på din mentala häls resa.
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default Gamification;