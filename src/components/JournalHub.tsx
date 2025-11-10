import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import {
  MenuBook,
  Favorite,
  Camera,
  Event,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import JournalEntry from './JournalEntry';
import MoodList from './MoodList';
import MemoryRecorder from './MemoryRecorder';
import MemoryList from './MemoryList';
import useAuth from '../hooks/useAuth';
import { colors, spacing } from '@/theme/tokens';
import { getMoods, getMemories } from '../api/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`journal-tabpanel-${index}`}
    aria-labelledby={`journal-tab-${index}`}
  >
    {value === index && <Box sx={{ py: spacing.xl }}>{children}</Box>}
  </div>
);

const JournalHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    moodCount: 0,
    memoryCount: 0,
    journalCount: 0,
    weekStreak: 0,
  });

  useEffect(() => {
    loadJournalStats();
  }, [user]);

  const loadJournalStats = async () => {
    if (!user?.user_id) return;

    try {
      const [moods, memories] = await Promise.all([
        getMoods(user.user_id).catch(() => []),
        getMemories(user.user_id).catch(() => []),
      ]);

      setStats({
        moodCount: moods.length,
        memoryCount: memories.length,
        journalCount: moods.filter((m: any) => m.notes && m.notes.length > 50).length,
        weekStreak: calculateStreak(moods),
      });
    } catch (error) {
      console.error('Failed to load journal stats:', error);
    }
  };

  const calculateStreak = (moods: any[]) => {
    if (!moods.length) return 0;
    // Simple streak calculation - can be improved
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const hasLog = moods.some((m: any) => 
        m.timestamp && m.timestamp.startsWith(dateStr)
      );
      if (hasLog) streak++;
      else break;
    }
    return streak;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', p: spacing.xl }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: spacing.xxl }}>
        <Box sx={{ fontSize: 80, mb: spacing.lg }}>
          <MenuBook sx={{ fontSize: 80, color: colors.primary.main }} />
        </Box>
        <Typography 
          variant="h2" 
          className="world-class-heading-1"
          gutterBottom
        >
          📖 Journal Hub
        </Typography>
        <Typography 
          variant="h5" 
          className="world-class-body-large"
          color="text.secondary"
        >
          Din digitala dagbok för tankar, känslor och minnen
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: spacing.xxl }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <MenuBook sx={{ fontSize: 48, color: colors.primary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {stats.journalCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Journal Entries
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Favorite sx={{ fontSize: 48, color: colors.secondary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {stats.moodCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Mood Logs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Camera sx={{ fontSize: 48, color: colors.warning.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {stats.memoryCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Memories
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Event sx={{ fontSize: 48, color: colors.success.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {stats.weekStreak} 🔥
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Day Streak
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Camera sx={{ fontSize: 48, color: colors.warning.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {user ? '12' : '0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Saved Memories
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Event sx={{ fontSize: 48, color: colors.success.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {user ? '45' : '0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Days Tracked
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different journal features */}
      <Card className="world-class-dashboard-card">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="journal features tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<MenuBook />} 
              label="Write Journal" 
              id="journal-tab-0"
              aria-controls="journal-tabpanel-0"
            />
            <Tab 
              icon={<Favorite />} 
              label="Mood History" 
              id="journal-tab-1"
              aria-controls="journal-tabpanel-1"
            />
            <Tab 
              icon={<Camera />} 
              label="Save Memory" 
              id="journal-tab-2"
              aria-controls="journal-tabpanel-2"
            />
            <Tab 
              icon={<Event />} 
              label="Memory Gallery" 
              id="journal-tab-3"
              aria-controls="journal-tabpanel-3"
            />
          </Tabs>
        </Box>

        <CardContent>
          {/* Journal Entry Tab */}
          <TabPanel value={activeTab} index={0}>
            {user?.user_id ? (
              <JournalEntry 
                userId={user.user_id}
                open={true}
                onClose={() => {}}
                onSubmit={() => {}}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to write journal entries
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Mood List Tab */}
          <TabPanel value={activeTab} index={1}>
            {user?.user_id ? (
              <MoodList onClose={() => {}} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to view mood history
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Memory Recorder Tab */}
          <TabPanel value={activeTab} index={2}>
            {user?.user_id ? (
              <MemoryRecorder userId={user.user_id} onClose={() => {}} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to save memories
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Memory List Tab */}
          <TabPanel value={activeTab} index={3}>
            {user?.user_id ? (
              <MemoryList onClose={() => {}} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to view memory gallery
                </Typography>
              </Box>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Benefits Section */}
      <Box sx={{ mt: spacing.xxl, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom className="world-class-heading-2">
          Why Keep a Journal?
        </Typography>
        <Grid container spacing={3} sx={{ mt: spacing.lg }}>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🧠</Typography>
              <Typography variant="h6" gutterBottom>
                Self-Reflection
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Understand your thoughts and emotions better
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>📈</Typography>
              <Typography variant="h6" gutterBottom>
                Track Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                See patterns and improvements over time
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>💪</Typography>
              <Typography variant="h6" gutterBottom>
                Emotional Release
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Express feelings in a safe, private space
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Prompts Section */}
      <Box sx={{ mt: spacing.xxl }}>
        <Card className="world-class-dashboard-card">
          <CardContent>
            <Typography variant="h5" gutterBottom className="world-class-heading-3">
              Journal Prompts for Today
            </Typography>
            <Grid container spacing={2} sx={{ mt: spacing.md }}>
              {[
                "What made you smile today?",
                "What's one thing you're grateful for?",
                "How did you take care of yourself today?",
                "What challenge did you overcome?",
                "What's one positive thing you can say about yourself?",
                "What's something you're looking forward to?",
              ].map((prompt, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                      <Typography variant="body1" color="text.primary">
                        💭 {prompt}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default JournalHub;
