/**
 * Leaderboard Component
 * Weekly challenges and community rankings
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  rank: number;
  streak?: number;
  badge?: string;
}

interface LeaderboardProps {
  userId: string;
  type?: 'weekly' | 'monthly' | 'allTime';
}

// Mock data for demonstration
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    userId: '1',
    displayName: 'Anna S.',
    score: 1250,
    rank: 1,
    streak: 45,
    badge: '👑',
  },
  {
    userId: '2',
    displayName: 'Erik M.',
    score: 1180,
    rank: 2,
    streak: 38,
    badge: '🥈',
  },
  {
    userId: '3',
    displayName: 'Sofia L.',
    score: 1100,
    rank: 3,
    streak: 32,
    badge: '🥉',
  },
  {
    userId: '4',
    displayName: 'Gustav K.',
    score: 980,
    rank: 4,
    streak: 28,
  },
  {
    userId: '5',
    displayName: 'Maria P.',
    score: 920,
    rank: 5,
    streak: 25,
  },
  {
    userId: '6',
    displayName: 'Johan A.',
    score: 880,
    rank: 6,
    streak: 22,
  },
  {
    userId: '7',
    displayName: 'Lisa B.',
    score: 850,
    rank: 7,
    streak: 20,
  },
  {
    userId: '8',
    displayName: 'You',
    score: 720,
    rank: 12,
    streak: 15,
  },
];

export const Leaderboard: React.FC<LeaderboardProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [leaderboard] = useState<LeaderboardEntry[]>(MOCK_LEADERBOARD);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    // Find user's entry
    const entry = leaderboard.find((e) => e.userId === userId || e.displayName === 'You');
    setUserEntry(entry || null);
  }, [userId, leaderboard]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // In production, fetch different leaderboard data based on tab
  };

  const getRankColor = (rank: number): string => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#9E9E9E';
  };

  const getRankIcon = (rank: number): string => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <Box>
      <Card sx={{ mb: 2, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              <EmojiEventsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              {t('leaderboard.title', 'Community Leaderboard')}
            </Typography>
            <Chip
              icon={<TrendingUpIcon />}
              label={t('leaderboard.competitive', 'Competitive Mode')}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </Box>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ mb: 2 }}
        variant="fullWidth"
      >
        <Tab label={t('leaderboard.weekly', 'This Week')} />
        <Tab label={t('leaderboard.monthly', 'This Month')} />
        <Tab label={t('leaderboard.allTime', 'All Time')} />
      </Tabs>

      {/* User's Current Position */}
      {userEntry && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card
            sx={{
              mb: 2,
              border: '2px solid #2196F3',
              background: 'linear-gradient(90deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.05) 100%)',
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                {t('leaderboard.yourRank', 'Your Position')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: getRankColor(userEntry.rank), width: 50, height: 50 }}>
                    {userEntry.rank}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{userEntry.displayName}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <LocalFireDepartmentIcon sx={{ fontSize: '1rem', color: '#FF5722' }} />
                      <Typography variant="caption">{userEntry.streak} day streak</Typography>
                    </Box>
                  </Box>
                </Box>
                <Typography variant="h5" color="primary" fontWeight="bold">
                  {userEntry.score} pts
                </Typography>
              </Box>
              {userEntry.rank > 10 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Keep going! You're {userEntry.rank - 10} spots away from the top 10
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={((20 - userEntry.rank) / 20) * 100}
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Leaderboard List */}
      <Card>
        <List>
          {leaderboard
            .filter((entry) => entry.rank <= 10)
            .map((entry, index) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <ListItem
                  sx={{
                    borderBottom: index < 9 ? '1px solid #f0f0f0' : 'none',
                    bgcolor: entry.userId === userId || entry.displayName === 'You' ? 'rgba(33, 150, 243, 0.05)' : 'transparent',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: getRankColor(entry.rank),
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                      }}
                    >
                      {entry.badge || entry.rank}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight={entry.rank <= 3 ? 'bold' : 'normal'}>
                          {entry.displayName}
                        </Typography>
                        {entry.streak && entry.streak > 7 && (
                          <Chip
                            icon={<LocalFireDepartmentIcon />}
                            label={`${entry.streak} days`}
                            size="small"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={`Rank ${getRankIcon(entry.rank)}`}
                  />
                  <Typography variant="h6" color="primary" fontWeight="bold">
                    {entry.score}
                  </Typography>
                </ListItem>
              </motion.div>
            ))}
        </List>
      </Card>

      <Box sx={{ mt: 2, p: 2, bgcolor: '#FFF3E0', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          💡 <strong>Tip:</strong> Earn points by logging moods daily, completing challenges, and maintaining streaks!
        </Typography>
      </Box>
    </Box>
  );
};

export default Leaderboard;
