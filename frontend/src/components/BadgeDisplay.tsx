import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getMoods } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Avatar,
  Badge as MuiBadge,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Whatshot as StreakIcon,
  Star as StarIcon,
  Psychology as MindIcon,
  Favorite as HeartIcon,
  TrendingUp as TrendingIcon,
  CheckCircle as CheckIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  streak: number;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress?: number;
  maxProgress?: number;
}

const BadgeDisplay: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateBadges = async () => {
      if (!user?.user_id) return;

      try {
        const moods = await getMoods(user.user_id);
        const currentStreak = calculateCurrentStreak(moods);
        const longestStreak = calculateLongestStreak(moods);
        const totalEntries = moods.length;

        const badgeList: Badge[] = [
          {
            id: 'first-entry',
            title: t('badges.firstEntry.title', 'First Step'),
            description: t('badges.firstEntry.desc', 'Logged your first mood'),
            icon: '🎯',
            earned: totalEntries > 0,
            streak: 0,
            category: 'getting-started',
            rarity: 'common',
          },
          {
            id: 'week-streak',
            title: t('badges.weekStreak.title', 'Week Warrior'),
            description: t('badges.weekStreak.desc', '7 days in a row'),
            icon: '🔥',
            earned: currentStreak >= 7,
            streak: currentStreak,
            category: 'consistency',
            rarity: 'rare',
            progress: Math.min(currentStreak, 7),
            maxProgress: 7,
          },
          {
            id: 'month-streak',
            title: t('badges.monthStreak.title', 'Monthly Master'),
            description: t('badges.monthStreak.desc', '30 days in a row'),
            icon: '👑',
            earned: currentStreak >= 30,
            streak: currentStreak,
            category: 'consistency',
            rarity: 'epic',
            progress: Math.min(currentStreak, 30),
            maxProgress: 30,
          },
          {
            id: 'consistency',
            title: t('badges.consistency.title', 'Consistency King'),
            description: t('badges.consistency.desc', 'Longest streak: {days} days'),
            icon: '⭐',
            earned: longestStreak >= 14,
            streak: longestStreak,
            category: 'consistency',
            rarity: 'rare',
          },
          {
            id: 'explorer',
            title: t('badges.explorer.title', 'Mood Explorer'),
            description: t('badges.explorer.desc', 'Logged {count} moods'),
            icon: '🗺️',
            earned: totalEntries >= 50,
            streak: totalEntries,
            category: 'exploration',
            rarity: 'rare',
            progress: Math.min(totalEntries, 50),
            maxProgress: 50,
          },
          {
            id: 'mindful',
            title: 'Mindful Observer',
            description: 'Completed 10 mindfulness exercises',
            icon: '🧘',
            earned: false, // Would be calculated from exercise completions
            streak: 0,
            category: 'mindfulness',
            rarity: 'common',
            progress: 3,
            maxProgress: 10,
          },
          {
            id: 'storyteller',
            title: 'Storyteller',
            description: 'Listened to 5 AI-generated stories',
            icon: '📚',
            earned: false, // Would be calculated from story listens
            streak: 0,
            category: 'engagement',
            rarity: 'common',
            progress: 2,
            maxProgress: 5,
          },
          {
            id: 'health-sync',
            title: 'Health Syncer',
            description: 'Connected wearable device',
            icon: '⌚',
            earned: false, // Would be calculated from device connections
            streak: 0,
            category: 'integration',
            rarity: 'rare',
          },
          {
            id: 'crisis-helper',
            title: 'Crisis Supporter',
            description: 'Used crisis support features',
            icon: '🆘',
            earned: false, // Would be calculated from crisis interventions
            streak: 0,
            category: 'support',
            rarity: 'legendary',
          },
          {
            id: 'prediction-master',
            title: 'Prediction Master',
            description: 'Viewed mood predictions 10 times',
            icon: '🔮',
            earned: false, // Would be calculated from prediction views
            streak: 0,
            category: 'advanced',
            rarity: 'epic',
            progress: 1,
            maxProgress: 10,
          },
        ];

        setBadges(badgeList);
      } catch (error) {
        console.error('Failed to calculate badges:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateBadges();
  }, [user?.user_id, t]);

  const calculateCurrentStreak = (moods: any[]): number => {
    if (moods.length === 0) return 0;

    const sortedMoods = moods.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedMoods.length; i++) {
      const moodDate = sortedMoods[i].timestamp?.toDate ? sortedMoods[i].timestamp.toDate() : new Date(sortedMoods[i].timestamp);
      moodDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);

      if (moodDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const calculateLongestStreak = (moods: any[]): number => {
    if (moods.length === 0) return 0;

    const sortedMoods = moods.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });

    let longestStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < sortedMoods.length; i++) {
      const prevDate = sortedMoods[i - 1].timestamp?.toDate ? sortedMoods[i - 1].timestamp.toDate() : new Date(sortedMoods[i - 1].timestamp);
      const currDate = sortedMoods[i].timestamp?.toDate ? sortedMoods[i].timestamp.toDate() : new Date(sortedMoods[i].timestamp);

      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }

    return Math.max(longestStreak, currentStreak);
  };

  if (loading) {
    return (
      <div className="badge-display">
        <h3>{t('dashboard.badges', 'Achievements')}</h3>
        <div className="badge-loading">{t('common.loading')}</div>
      </div>
    );
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#9E9E9E';
      case 'rare': return '#2196F3';
      case 'epic': return '#9C27B0';
      case 'legendary': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consistency': return <StreakIcon />;
      case 'mindfulness': return <MindIcon />;
      case 'engagement': return <HeartIcon />;
      case 'integration': return <TrendingIcon />;
      case 'support': return <CheckIcon />;
      case 'advanced': return <StarIcon />;
      default: return <TrophyIcon />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrophyIcon color="primary" />
          {t('dashboard.badges', 'Achievements')}
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Track your progress and unlock achievements as you use the app!
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {badges.map((badge, index) => (
            <Box key={badge.id} sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)' } }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    border: badge.earned ? `2px solid ${getRarityColor(badge.rarity)}` : '2px solid #E0E0E0',
                    background: badge.earned
                      ? `linear-gradient(135deg, ${getRarityColor(badge.rarity)}15, ${getRarityColor(badge.rarity)}05)`
                      : 'grey.50',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 6,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {badge.earned && (
                    <MuiBadge
                      badgeContent={<CheckIcon sx={{ fontSize: 16 }} />}
                      color="success"
                      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                    />
                  )}

                  <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                    <Avatar
                      sx={{
                        width: 64,
                        height: 64,
                        mx: 'auto',
                        mb: 2,
                        fontSize: '2rem',
                        backgroundColor: badge.earned ? getRarityColor(badge.rarity) : 'grey.400',
                        opacity: badge.earned ? 1 : 0.6,
                      }}
                    >
                      {badge.earned ? badge.icon : <LockIcon />}
                    </Avatar>

                    <Typography variant="h6" component="h3" gutterBottom>
                      {badge.title}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" paragraph>
                      {badge.description.replace('{days}', badge.streak.toString()).replace('{count}', badge.streak.toString())}
                    </Typography>

                    <Box display="flex" justifyContent="center" alignItems="center" gap={1} mb={2}>
                      {getCategoryIcon(badge.category)}
                      <Chip
                        label={badge.rarity.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: getRarityColor(badge.rarity),
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>

                    {badge.progress !== undefined && badge.maxProgress && (
                      <Box sx={{ mt: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="caption" color="text.secondary">
                            Progress
                          </Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {badge.progress}/{badge.maxProgress}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(badge.progress / badge.maxProgress) * 100}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: 'grey.300',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: badge.earned ? getRarityColor(badge.rarity) : 'grey.400',
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>
                    )}

                    {badge.earned && badge.streak > 0 && (
                      <Box sx={{ mt: 2, p: 1, backgroundColor: 'success.light', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight="bold" color="success.contrastText">
                          <StreakIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          {badge.streak} {t('badges.days', 'days')}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </Box>
          ))}
        </Box>

        {/* Achievement Summary */}
        <Paper sx={{ mt: 4, p: 3, background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)' }}>
          <Typography variant="h6" gutterBottom>
            Achievement Summary
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 6px)' } }}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {badges.filter(b => b.earned).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Earned
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 6px)' } }}>
              <Box textAlign="center">
                <Typography variant="h4" color="secondary">
                  {badges.filter(b => !b.earned).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Remaining
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 6px)' } }}>
              <Box textAlign="center">
                <Typography variant="h4" sx={{ color: getRarityColor('rare') }}>
                  {badges.filter(b => b.earned && b.rarity === 'rare').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rare
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 6px)' } }}>
              <Box textAlign="center">
                <Typography variant="h4" sx={{ color: getRarityColor('epic') }}>
                  {badges.filter(b => b.earned && b.rarity === 'epic').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Epic
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>
    </motion.div>
  );
};

export default BadgeDisplay;