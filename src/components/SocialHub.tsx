import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Group,
  Chat,
  EmojiEvents,
  Share,
  Leaderboard as LeaderboardIcon,
  People,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PeerSupportChat from './PeerSupportChat';
import GroupChallenges from './GroupChallenges';
import Leaderboard from './Leaderboard';
import AchievementSharing from './AchievementSharing';
import useAuth from '../hooks/useAuth';
import { colors, spacing } from '@/theme/tokens';
import { getLeaderboard, getReferralStats, getMoods } from '../api/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`social-tabpanel-${index}`}
    aria-labelledby={`social-tab-${index}`}
  >
    {value === index && <Box sx={{ py: spacing.xl }}>{children}</Box>}
  </div>
);

interface SocialStats {
  communityMembers: number;
  supportMessages: number;
  challengesCompleted: number;
  leaderboardRank: number;
}

const SocialHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [socialStats, setSocialStats] = useState<SocialStats>({
    communityMembers: 0,
    supportMessages: 0,
    challengesCompleted: 0,
    leaderboardRank: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSocialData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch leaderboard to get community size and user rank
        const leaderboardData = await getLeaderboard(100);
        const communityMembers = leaderboardData.length;
        
        // Find user's rank
        const userRankEntry = leaderboardData.find(
          (entry: any) => entry.user_id === user.user_id
        );
        const userRank = userRankEntry?.rank || 0;

        // Fetch referral stats (includes challenges data)
        const referralStats = await getReferralStats(user.user_id);
        const challengesCompleted = referralStats.successful_referrals || 0;

        // Fetch moods to calculate support messages (approximate with mood logs)
        const moods = await getMoods(user.user_id);
        const supportMessages = moods.length; // Use mood count as proxy for engagement

        setSocialStats({
          communityMembers,
          supportMessages,
          challengesCompleted,
          leaderboardRank: userRank,
        });
      } catch (error) {
        console.error('Failed to fetch social data:', error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchSocialData();
  }, [user?.user_id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', p: spacing.xl }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: spacing.xxl }}>
        <Box sx={{ fontSize: 80, mb: spacing.lg }}>
          <Group sx={{ fontSize: 80, color: colors.primary.main }} />
        </Box>
        <Typography 
          variant="h2" 
          className="world-class-heading-1"
          gutterBottom
        >
          🤝 Social Hub
        </Typography>
        <Typography 
          variant="h5" 
          className="world-class-body-large"
          color="text.secondary"
        >
          Connect with the community, share achievements, and grow together
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: spacing.xxl }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <People sx={{ fontSize: 48, color: colors.primary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : socialStats.communityMembers.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Community Members
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Chat sx={{ fontSize: 48, color: colors.secondary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : socialStats.supportMessages}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your Support Messages
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <EmojiEvents sx={{ fontSize: 48, color: colors.warning.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : socialStats.challengesCompleted}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Challenges Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <LeaderboardIcon sx={{ fontSize: 48, color: colors.warning.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : socialStats.leaderboardRank > 0 ? `#${socialStats.leaderboardRank}` : 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your Leaderboard Rank
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different social features */}
      <Card className="world-class-dashboard-card">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="social features tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<Chat />} 
              label="Peer Support" 
              id="social-tab-0"
              aria-controls="social-tabpanel-0"
            />
            <Tab 
              icon={<EmojiEvents />} 
              label="Group Challenges" 
              id="social-tab-1"
              aria-controls="social-tabpanel-1"
            />
            <Tab 
              icon={<LeaderboardIcon />} 
              label="Leaderboard" 
              id="social-tab-2"
              aria-controls="social-tabpanel-2"
            />
            <Tab 
              icon={<Share />} 
              label="Share Achievements" 
              id="social-tab-3"
              aria-controls="social-tabpanel-3"
            />
          </Tabs>
        </Box>

        <CardContent>
          {/* Peer Support Chat Tab */}
          <TabPanel value={activeTab} index={0}>
            {user?.user_id ? (
              <PeerSupportChat 
                userId={user.user_id} 
                username={user.email?.split('@')[0] || 'Anonymous'}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to access peer support
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Group Challenges Tab */}
          <TabPanel value={activeTab} index={1}>
            {user?.user_id ? (
              <GroupChallenges userId={user.user_id} username={user.email?.split('@')[0] || 'Anonymous'} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to join challenges
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Leaderboard Tab */}
          <TabPanel value={activeTab} index={2}>
            {user?.user_id ? (
              <Leaderboard userId={user.user_id} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to view leaderboard
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Share Achievements Tab */}
          <TabPanel value={activeTab} index={3}>
            {user?.user_id ? (
              <AchievementSharing 
                userId={user.user_id}
                achievement={{
                  id: 'sample',
                  title: 'Your Achievements',
                  description: 'Share your progress with the community',
                  icon: '🏆',
                  date: new Date(),
                  category: 'badge',
                }}
                onClose={() => {}}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to share achievements
                </Typography>
              </Box>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Community Guidelines */}
      <Box sx={{ mt: spacing.xxl }}>
        <Card className="world-class-dashboard-card">
          <CardContent>
            <Typography variant="h5" gutterBottom className="world-class-heading-3">
              Community Guidelines
            </Typography>
            <Grid container spacing={2} sx={{ mt: spacing.md }}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>🤗</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Be Supportive
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Encourage and uplift fellow community members
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>🤝</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Be Respectful
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Treat everyone with kindness and respect
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>🔒</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Protect Privacy
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Never share personal information
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: spacing.md, mb: spacing.md }}>
                  <Typography sx={{ fontSize: 32 }}>⚠️</Typography>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Report Issues
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Flag inappropriate content immediately
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
          Why Connect with the Community?
        </Typography>
        <Grid container spacing={3} sx={{ mt: spacing.lg }}>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>💪</Typography>
              <Typography variant="h6" gutterBottom>
                Motivation & Support
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Get encouraged by others on the same journey
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🎯</Typography>
              <Typography variant="h6" gutterBottom>
                Accountability
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Stay committed with group challenges
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🌟</Typography>
              <Typography variant="h6" gutterBottom>
                Shared Success
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Celebrate achievements together
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default SocialHub;
