import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Chip,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  EmojiEvents,
  Star,
  Celebration,
  CardGiftcard,
  WorkspacePremium,
  LocalActivity,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import BadgeDisplay from './BadgeDisplay';
import Gamification from './Gamification';
import { GamificationSystemWrapper } from './RouteWrappers';
import useAuth from '../hooks/useAuth';
import { colors, spacing } from '@/theme/tokens';
import { getMoods, api } from '../api/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`rewards-tabpanel-${index}`}
    aria-labelledby={`rewards-tab-${index}`}
  >
    {value === index && <Box sx={{ py: spacing.xl }}>{children}</Box>}
  </div>
);

const RewardsHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    totalPoints: 0,
    streakDays: 0,
    badges: 0,
    achievements: 0,
  });

  useEffect(() => {
    loadRewardsData();
  }, [user]);

  const loadRewardsData = async () => {
    if (!user?.user_id) return;

    try {
      // Get moods to calculate points and streaks
      const moods = await getMoods(user.user_id).catch(() => []);
      
      // Calculate streak
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const hasLog = moods.some((m: any) => 
          m.timestamp && m.timestamp.startsWith(dateStr)
        );
        if (hasLog) streak++;
        else if (i > 0) break; // Break if not consecutive
      }

      // Calculate points (simple system)
      const points = moods.length * 10 + streak * 50;
      const achievements = Math.floor(streak / 7) + Math.floor(moods.length / 20);
      const badges = Math.floor(moods.length / 10);

      setStats({
        totalPoints: points,
        streakDays: streak,
        badges,
        achievements,
      });
    } catch (error) {
      console.error('Failed to load rewards data:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Mock rewards data
  const rewards = [
    {
      id: 1,
      title: '🎁 Premium Theme',
      description: 'Unlock exclusive dark mode themes',
      cost: 500,
      category: 'Appearance',
      available: true,
    },
    {
      id: 2,
      title: '📊 Advanced Analytics',
      description: 'Access detailed mood analytics for 1 year',
      cost: 1000,
      category: 'Features',
      available: true,
    },
    {
      id: 3,
      title: '🎧 Meditation Pack',
      description: 'Premium guided meditations library',
      cost: 750,
      category: 'Content',
      available: true,
    },
    {
      id: 4,
      title: '👥 Group Therapy Session',
      description: 'Join exclusive community sessions',
      cost: 2000,
      category: 'Social',
      available: false,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', p: spacing.xl }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: spacing.xxl }}>
        <Box sx={{ fontSize: 80, mb: spacing.lg }}>
          <EmojiEvents sx={{ fontSize: 80, color: colors.warning.main }} />
        </Box>
        <Typography 
          variant="h2" 
          className="world-class-heading-1"
          gutterBottom
        >
          🏆 Rewards Hub
        </Typography>
        <Typography 
          variant="h5" 
          className="world-class-body-large"
          color="text.secondary"
        >
          Tjäna poäng, lås upp achievements och få belöningar för din resa
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: spacing.xxl }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Star sx={{ fontSize: 48, color: colors.warning.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                1,247
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Points Earned
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={65} 
                sx={{ mt: spacing.md }}
                color="warning"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <WorkspacePremium sx={{ fontSize: 48, color: colors.secondary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                12
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Badges Unlocked
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={48} 
                sx={{ mt: spacing.md }}
                color="secondary"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Celebration sx={{ fontSize: 48, color: colors.success.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                Level 7
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Level
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={70} 
                sx={{ mt: spacing.md }}
                color="success"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <CardGiftcard sx={{ fontSize: 48, color: colors.primary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                5
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rewards Claimed
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={55} 
                sx={{ mt: spacing.md }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different rewards features */}
      <Card className="world-class-dashboard-card">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="rewards tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<WorkspacePremium />} 
              label="My Badges" 
              id="rewards-tab-0"
              aria-controls="rewards-tabpanel-0"
            />
            <Tab 
              icon={<CardGiftcard />} 
              label="Rewards Catalog" 
              id="rewards-tab-1"
              aria-controls="rewards-tabpanel-1"
            />
            <Tab 
              icon={<EmojiEvents />} 
              label="Achievements" 
              id="rewards-tab-2"
              aria-controls="rewards-tabpanel-2"
            />
            <Tab 
              icon={<LocalActivity />} 
              label="Daily Challenges" 
              id="rewards-tab-3"
              aria-controls="rewards-tabpanel-3"
            />
          </Tabs>
        </Box>

        <CardContent>
          {/* My Badges Tab */}
          <TabPanel value={activeTab} index={0}>
            {user?.user_id ? (
              <BadgeDisplay />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to view your badges
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Rewards Catalog Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Available Rewards
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Spend your earned points on exclusive rewards and premium features
              </Typography>

              <Grid container spacing={3} sx={{ mt: spacing.md }}>
                {rewards.map((reward) => (
                  <Grid item xs={12} md={6} key={reward.id}>
                    <Card sx={{ 
                      height: '100%',
                      opacity: reward.available ? 1 : 0.6,
                      border: '2px solid',
                      borderColor: reward.available ? 'primary.main' : 'grey.300',
                    }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                          <Typography variant="h6">
                            {reward.title}
                          </Typography>
                          <Chip 
                            label={`${reward.cost} pts`} 
                            color={reward.available ? 'primary' : 'default'}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {reward.description}
                        </Typography>
                        <Chip 
                          label={reward.category} 
                          size="small" 
                          variant="outlined"
                          sx={{ mb: spacing.md }}
                        />
                        <Button
                          variant={reward.available ? 'contained' : 'outlined'}
                          fullWidth
                          disabled={!reward.available}
                          className="world-class-btn-primary"
                        >
                          {reward.available ? 'Claim Reward' : 'Coming Soon'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </TabPanel>

          {/* Achievements Tab */}
          <TabPanel value={activeTab} index={2}>
            {user?.user_id ? (
              <Gamification userId={user.user_id} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to view achievements
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Daily Challenges Tab */}
          <TabPanel value={activeTab} index={3}>
            {user?.user_id ? (
              <GamificationSystemWrapper />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to view daily challenges
                </Typography>
              </Box>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* How to Earn Points */}
      <Box sx={{ mt: spacing.xxl }}>
        <Card className="world-class-dashboard-card">
          <CardContent>
            <Typography variant="h5" gutterBottom className="world-class-heading-3">
              💰 How to Earn Points
            </Typography>
            <Grid container spacing={2} sx={{ mt: spacing.md }}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>😊</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Log Your Mood
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Earn 10 points for each mood entry
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>🔥</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Daily Streak
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Earn 50 points for 7-day streaks
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>💬</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      AI Conversations
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Earn 20 points per therapy session
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>🎯</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Complete Challenges
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Earn up to 100 points per challenge
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Benefits */}
      <Box sx={{ mt: spacing.xxl, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom className="world-class-heading-2">
          Why Earn Rewards?
        </Typography>
        <Grid container spacing={3} sx={{ mt: spacing.lg }}>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🎁</Typography>
              <Typography variant="h6" gutterBottom>
                Exclusive Rewards
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unlock premium features and content
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🏆</Typography>
              <Typography variant="h6" gutterBottom>
                Achievement System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track your progress with badges
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🎯</Typography>
              <Typography variant="h6" gutterBottom>
                Stay Motivated
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gamification keeps you engaged
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default RewardsHub;
