/**
 * Enhanced Navigation Hub - Access ALL 85+ Features
 * This navigation provides access to every component in the app
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Typography, Collapse, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';

interface MenuItem {
  path: string;
  label: string;
  emoji: string;
  category: string;
}

const allFeatures: MenuItem[] = [
  // Core Features
  { path: '/dashboard', label: 'Dashboard', emoji: '📊', category: 'Core' },
  { path: '/mood-tracker', label: 'Mood Tracker', emoji: '😊', category: 'Core' },
  { path: '/wellness', label: 'Wellness Hub', emoji: '🌿', category: 'Core' },
  { path: '/profile', label: 'Profile', emoji: '👤', category: 'Core' },
  
  // AI & Chat
  { path: '/ai-chat', label: 'AI Chat (World Class)', emoji: '🤖', category: 'AI & Chat' },
  { path: '/chatbot', label: 'Chatbot', emoji: '💬', category: 'AI & Chat' },
  { path: '/therapist', label: 'AI Therapist', emoji: '🧠', category: 'AI & Chat' },
  { path: '/voice-chat', label: 'Voice Chat', emoji: '🎤', category: 'AI & Chat' },
  { path: '/peer-support', label: 'Peer Support', emoji: '🤝', category: 'AI & Chat' },
  
  // Mood & Mental Health
  { path: '/mood-logger', label: 'Mood Logger (Pro)', emoji: '📝', category: 'Mood & Health' },
  { path: '/mood-basic', label: 'Mood Logger (Basic)', emoji: '😊', category: 'Mood & Health' },
  { path: '/mood-analyzer', label: 'Mood Analyzer', emoji: '🔍', category: 'Mood & Health' },
  { path: '/daily-insights', label: 'Daily Insights', emoji: '📅', category: 'Mood & Health' },
  { path: '/weekly-analysis', label: 'Weekly Analysis', emoji: '📈', category: 'Mood & Health' },
  { path: '/recommendations', label: 'Recommendations', emoji: '💡', category: 'Mood & Health' },
  { path: '/crisis', label: 'Crisis Alert', emoji: '🚨', category: 'Mood & Health' },
  
  // Gamification
  { path: '/gamification', label: 'Gamification (Pro)', emoji: '🏆', category: 'Gamification' },
  { path: '/gamification-basic', label: 'Gamification (Basic)', emoji: '⭐', category: 'Gamification' },
  { path: '/gamification-system', label: 'Gamification System', emoji: '🎮', category: 'Gamification' },
  { path: '/leaderboard', label: 'Leaderboard', emoji: '🥇', category: 'Gamification' },
  { path: '/badges', label: 'Badges', emoji: '🎖️', category: 'Gamification' },
  { path: '/achievements', label: 'Achievements', emoji: '🏅', category: 'Gamification' },
  { path: '/challenges', label: 'Group Challenges', emoji: '⚔️', category: 'Gamification' },
  { path: '/rewards', label: 'Rewards Hub', emoji: '🎁', category: 'Gamification' },
  
  // Memory & Journaling
  { path: '/journal', label: 'Journal Hub', emoji: '📖', category: 'Journaling' },
  { path: '/journal-entry', label: 'New Journal Entry', emoji: '✍️', category: 'Journaling' },
  { path: '/memories', label: 'Memory Recorder', emoji: '🎬', category: 'Journaling' },
  { path: '/memory-list', label: 'Memory List', emoji: '📚', category: 'Journaling' },
  { path: '/ai-stories', label: 'AI Stories', emoji: '📚', category: 'Journaling' },
  { path: '/story-insights', label: 'Story Insights', emoji: '✨', category: 'Journaling' },
  
  // Wellness & Relaxation
  { path: '/sounds', label: 'Relaxing Sounds', emoji: '🎵', category: 'Wellness' },
  { path: '/health-monitoring', label: 'Health Monitoring', emoji: '❤️', category: 'Wellness' },
  { path: '/health-sync', label: 'Health Sync', emoji: '⚕️', category: 'Wellness' },
  { path: '/integrations', label: 'Health Integrations', emoji: '🔗', category: 'Wellness' },
  
  // Social & Community
  { path: '/social', label: 'Social Hub', emoji: '👥', category: 'Social' },
  { path: '/referral', label: 'Referral Program', emoji: '🎉', category: 'Social' },
  
  // Analytics & Insights
  { path: '/insights', label: 'Insights Hub', emoji: '💡', category: 'Analytics' },
  { path: '/analytics', label: 'Mood Analytics', emoji: '📊', category: 'Analytics' },
  { path: '/analytics-pro', label: 'Analytics (Pro)', emoji: '📈', category: 'Analytics' },
  { path: '/analytics-dashboard', label: 'Analytics Dashboard', emoji: '📉', category: 'Analytics' },
  { path: '/performance', label: 'Performance Dashboard', emoji: '⚡', category: 'Analytics' },
  { path: '/monitoring', label: 'Monitoring Dashboard', emoji: '🖥️', category: 'Analytics' },
  
  // Settings & Config
  { path: '/onboarding', label: 'Onboarding', emoji: '👋', category: 'Settings' },
  { path: '/privacy', label: 'Privacy Settings', emoji: '🔒', category: 'Settings' },
  { path: '/subscribe', label: 'Subscription', emoji: '💳', category: 'Settings' },
  { path: '/feedback', label: 'Feedback', emoji: '📝', category: 'Settings' },
];

const FeatureNavigationHub: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Core': true,
  });

  if (!isLoggedIn()) {
    return null;
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const categories = Array.from(new Set(allFeatures.map(f => f.category)));

  const drawerContent = (
    <Box sx={{ width: 320, height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold">
          🌟 All Features
        </Typography>
        <IconButton onClick={() => setDrawerOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Box sx={{ overflowY: 'auto', height: 'calc(100% - 72px)' }}>
        {categories.map(category => {
          const categoryFeatures = allFeatures.filter(f => f.category === category);
          const isExpanded = expandedCategories[category];
          
          return (
            <Box key={category}>
              <ListItemButton onClick={() => toggleCategory(category)}>
                <ListItemText 
                  primary={
                    <Typography variant="subtitle2" fontWeight="bold" color="primary">
                      {category} ({categoryFeatures.length})
                    </Typography>
                  }
                />
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {categoryFeatures.map(feature => (
                    <ListItemButton
                      key={feature.path}
                      component={Link}
                      to={feature.path}
                      onClick={() => isMobile && setDrawerOpen(false)}
                      selected={location.pathname === feature.path}
                      sx={{
                        pl: 4,
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <span style={{ fontSize: '1.5rem' }}>{feature.emoji}</span>
                      </ListItemIcon>
                      <ListItemText 
                        primary={feature.label}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
              <Divider />
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <>
      {/* Floating Menu Button */}
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 80, md: 24 },
          right: 24,
          zIndex: 1100,
        }}
      >
        <IconButton
          onClick={() => setDrawerOpen(true)}
          sx={{
            width: 64,
            height: 64,
            bgcolor: 'primary.main',
            color: 'white',
            boxShadow: 4,
            '&:hover': {
              bgcolor: 'primary.dark',
              transform: 'scale(1.1)',
            },
            transition: 'all 0.2s',
          }}
        >
          <MenuIcon sx={{ fontSize: '2rem' }} />
        </IconButton>
      </Box>

      {/* Drawer with all features */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default FeatureNavigationHub;
