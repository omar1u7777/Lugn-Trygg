/**
 * Gamification System - Badges, Levels, and Achievements
 */

import React, { useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid
} from '@mui/material';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { trackEvent } from '../services/analytics';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  category: 'mood' | 'streak' | 'social' | 'milestone';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  goal: number;
  reward: string;
  expiresAt?: string;
}

interface GamificationSystemProps {
  userId: string;
  userLevel: number;
  userXP: number;
  nextLevelXP: number;
  badges: Badge[];
  challenges: Challenge[];
}

const BADGE_DEFINITIONS: Omit<Badge, 'earned' | 'earnedDate'>[] = [
  {
    id: 'first_mood',
    name: 'First Step',
    description: 'Log your first mood',
    icon: '🌱',
    category: 'mood',
    rarity: 'common',
  },
  {
    id: 'week_streak',
    name: 'Week Warrior',
    description: 'Log mood for 7 days in a row',
    icon: '🔥',
    category: 'streak',
    rarity: 'rare',
  },
  {
    id: 'month_streak',
    name: 'Monthly Master',
    description: 'Log mood for 30 days in a row',
    icon: '⭐',
    category: 'streak',
    rarity: 'epic',
  },
  {
    id: 'hundred_moods',
    name: 'Century',
    description: 'Log 100 moods',
    icon: '💯',
    category: 'milestone',
    rarity: 'epic',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log mood before 8 AM five times',
    icon: '🌅',
    category: 'mood',
    rarity: 'rare',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Log mood after 10 PM five times',
    icon: '🦉',
    category: 'mood',
    rarity: 'rare',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Share 3 achievements',
    icon: '🦋',
    category: 'social',
    rarity: 'rare',
  },
  {
    id: 'zen_master',
    name: 'Zen Master',
    description: 'Complete 20 meditation sessions',
    icon: '🧘',
    category: 'milestone',
    rarity: 'epic',
  },
  {
    id: 'legendary_streaker',
    name: 'Legend',
    description: 'Log mood for 100 days in a row',
    icon: '👑',
    category: 'streak',
    rarity: 'legendary',
  },
];

const RARITY_COLORS = {
  common: '#9E9E9E',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FFD700',
};

export const GamificationSystem: React.FC<GamificationSystemProps> = ({
  userId,
  userLevel,
  userXP,
  nextLevelXP,
  badges,
  challenges,
}) => {
  const { t } = useTranslation();
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showBadgeDialog, setShowBadgeDialog] = useState(false);

  const levelProgress = (userXP / nextLevelXP) * 100;

  const handleBadgeClick = (badge: Badge) => {
    setSelectedBadge(badge);
    setShowBadgeDialog(true);
    
    if (badge.earned) {
      trackEvent('badge_viewed', {
        userId,
        badgeId: badge.id,
        badgeName: badge.name,
      });
    }
  };

  const getLevelTitle = (level: number): string => {
    if (level < 5) return 'Beginner';
    if (level < 10) return 'Explorer';
    if (level < 20) return 'Achiever';
    if (level < 30) return 'Expert';
    if (level < 50) return 'Master';
    return 'Legend';
  };

  return (
    <Box>
      {/* Level and XP Progress */}
      <Card sx={{ mb: spacing.lg, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.md }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <Avatar
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: RARITY_COLORS.legendary,
                  fontSize: '2rem',
                }}
              >
                {userLevel}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Level {userLevel}
                </Typography>
                <Typography variant="body2" sx={{ color: 'colors.overlay.medium' }}>
                  {getLevelTitle(userLevel)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6" sx={{ color: 'white' }}>
                {userXP} / {nextLevelXP} XP
              </Typography>
              <Chip
                icon={<StarIcon />}
                label={`${Math.round(levelProgress)}%`}
                size="small"
                sx={{ bgcolor: 'colors.overlay.medium', color: 'white' }}
              />
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={levelProgress}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: 'colors.overlay.medium',
              '& .MuiLinearProgress-bar': {
                bgcolor: RARITY_COLORS.legendary,
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Weekly Challenges */}
      {challenges && challenges.length > 0 && (
        <Box sx={{ mb: spacing.lg }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <LocalFireDepartmentIcon color="error" />
            {t('gamification.challenges', 'Weekly Challenges')}
          </Typography>
          <Grid container spacing={2}>
            {challenges.map((challenge) => (
              <Grid xs={12} md={6} key={challenge.id}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {challenge.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.md }}>
                      {challenge.description}
                    </Typography>
                    <Box sx={{ mb: spacing.sm }}>
                      <Typography variant="caption" color="text.secondary">
                        {challenge.progress} / {challenge.goal}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(challenge.progress / challenge.goal) * 100}
                        sx={{ mt: 0.5, height: 8, borderRadius: borderRadius.xl }}
                      />
                    </Box>
                    <Chip
                      label={`Reward: ${challenge.reward}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Badges */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <EmojiEventsIcon color="warning" />
          {t('gamification.badges', 'Badges & Achievements')}
        </Typography>
        <Grid container spacing={2}>
          {BADGE_DEFINITIONS.map((badgeDef) => {
            const earnedBadge = badges.find((b) => b.id === badgeDef.id);
            const badge: Badge = earnedBadge || { ...badgeDef, earned: false };

            return (
              <Grid xs={6} sm={4} md={3} key={badge.id}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Tooltip
                    title={badge.earned ? badge.description : `🔒 ${badge.description}`}
                    arrow
                  >
                    <Card
                      onClick={() => handleBadgeClick(badge)}
                      sx={{
                        cursor: 'pointer',
                        opacity: badge.earned ? 1 : 0.4,
                        border: `2px solid ${RARITY_COLORS[badge.rarity]}`,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: `0 0 20px ${RARITY_COLORS[badge.rarity]}`,
                        },
                      }}
                    >
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h2" sx={{ mb: spacing.sm }}>
                          {badge.earned ? badge.icon : '🔒'}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {badge.name}
                        </Typography>
                        <Chip
                          label={badge.rarity}
                          size="small"
                          sx={{
                            mt: spacing.sm,
                            bgcolor: RARITY_COLORS[badge.rarity],
                            color: 'white',
                            fontSize: '0.7rem',
                          }}
                        />
                      </CardContent>
                    </Card>
                  </Tooltip>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Badge Detail Dialog */}
      <Dialog open={showBadgeDialog} onClose={() => setShowBadgeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <Typography variant="h3">{selectedBadge?.icon}</Typography>
          <Typography variant="h6" sx={{ mt: spacing.sm }}>
            {selectedBadge?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {selectedBadge?.description}
          </Typography>
          {selectedBadge?.earned && selectedBadge.earnedDate && (
            <Typography variant="caption" color="text.secondary">
              Earned on: {new Date(selectedBadge.earnedDate).toLocaleDateString()}
            </Typography>
          )}
          <Box sx={{ mt: spacing.md, textAlign: 'center' }}>
            <Chip
              label={selectedBadge?.rarity}
              sx={{
                bgcolor: selectedBadge ? RARITY_COLORS[selectedBadge.rarity] : 'grey',
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default GamificationSystem;
