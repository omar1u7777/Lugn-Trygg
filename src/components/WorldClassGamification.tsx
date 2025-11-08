import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  LinearProgress,
  Avatar,
  Badge,
  IconButton,
} from '@mui/material';
import {
  EmojiEvents,
  Star,
  Whatshot,
  Psychology,
  Favorite,
  TrendingUp,
  Close,
  Share,
  Lock,
  CheckCircle,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import useAuth from '../hooks/useAuth';
import '../styles/world-class-design.css';

interface WorldClassGamificationProps {
  onClose: () => void;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'mood' | 'streak' | 'social' | 'growth';
}

interface UserStats {
  level: number;
  xp: number;
  xpToNext: number;
  streakDays: number;
  totalMoods: number;
  totalChats: number;
  achievementsUnlocked: number;
  totalAchievements: number;
}

const WorldClassGamification: React.FC<WorldClassGamificationProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    xpToNext: 100,
    streakDays: 0,
    totalMoods: 0,
    totalChats: 0,
    achievementsUnlocked: 0,
    totalAchievements: 0,
  });

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.page('World Class Gamification', {
      component: 'WorldClassGamification',
    });

    loadGamificationData();
  }, [user]);

  const loadGamificationData = async () => {
    try {
      setLoading(true);

      // Mock data - in real app, this would come from backend
      const mockStats: UserStats = {
        level: 3,
        xp: 250,
        xpToNext: 500,
        streakDays: 7,
        totalMoods: 23,
        totalChats: 12,
        achievementsUnlocked: 8,
        totalAchievements: 24,
      };

      const mockAchievements: Achievement[] = [
        {
          id: 'first-mood',
          title: 'Första steget',
          description: 'Logga ditt första humör',
          icon: <Favorite />,
          unlocked: true,
          progress: 1,
          maxProgress: 1,
          rarity: 'common',
          category: 'mood',
        },
        {
          id: 'week-streak',
          title: 'Veckovinnare',
          description: 'Logga humör 7 dagar i rad',
          icon: <Whatshot />,
          unlocked: true,
          progress: 7,
          maxProgress: 7,
          rarity: 'rare',
          category: 'streak',
        },
        {
          id: 'mood-explorer',
          title: 'Humörutforskare',
          description: 'Prova alla humör-typer',
          icon: <Psychology />,
          unlocked: false,
          progress: 6,
          maxProgress: 7,
          rarity: 'epic',
          category: 'mood',
        },
        {
          id: 'conversation-starter',
          title: 'Samtalsinitiatör',
          description: 'Ha 10 AI-samtal',
          icon: <Psychology />,
          unlocked: true,
          progress: 12,
          maxProgress: 10,
          rarity: 'common',
          category: 'growth',
        },
        {
          id: 'consistency-king',
          title: 'Konsekvenskung',
          description: 'Logga humör 30 dagar i rad',
          icon: <Star />,
          unlocked: false,
          progress: 7,
          maxProgress: 30,
          rarity: 'legendary',
          category: 'streak',
        },
        {
          id: 'insight-seeker',
          title: 'Insiktsjägare',
          description: 'Få 5 AI-insikter',
          icon: <TrendingUp />,
          unlocked: false,
          progress: 2,
          maxProgress: 5,
          rarity: 'rare',
          category: 'growth',
        },
      ];

      setStats(mockStats);
      setAchievements(mockAchievements);

      announceToScreenReader('Gamification data loaded successfully', 'polite');

    } catch (error) {
      console.error('Failed to load gamification data:', error);
      announceToScreenReader('Failed to load gamification data', 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'grey.400';
      case 'rare': return 'blue.400';
      case 'epic': return 'purple.400';
      case 'legendary': return 'orange.400';
      default: return 'grey.400';
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return '👑';
      case 'epic': return '💎';
      case 'rare': return '⭐';
      default: return '🏅';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'mood': return <Favorite sx={{ fontSize: 16 }} />;
      case 'streak': return <Whatshot sx={{ fontSize: 16 }} />;
      case 'social': return <Share sx={{ fontSize: 16 }} />;
      case 'growth': return <TrendingUp sx={{ fontSize: 16 }} />;
      default: return <EmojiEvents sx={{ fontSize: 16 }} />;
    }
  };

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const lockedAchievements = achievements.filter(a => !a.unlocked);

  if (loading) {
    return (
      <Box className="world-class-app" sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" className="world-class-body">
          Laddar dina achievements...
        </Typography>
        <LinearProgress sx={{ mt: 2, borderRadius: 2, height: 8 }} />
      </Box>
    );
  }

  return (
    <Box
      className="world-class-app"
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)',
        p: 2,
      }}
    >
      <Card className="world-class-dashboard-card" sx={{ maxWidth: 1200, mx: 'auto' }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" className="world-class-heading-2">
              🏆 Dina Achievements & Framsteg
            </Typography>
            <IconButton onClick={onClose} aria-label="Close gamification">
              <Close />
            </IconButton>
          </Box>

          {/* Level & XP */}
          <Card className="world-class-dashboard-card world-class-dashboard-card-premium" sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Badge
                    badgeContent={stats.level}
                    color="primary"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        minWidth: 28,
                        height: 28,
                      }
                    }}
                  >
                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                      <Star sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Badge>
                  <Box>
                    <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                      Nivå {stats.level}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {stats.xp} / {stats.xpToNext} XP till nästa nivå
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                    {stats.streakDays} dagar i rad 🔥
                  </Typography>
                  <Chip
                    label={`${stats.achievementsUnlocked}/${stats.totalAchievements} Achievements`}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.3)',
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={(stats.xp / stats.xpToNext) * 100}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'white',
                      borderRadius: 6,
                    }
                  }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Stats Overview */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {stats.totalMoods}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  Humör-loggar
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {stats.totalChats}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  AI-samtal
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {stats.streakDays}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  Streak dagar
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Card className="world-class-analytics-card">
                <Typography variant="h4" className="world-class-analytics-value">
                  {stats.achievementsUnlocked}
                </Typography>
                <Typography variant="body2" className="world-class-analytics-label">
                  Upplåsta
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Unlocked Achievements */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" className="world-class-heading-3" gutterBottom>
              🏅 Upplåsta Achievements ({unlockedAchievements.length})
            </Typography>

            <Grid container spacing={2}>
              {unlockedAchievements.map((achievement) => (
                <Grid item xs={12} sm={6} md={4} key={achievement.id}>
                  <Card
                    className="world-class-dashboard-card world-class-success-celebration"
                    sx={{
                      position: 'relative',
                      border: `2px solid ${getRarityColor(achievement.rarity)}`,
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                        <Typography variant="caption" sx={{ fontSize: '1.2rem' }}>
                          {getRarityIcon(achievement.rarity)}
                        </Typography>
                      </Box>

                      <Avatar
                        sx={{
                          width: 64,
                          height: 64,
                          bgcolor: 'success.main',
                          mx: 'auto',
                          mb: 2,
                        }}
                      >
                        {achievement.icon}
                      </Avatar>

                      <Typography variant="h6" gutterBottom>
                        {achievement.title}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {achievement.description}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        {getCategoryIcon(achievement.category)}
                        <Chip
                          label={achievement.category}
                          size="small"
                          variant="outlined"
                        />
                      </Box>

                      <CheckCircle sx={{ color: 'success.main', mt: 2, fontSize: 24 }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Locked Achievements */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" className="world-class-heading-3" gutterBottom>
              🔒 Kommande Achievements ({lockedAchievements.length})
            </Typography>

            <Grid container spacing={2}>
              {lockedAchievements.map((achievement) => (
                <Grid item xs={12} sm={6} md={4} key={achievement.id}>
                  <Card
                    className="world-class-dashboard-card"
                    sx={{
                      position: 'relative',
                      opacity: 0.7,
                      border: `2px solid ${getRarityColor(achievement.rarity)}`,
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                        <Typography variant="caption" sx={{ fontSize: '1.2rem' }}>
                          {getRarityIcon(achievement.rarity)}
                        </Typography>
                      </Box>

                      <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                        <Avatar
                          sx={{
                            width: 64,
                            height: 64,
                            bgcolor: 'grey.400',
                            mx: 'auto',
                          }}
                        >
                          {achievement.icon}
                        </Avatar>
                        <Lock
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: 'grey.600',
                            fontSize: 24,
                          }}
                        />
                      </Box>

                      <Typography variant="h6" gutterBottom>
                        {achievement.title}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {achievement.description}
                      </Typography>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Framsteg: {achievement.progress} / {achievement.maxProgress}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(achievement.progress / achievement.maxProgress) * 100}
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        {getCategoryIcon(achievement.category)}
                        <Chip
                          label={achievement.category}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Motivation Section */}
          <Card className="world-class-dashboard-card" sx={{ bgcolor: 'primary.light', color: 'white' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                🚀 Fortsätt din resa!
              </Typography>
              <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
                Varje steg du tar mot bättre mental hälsa är viktigt. Du är på rätt väg!
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'grey.100' }
                  }}
                  startIcon={<Favorite />}
                >
                  Logga humör idag
                </Button>

                <Button
                  variant="outlined"
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                  }}
                  startIcon={<Share />}
                >
                  Dela framsteg
                </Button>
              </Box>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WorldClassGamification;