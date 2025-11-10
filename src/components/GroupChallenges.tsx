/**
 * Group Challenges Component
 * Team-based wellness challenges for community engagement
 */

import React, { useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Alert,
  Grid
} from '@mui/material';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import GroupsIcon from '@mui/icons-material/Groups';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TimerIcon from '@mui/icons-material/Timer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { trackEvent } from '../services/analytics';

interface GroupChallenge {
  id: string;
  title: string;
  description: string;
  goal: number;
  currentProgress: number;
  teamSize: number;
  maxTeamSize: number;
  startDate: Date;
  endDate: Date;
  reward: string;
  category: 'mood' | 'meditation' | 'journal' | 'streak';
  difficulty: 'easy' | 'medium' | 'hard';
  members: ChallengeMember[];
}

interface ChallengeMember {
  userId: string;
  username: string;
  avatar: string;
  contribution: number;
  joinDate: Date;
}

const MOCK_CHALLENGES: GroupChallenge[] = [
  {
    id: 'mood-marathon',
    title: '7-Day Mood Marathon',
    description: 'Team up to log 100 collective mood entries in 7 days',
    goal: 100,
    currentProgress: 67,
    teamSize: 8,
    maxTeamSize: 10,
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    reward: '500 XP + Exclusive Badge',
    category: 'mood',
    difficulty: 'medium',
    members: [
      { userId: '1', username: 'User1', avatar: '😊', contribution: 12, joinDate: new Date() },
      { userId: '2', username: 'User2', avatar: '🌟', contribution: 10, joinDate: new Date() },
      { userId: '3', username: 'User3', avatar: '💙', contribution: 8, joinDate: new Date() },
    ],
  },
  {
    id: 'meditation-masters',
    title: 'Meditation Masters',
    description: 'Complete 50 meditation sessions as a team this week',
    goal: 50,
    currentProgress: 23,
    teamSize: 5,
    maxTeamSize: 8,
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    reward: '300 XP + Zen Master Badge',
    category: 'meditation',
    difficulty: 'hard',
    members: [],
  },
  {
    id: 'journal-journey',
    title: 'Journal Journey',
    description: 'Write 30 journal entries together in 10 days',
    goal: 30,
    currentProgress: 0,
    teamSize: 0,
    maxTeamSize: 6,
    startDate: new Date(),
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    reward: '200 XP + Writer Badge',
    category: 'journal',
    difficulty: 'easy',
    members: [],
  },
];

interface GroupChallengesProps {
  userId: string;
  username: string;
}

export const GroupChallenges: React.FC<GroupChallengesProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [challenges] = useState<GroupChallenge[]>(MOCK_CHALLENGES);
  const [selectedChallenge, setSelectedChallenge] = useState<GroupChallenge | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FFB74D';
      case 'hard': return '#E57373';
      default: return '#9E9E9E';
    }
  };

  const getTimeRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const handleJoinChallenge = (challenge: GroupChallenge) => {
    setSelectedChallenge(challenge);
    setShowJoinDialog(true);
  };

  const confirmJoinChallenge = () => {
    if (selectedChallenge) {
      trackEvent('group_challenge_joined', {
        userId,
        challengeId: selectedChallenge.id,
        challengeTitle: selectedChallenge.title,
      });
      
      setShowJoinDialog(false);
      // In production, this would update the backend
    }
  };

  return (
    <Box>
      <Card sx={{ mb: spacing.md, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            <GroupsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('challenges.groupTitle', 'Group Challenges')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'colors.overlay.medium', mt: spacing.sm }}>
            {t('challenges.subtitle', 'Team up with others to achieve wellness goals together!')}
          </Typography>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mb: spacing.md }}>
        {t('challenges.info', 'Join a team challenge to earn bonus XP and exclusive badges. Work together to reach the goal!')}
      </Alert>

      <Grid container spacing={2}>
        {challenges.map((challenge, index) => (
          <Grid xs={12} md={6} key={challenge.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card
                sx={{
                  height: '100%',
                  border: challenge.teamSize > 0 ? '2px solid #4CAF50' : '1px solid #e0e0e0',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: spacing.md }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {challenge.title}
                      </Typography>
                      <Chip
                        label={challenge.difficulty}
                        size="small"
                        sx={{
                          bgcolor: getDifficultyColor(challenge.difficulty),
                          color: 'white',
                          mr: 1,
                        }}
                      />
                      <Chip
                        icon={<TimerIcon />}
                        label={getTimeRemaining(challenge.endDate)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <EmojiEventsIcon sx={{ fontSize: 40, color: '#FFD700' }} />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.md }}>
                    {challenge.description}
                  </Typography>

                  <Box sx={{ mb: spacing.md }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.sm }}>
                      <Typography variant="caption">
                        {t('challenges.progress', 'Team Progress')}
                      </Typography>
                      <Typography variant="caption" fontWeight="bold">
                        {challenge.currentProgress} / {challenge.goal}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(challenge.currentProgress / challenge.goal) * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        bgcolor: '#E0E0E0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: getDifficultyColor(challenge.difficulty),
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t('challenges.teamSize', 'Team')}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {challenge.teamSize} / {challenge.maxTeamSize} members
                      </Typography>
                    </Box>
                    {challenge.members.length > 0 && (
                      <AvatarGroup max={4}>
                        {challenge.members.map((member) => (
                          <Avatar key={member.userId} sx={{ width: 32, height: 32 }}>
                            {member.avatar}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                    )}
                  </Box>

                  <Box sx={{ bgcolor: '#FFF3E0', p: spacing.sm, borderRadius: 1, mb: spacing.md }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('challenges.reward', 'Reward:')}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {challenge.reward}
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant={challenge.teamSize < challenge.maxTeamSize ? 'contained' : 'outlined'}
                    disabled={challenge.teamSize >= challenge.maxTeamSize}
                    onClick={() => handleJoinChallenge(challenge)}
                    startIcon={<GroupsIcon />}
                  >
                    {challenge.teamSize >= challenge.maxTeamSize
                      ? t('challenges.full', 'Team Full')
                      : t('challenges.join', 'Join Challenge')}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Join Challenge Dialog */}
      <Dialog open={showJoinDialog} onClose={() => setShowJoinDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('challenges.joinTitle', 'Join Group Challenge')}
        </DialogTitle>
        <DialogContent>
          {selectedChallenge && (
            <>
              <Typography variant="h6" gutterBottom>
                {selectedChallenge.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedChallenge.description}
              </Typography>

              <Alert severity="info" sx={{ mb: spacing.md }}>
                {t('challenges.commitment', 'By joining, you commit to contributing to the team goal. Every action counts!')}
              </Alert>

              <Box sx={{ bgcolor: '#E8F5E9', p: spacing.md, borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('challenges.details', 'Challenge Details:')}
                </Typography>
                <Typography variant="body2">
                  • {t('challenges.goal', 'Goal:')} {selectedChallenge.goal} {selectedChallenge.category}s
                </Typography>
                <Typography variant="body2">
                  • {t('challenges.timeLeft', 'Time Left:')} {getTimeRemaining(selectedChallenge.endDate)}
                </Typography>
                <Typography variant="body2">
                  • {t('challenges.reward', 'Reward:')} {selectedChallenge.reward}
                </Typography>
                <Typography variant="body2">
                  • {t('challenges.teamMembers', 'Current Team:')} {selectedChallenge.teamSize} / {selectedChallenge.maxTeamSize}
                </Typography>
              </Box>

              {selectedChallenge.members.length > 0 && (
                <Box sx={{ mt: spacing.md }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('challenges.topContributors', 'Top Contributors:')}
                  </Typography>
                  <List dense>
                    {selectedChallenge.members.slice(0, 3).map((member) => (
                      <ListItem key={member.userId}>
                        <ListItemAvatar>
                          <Avatar sx={{ width: 32, height: 32 }}>{member.avatar}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.username}
                          secondary={`${member.contribution} contributions`}
                        />
                        <TrendingUpIcon color="success" />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowJoinDialog(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={confirmJoinChallenge} variant="contained" startIcon={<GroupsIcon />}>
            {t('challenges.confirmJoin', 'Join Team')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupChallenges;
