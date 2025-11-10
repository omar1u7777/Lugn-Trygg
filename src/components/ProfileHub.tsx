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
  Button,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Person,
  Security,
  Notifications,
  PrivacyTip,
  Language,
  Palette,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PrivacySettings from './PrivacySettings';
import NotificationPermission from './NotificationPermission';
import { ThemeToggle } from './ui/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import useAuth from '../hooks/useAuth';
import { colors, spacing } from '@/theme/tokens';
import { getMoods, getChatHistory, getMemories } from '../api/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`profile-tabpanel-${index}`}
    aria-labelledby={`profile-tab-${index}`}
  >
    {value === index && <Box sx={{ py: spacing.xl }}>{children}</Box>}
  </div>
);

interface ProfileStats {
  totalMoods: number;
  totalConversations: number;
  totalMemories: number;
  accountAge: number;
}

const ProfileHub: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    dataSharing: false,
    publicProfile: false,
  });
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalMoods: 0,
    totalConversations: 0,
    totalMemories: 0,
    accountAge: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user activity data
        const [moods, chatHistory, memories] = await Promise.all([
          getMoods(user.user_id),
          getChatHistory(user.user_id),
          getMemories(user.user_id),
        ]);

        // Calculate account age (placeholder - would need user creation date from backend)
        const accountAge = 30; // Default to 30 days

        setProfileStats({
          totalMoods: moods.length,
          totalConversations: chatHistory.length,
          totalMemories: memories.length,
          accountAge,
        });
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.user_id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSettingChange = (setting: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [setting]: event.target.checked });
  };

  return (
    <Box sx={{ minHeight: '100vh', p: spacing.xl }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: spacing.xxl }}>
        <Avatar
          sx={{
            width: 120,
            height: 120,
            margin: '0 auto',
            mb: spacing.lg,
            bgcolor: colors.primary.main,
            fontSize: 48,
          }}
        >
          {user?.email?.charAt(0).toUpperCase() || '👤'}
        </Avatar>
        <Typography 
          variant="h2" 
          className="world-class-heading-1"
          gutterBottom
        >
          👤 Profile Hub
        </Typography>
        <Typography 
          variant="h5" 
          className="world-class-body-large"
          color="text.secondary"
        >
          {user?.email || 'Hantera dina inställningar och säkerhet'}
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: spacing.xxl }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Person sx={{ fontSize: 48, color: colors.primary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : profileStats.totalMoods}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Mood Logs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <Security sx={{ fontSize: 48, color: colors.success.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : profileStats.totalConversations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AI Conversations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="world-class-dashboard-card">
            <CardContent sx={{ textAlign: 'center', p: spacing.lg }}>
              <PrivacyTip sx={{ fontSize: 48, color: colors.warning.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : profileStats.totalMemories}
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
              <Notifications sx={{ fontSize: 48, color: colors.secondary.main, mb: spacing.md }} />
              <Typography variant="h4" gutterBottom>
                {loading ? '...' : `${profileStats.accountAge}d`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Account Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different profile sections */}
      <Card className="world-class-dashboard-card">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="profile tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<Person />} 
              label="Account Settings" 
              id="profile-tab-0"
              aria-controls="profile-tabpanel-0"
            />
            <Tab 
              icon={<PrivacyTip />} 
              label="Privacy" 
              id="profile-tab-1"
              aria-controls="profile-tabpanel-1"
            />
            <Tab 
              icon={<Notifications />} 
              label="Notifications" 
              id="profile-tab-2"
              aria-controls="profile-tabpanel-2"
            />
            <Tab 
              icon={<Palette />} 
              label="Appearance" 
              id="profile-tab-3"
              aria-controls="profile-tabpanel-3"
            />
          </Tabs>
        </Box>

        <CardContent>
          {/* Account Settings Tab */}
          <TabPanel value={activeTab} index={0}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Account Information
              </Typography>
              <Grid container spacing={3} sx={{ mt: spacing.md }}>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Email Address
                      </Typography>
                      <Typography variant="h6" gutterBottom>
                        {user?.email || 'Not logged in'}
                      </Typography>
                      <Button variant="outlined" size="small" sx={{ mt: spacing.sm }}>
                        Change Email
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Password
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        ••••••••••
                      </Typography>
                      <Button variant="outlined" size="small" sx={{ mt: spacing.sm }}>
                        Change Password
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ bgcolor: 'warning.light' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        🔐 Two-Factor Authentication
                      </Typography>
                      <Typography variant="body2" paragraph>
                        Add an extra layer of security to your account
                      </Typography>
                      <Button variant="contained" color="warning">
                        Enable 2FA
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Privacy Tab */}
          <TabPanel value={activeTab} index={1}>
            {user?.user_id ? (
              <PrivacySettings userId={user.user_id} />
            ) : (
              <Box sx={{ textAlign: 'center', py: spacing.xxl }}>
                <Typography variant="h6" color="text.secondary">
                  Please log in to manage privacy settings
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Notification Preferences
              </Typography>
              <Grid container spacing={2} sx={{ mt: spacing.md }}>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.emailNotifications}
                            onChange={handleSettingChange('emailNotifications')}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="subtitle1">
                              Email Notifications
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Receive updates and insights via email
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.pushNotifications}
                            onChange={handleSettingChange('pushNotifications')}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="subtitle1">
                              Push Notifications
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Get real-time alerts on your device
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <NotificationPermission />
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Appearance Tab */}
          <TabPanel value={activeTab} index={3}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Appearance Settings
              </Typography>
              <Grid container spacing={3} sx={{ mt: spacing.md }}>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Theme Mode
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Switch between light and dark mode
                      </Typography>
                      <ThemeToggle />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Language
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Choose your preferred language
                      </Typography>
                      <LanguageSwitcher />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Box sx={{ mt: spacing.xxl }}>
        <Card className="world-class-dashboard-card">
          <CardContent>
            <Typography variant="h5" gutterBottom className="world-class-heading-3">
              Account Actions
            </Typography>
            <Grid container spacing={2} sx={{ mt: spacing.md }}>
              <Grid item xs={12} md={6}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  size="large"
                  startIcon={<Security />}
                >
                  Export My Data
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button 
                  variant="outlined" 
                  color="error"
                  fullWidth
                  size="large"
                >
                  Delete Account
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ProfileHub;
