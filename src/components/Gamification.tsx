import { useState, useEffect, useCallback } from 'react'
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { getMoods, getWeeklyAnalysis } from '../api/api';
import useAuth from '../hooks/useAuth';
import { ArrowTrendingUpIcon, StarIcon, TrophyIcon, FireIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Card } from './ui/tailwind';

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
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streak, setStreakData] = useState<StreakData>({ current: 0, longest: 0 });
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpToNext, setXpToNext] = useState(100);

  const loadGamificationData = useCallback(async () => {
    if (!user?.user_id) {
      return;
    }

    try {
      // Load real data from backend APIs
      const [moodsData, weeklyAnalysisData] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getWeeklyAnalysis(user.user_id).catch(() => ({})),
      ]);

      // Calculate achievements based on real data
      const totalMoods = moodsData.length;
      const streakDays = weeklyAnalysisData.streak_days || 0;

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
    }
  }, [announceToScreenReader, user]);

  useEffect(() => {
    analytics.page('Gamification', {
      component: 'Gamification',
      userId,
    });

    loadGamificationData();
  }, [loadGamificationData, userId]);

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
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <StarIcon className="w-8 h-8" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-secondary-500 rounded-full flex items-center justify-center text-xs font-bold">
                  {level}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  Nivå {level}
                </h2>
                <p className="text-sm opacity-90">
                  {xp} / {xp + xpToNext} XP
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xl font-bold mb-1">
                {Math.round((xp / (xp + xpToNext)) * 100)}% klart
              </p>
              <p className="text-sm opacity-90">
                {xpToNext} XP till nästa nivå
              </p>
            </div>
          </div>

          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${(xp / (xp + xpToNext)) * 100}%` }}
              role="progressbar"
              aria-valuenow={(xp / (xp + xpToNext)) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
            ></div>
          </div>
        </div>
      </Card>

      {/* Current Streak */}
      <Card className="mb-8">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl">
              <FireIcon className="w-16 h-16 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Nuvarande Streak
              </h3>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-orange-600 dark:text-orange-500 mb-1">
                    {streak.current}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    dagar
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                    {streak.longest}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    längst streak
                  </p>
                </div>
              </div>
            </div>
            <span className="px-4 py-2 bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300 rounded-full font-medium text-sm">
              Pågående! 🔥
            </span>
          </div>
        </div>
      </Card>

      {/* Achievements Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <TrophyIcon className="w-7 h-7 text-primary-600 dark:text-primary-500" />
          Dina Achievements
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                achievement.unlocked
                  ? 'border-2 border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                  : 'border border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="p-6">
                {/* Rarity Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRarityColor(achievement.rarity)}`}>
                    {getRarityIcon(achievement.rarity)} {achievement.rarity}
                  </span>
                </div>

                {/* Achievement Icon */}
                <div className="text-center mb-4">
                  <div className={`text-5xl mb-2 ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
                    {achievement.icon}
                  </div>

                  {achievement.unlocked && (
                    <div className="absolute top-3 left-3">
                      <div className="w-6 h-6 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Achievement Details */}
                <div className="text-center">
                  <h3 className={`text-xl font-semibold mb-2 ${achievement.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {achievement.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {achievement.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Framsteg</span>
                      <span className="font-medium text-gray-900 dark:text-white">{achievement.progress}/{achievement.maxProgress}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          achievement.unlocked ? 'bg-green-500' : 'bg-primary-600'
                        }`}
                        style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                        role="progressbar"
                        aria-valuenow={(achievement.progress / achievement.maxProgress) * 100}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      ></div>
                    </div>
                  </div>

                  {/* Unlock Date */}
                  {achievement.unlocked && achievement.unlockedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Upplåst {achievement.unlockedAt.toLocaleDateString()}
                    </p>
                  )}

                  {/* Action Button for Incomplete */}
                  {!achievement.unlocked && (
                    <button
                      className="mt-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        analytics.track('Achievement Action', {
                          achievementId: achievement.id,
                          component: 'Gamification',
                        });
                      }}
                    >
                      Fortsätt
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-6 h-6 text-primary-600 dark:text-primary-500" />
            Din Statistik
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-4xl font-bold text-primary-600 dark:text-primary-500 mb-2">
                {achievements.filter(a => a.unlocked).length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upplåsta Achievements
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-4xl font-bold text-secondary-600 dark:text-secondary-500 mb-2">
                {streak.longest}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Längsta Streak
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-4xl font-bold text-success-600 dark:text-success-500 mb-2">
                {level}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nuvarande Nivå
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-4xl font-bold text-warning-600 dark:text-warning-500 mb-2">
                {xp}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total XP
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Motivational Message */}
      <Card className="mt-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <div className="p-6 text-center">
          <h3 className="text-xl font-semibold mb-2">
            Fortsätt din resa! 🌟
          </h3>
          <p className="opacity-90">
            Varje liten steg räknas. Du gör fantastiska framsteg på din mentala häls resa.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Gamification;

