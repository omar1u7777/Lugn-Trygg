import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Spa,
  MusicNote,
  SelfImprovement,
  Air,
  NatureOutlined,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import RelaxingSounds from './RelaxingSounds';
import MicroInteractions from './MicroInteractions';
import useAuth from '../hooks/useAuth';
import { colors, spacing } from '@/theme/tokens';
import { getMoods } from '../api/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`wellness-tabpanel-${index}`}
    aria-labelledby={`wellness-tab-${index}`}
  >
    {value === index && <Box sx={{ py: spacing.xl }}>{children}</Box>}
  </div>
);

interface WellnessStats {
  meditationMinutes: number;
  breathingExercises: number;
  relaxationSessions: number;
  streakDays: number;
}

const WellnessHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [wellnessStats, setWellnessStats] = useState<WellnessStats>({
    meditationMinutes: 0,
    breathingExercises: 0,
    relaxationSessions: 0,
    streakDays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWellnessData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch mood data to calculate wellness metrics
        const moods = await getMoods(user.user_id);
        
        // Calculate metrics from mood patterns
        const relaxationSessions = moods.length; // Each mood log counts as engagement
        const meditationMinutes = moods.length * 5; // Estimate 5 min per session
        const breathingExercises = Math.floor(moods.length / 2); // Every 2 mood logs = 1 breathing exercise
        
        // Calculate streak
        let streakDays = 0;
        if (moods.length > 0) {
          const sortedMoods = [...moods].sort((a: any, b: any) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          let currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0);
          
          for (const mood of sortedMoods) {
            const moodDate = new Date(mood.timestamp);
            moodDate.setHours(0, 0, 0, 0);
            
            const daysDiff = Math.floor((currentDate.getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === streakDays) {
              streakDays++;
              currentDate = moodDate;
            } else if (daysDiff > streakDays) {
              break;
            }
          }
        }

        setWellnessStats({
          meditationMinutes,
          breathingExercises,
          relaxationSessions,
          streakDays,
        });
      } catch (error) {
        console.error('Failed to fetch wellness data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWellnessData();
  }, [user?.user_id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', p: spacing.xl }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: spacing.xxl }}>
        <Box sx={{ fontSize: 80, mb: spacing.lg }}>
          <Spa sx={{ fontSize: 80, color: colors.primary.main }} />
        </Box>
        <Typography 
          variant="h2" 
          className="world-class-heading-1"
          gutterBottom
        >
          🌿 Wellness Hub
        </Typography>
        <Typography 
          variant="h5" 
          className="world-class-body-large"
          color="text.secondary"
        >
          Din plats för avkoppling, meditation och mental wellness
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: spacing.xxl }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <MusicNote sx={{ fontSize: 48, color: colors.primary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : wellnessStats.relaxationSessions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Relaxation Sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <SelfImprovement sx={{ fontSize: 48, color: colors.secondary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : `${wellnessStats.meditationMinutes}m`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Meditation Minutes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Air sx={{ fontSize: 48, color: colors.accent.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : wellnessStats.breathingExercises}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Breathing Exercises
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <NatureOutlined sx={{ fontSize: 48, color: colors.success.main, mb: spacing.md }} />
              <Typography variant="h6" gutterBottom>
                Naturljud
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Naturens healing kraft
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different wellness activities */}
      <Card className="world-class-dashboard-card">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="wellness activities tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<MusicNote />} 
              label="Avslappnande Ljud" 
              id="wellness-tab-0"
              aria-controls="wellness-tabpanel-0"
            />
            <Tab 
              icon={<SelfImprovement />} 
              label="Meditation" 
              id="wellness-tab-1"
              aria-controls="wellness-tabpanel-1"
            />
            <Tab 
              icon={<Air />} 
              label="Andningsövningar" 
              id="wellness-tab-2"
              aria-controls="wellness-tabpanel-2"
            />
            <Tab 
              icon={<Spa />} 
              label="Mindfulness" 
              id="wellness-tab-3"
              aria-controls="wellness-tabpanel-3"
            />
          </Tabs>
        </Box>

        <CardContent>
          {/* Relaxing Sounds Tab */}
          <TabPanel value={activeTab} index={0}>
            <RelaxingSounds onClose={() => {}} />
          </TabPanel>

          {/* Meditation Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
              <SelfImprovement sx={{ fontSize: 120, color: colors.secondary.main, mb: spacing.lg }} />
              <Typography variant="h4" gutterBottom>
                Guidade Meditationer
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Välj en meditation som passar din tid och ditt behov
              </Typography>

              <Grid container spacing={3} sx={{ mt: spacing.lg }}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        5 minuter - Snabb avkoppling
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Perfekt för en paus under dagen
                      </Typography>
                      <Button 
                        variant="contained" 
                        fullWidth
                        className="world-class-btn-primary"
                      >
                        Starta meditation
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        15 minuter - Djup avkoppling
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        För en längre paus och återhämtning
                      </Typography>
                      <Button 
                        variant="contained" 
                        fullWidth
                        className="world-class-btn-primary"
                      >
                        Starta meditation
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        30 minuter - Full session
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Komplett meditation för max effekt
                      </Typography>
                      <Button 
                        variant="contained" 
                        fullWidth
                        className="world-class-btn-primary"
                      >
                        Starta meditation
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Breathing Exercises Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
              <Air sx={{ fontSize: 120, color: colors.accent.main, mb: spacing.lg }} />
              <Typography variant="h4" gutterBottom>
                Andningsövningar
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Lugna ditt sinne och kropp med andningstekniker
              </Typography>

              <Grid container spacing={3} sx={{ mt: spacing.lg }}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        4-7-8 Andning
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Andas in på 4, håll i 7, andas ut på 8
                      </Typography>
                      <Box sx={{ my: spacing.lg }}>
                        <Box className="world-class-animate-breathe" sx={{
                          width: 100,
                          height: 100,
                          borderRadius: '50%',
                          bgcolor: colors.accent.light,
                          mx: 'auto',
                        }} />
                      </Box>
                      <Button 
                        variant="contained" 
                        fullWidth
                        className="world-class-btn-primary"
                      >
                        Starta övning
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Box Breathing
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Andas in 4, håll 4, ut 4, håll 4
                      </Typography>
                      <Box sx={{ my: spacing.lg }}>
                        <Box className="world-class-animate-pulse" sx={{
                          width: 100,
                          height: 100,
                          borderRadius: '8px',
                          bgcolor: colors.primary.light,
                          mx: 'auto',
                        }} />
                      </Box>
                      <Button 
                        variant="contained" 
                        fullWidth
                        className="world-class-btn-primary"
                      >
                        Starta övning
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Mindfulness Tab */}
          <TabPanel value={activeTab} index={3}>
            <Box sx={{ py: spacing.lg }}>
              <MicroInteractions>
                <Box sx={{ textAlign: 'center', py: spacing.lg }}>
                  <Typography variant="h6">Mindfulness & Micro-Interactions</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Upptäck små interaktioner som förbättrar din upplevelse
                  </Typography>
                </Box>
              </MicroInteractions>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Benefits Section */}
      <Box sx={{ mt: spacing.xxl, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom className="world-class-heading-2">
          Fördelar med Wellness
        </Typography>
        <Grid container spacing={3} sx={{ mt: spacing.lg }}>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>😌</Typography>
              <Typography variant="h6" gutterBottom>
                Minskad Stress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Regelbunden avkoppling minskar stressnivåer och ångest
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>😴</Typography>
              <Typography variant="h6" gutterBottom>
                Bättre Sömn
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avslappningsövningar förbättrar sömnkvalitet
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: spacing.lg }}>
              <Typography variant="h3" sx={{ mb: spacing.md }}>🧠</Typography>
              <Typography variant="h6" gutterBottom>
                Mentalt Välmående
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ökar mental klarhet och emotionell balans
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default WellnessHub;
