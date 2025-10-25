import React from 'react';
import { motion } from 'framer-motion';
import { Box, Typography, Card, CardContent, Chip, LinearProgress, Avatar } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

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

const MOCK_BADGES: Badge[] = [
  { id: 'first-entry', title: 'First Step', description: 'Logged your first mood', icon: '🎯', earned: true, streak: 0, category: 'getting-started', rarity: 'common' },
  { id: 'week-streak', title: 'Week Warrior', description: '7 days in a row', icon: '🔥', earned: true, streak: 7, category: 'consistency', rarity: 'rare', progress: 7, maxProgress: 7 },
  { id: 'month-streak', title: 'Monthly Master', description: '30 days in a row', icon: '👑', earned: false, streak: 12, category: 'consistency', rarity: 'epic', progress: 12, maxProgress: 30 },
  { id: 'explorer', title: 'Mood Explorer', description: 'Logged 50 moods', icon: '🗺️', earned: false, streak: 23, category: 'exploration', rarity: 'rare', progress: 23, maxProgress: 50 },
  { id: 'mindful', title: 'Mindful Observer', description: 'Completed 10 mindfulness exercises', icon: '🧘', earned: false, streak: 0, category: 'mindfulness', rarity: 'common', progress: 3, maxProgress: 10 },
  { id: 'storyteller', title: 'Storyteller', description: 'Listened to 5 AI-generated stories', icon: '📚', earned: false, streak: 0, category: 'engagement', rarity: 'common', progress: 2, maxProgress: 5 },
  { id: 'health-sync', title: 'Health Syncer', description: 'Connected wearable device', icon: '⌚', earned: false, streak: 0, category: 'integration', rarity: 'rare' },
  { id: 'crisis-helper', title: 'Crisis Supporter', description: 'Used crisis support features', icon: '🆘', earned: false, streak: 0, category: 'support', rarity: 'legendary' },
  { id: 'prediction-master', title: 'Prediction Master', description: 'Viewed mood predictions 10 times', icon: '🔮', earned: false, streak: 0, category: 'advanced', rarity: 'epic', progress: 1, maxProgress: 10 },
];

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'common': return '#9E9E9E';
    case 'rare': return '#2196F3';
    case 'epic': return '#9C27B0';
    case 'legendary': return '#FF9800';
    default: return '#9E9E9E';
  }
};

const BadgeDisplay: React.FC = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>Achievements</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>Track your progress and unlock achievements as you use the app!</Typography>
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(260px, 1fr))" gap={3} mb={4}>
          {MOCK_BADGES.map((badge, index) => (
            <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1, duration: 0.3 }} whileHover={{ scale: 1.02 }}>
              <Card sx={{ border: badge.earned ? `2px solid ${getRarityColor(badge.rarity)}` : '1px solid #e0e0e0', bgcolor: badge.earned ? 'rgba(255, 215, 64, 0.08)' : 'white', boxShadow: badge.earned ? 6 : 1 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ bgcolor: badge.earned ? getRarityColor(badge.rarity) : '#e0e0e0', width: 56, height: 56, mx: 'auto', mb: 2, fontSize: 32 }}>
                    {badge.earned ? badge.icon : <LockIcon />}
                  </Avatar>
                  <Typography variant="subtitle1" fontWeight="bold">{badge.title}</Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>{badge.description}</Typography>
                  <Chip label={badge.rarity} size="small" sx={{ bgcolor: getRarityColor(badge.rarity), color: 'white', mb: 1 }} />
                  {badge.progress !== undefined && badge.maxProgress && (
                    <Box mt={2}>
                      <LinearProgress variant="determinate" value={(badge.progress / badge.maxProgress) * 100} sx={{ height: 8, borderRadius: 4, mb: 1, bgcolor: '#eee', '& .MuiLinearProgress-bar': { bgcolor: getRarityColor(badge.rarity) } }} />
                      <Typography variant="caption">{badge.progress}/{badge.maxProgress}</Typography>
                    </Box>
                  )}
                  {badge.earned && badge.streak > 0 && (
                    <Box mt={2} bgcolor="#e8f5e9" borderRadius={2} p={1}>
                      <Typography variant="caption" color="success.main">🔥 {badge.streak} days</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>
        {/* Achievement Summary */}
        <Box sx={{ bgcolor: 'rgba(240,240,240,0.7)', borderRadius: 2, p: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>Achievement Summary</Typography>
          <Box display="flex" gap={3}>
            <Box textAlign="center" flex={1}>
              <Typography variant="h4" color="primary.main">{MOCK_BADGES.filter(b => b.earned).length}</Typography>
              <Typography variant="body2">Earned</Typography>
            </Box>
            <Box textAlign="center" flex={1}>
              <Typography variant="h4" color="secondary.main">{MOCK_BADGES.filter(b => !b.earned).length}</Typography>
              <Typography variant="body2">Remaining</Typography>
            </Box>
            <Box textAlign="center" flex={1}>
              <Typography variant="h4" color="#2196F3">{MOCK_BADGES.filter(b => b.earned && b.rarity === 'rare').length}</Typography>
              <Typography variant="body2">Rare</Typography>
            </Box>
            <Box textAlign="center" flex={1}>
              <Typography variant="h4" color="#9C27B0">{MOCK_BADGES.filter(b => b.earned && b.rarity === 'epic').length}</Typography>
              <Typography variant="body2">Epic</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default BadgeDisplay;
