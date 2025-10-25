import React from 'react';
import { Box, Typography, Card, CardContent, Avatar, Chip } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  icon: React.ReactNode;
  badgeColor: string;
}

const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'streak-7',
    title: '7-Day Streak',
    description: 'Logged your mood for 7 days in a row!',
    date: '2025-10-18',
    icon: <StarIcon color="primary" />, 
    badgeColor: '#FFD700',
  },
  {
    id: 'group-challenge',
    title: 'Team Player',
    description: 'Completed your first group challenge!',
    date: '2025-10-10',
    icon: <EmojiEventsIcon color="secondary" />, 
    badgeColor: '#4CAF50',
  },
];

const AchievementSharing: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Achievements</Typography>
      {MOCK_ACHIEVEMENTS.map((ach) => (
        <Card key={ach.id} sx={{ mb: 2, display: 'flex', alignItems: 'center', bgcolor: '#f9fbe7' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
            <Avatar sx={{ bgcolor: ach.badgeColor, mr: 2 }}>{ach.icon}</Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">{ach.title}</Typography>
              <Typography variant="body2" color="text.secondary">{ach.description}</Typography>
              <Chip label={ach.date} size="small" sx={{ mt: 1 }} />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default AchievementSharing;
