import React, { useEffect, useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { motion } from 'framer-motion';
import { Box, Typography, Paper, CircularProgress, Avatar } from '@mui/material';
import api from '../../api/api';

interface ActivityFeedProps {
  userId: string;
}

interface Activity {
  id: string;
  type: 'mood' | 'memory' | 'referral' | 'feedback';
  title: string;
  description: string;
  timestamp: Date;
  icon: string;
  color: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ userId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [userId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const allActivities: Activity[] = [];

      // Fetch moods
      try {
        const moodsResponse = await api.get(`/api/mood?user_id=${userId}`);
        const moods = (moodsResponse.data || []).slice(0, 5);
        moods.forEach((mood: any) => {
          const moodDate = mood.timestamp?.toDate ? mood.timestamp.toDate() : new Date(mood.timestamp);
          allActivities.push({
            id: `mood-${mood.id || Math.random()}`,
            type: 'mood',
            title: 'Humörloggning',
            description: `Loggade humör: ${mood.mood_text || 'Okänt'}`,
            timestamp: moodDate,
            icon: '😊',
            color: 'blue',
          });
        });
      } catch (error) {
        console.log('Could not load moods for activity feed');
      }

      // Fetch referrals
      try {
        const referralResponse = await api.get('/api/referral/history');
        const referrals = (referralResponse.data?.referrals || []).slice(0, 3);
        referrals.forEach((ref: any) => {
          allActivities.push({
            id: `referral-${ref.referred_user_id}`,
            type: 'referral',
            title: 'Ny referens',
            description: `${ref.referred_email} gick med via din kod!`,
            timestamp: new Date(ref.completed_at),
            icon: '🎁',
            color: 'purple',
          });
        });
      } catch (error) {
        console.log('Could not load referrals for activity feed');
      }

      // Fetch feedback
      try {
        const feedbackResponse = await api.get('/api/feedback/my-feedback');
        const feedbacks = (feedbackResponse.data?.feedback || []).slice(0, 3);
        feedbacks.forEach((fb: any) => {
          allActivities.push({
            id: `feedback-${fb.id}`,
            type: 'feedback',
            title: 'Feedback skickad',
            description: `Kategori: ${fb.category}`,
            timestamp: new Date(fb.timestamp),
            icon: '💬',
            color: 'green',
          });
        });
      } catch (error) {
        console.log('Could not load feedback for activity feed');
      }

      // Sort by timestamp (newest first)
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setActivities(allActivities.slice(0, 10)); // Show latest 10
    } catch (error) {
      console.error('Failed to load activity feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min sedan`;
    if (diffHours < 24) return `${diffHours} timmar sedan`;
    return `${diffDays} dagar sedan`;
  };

  const getColorStyles = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'info.light',
          borderColor: 'info.main',
          textColor: 'info.dark',
          iconBg: 'info.main',
        };
      case 'purple':
        return {
          bg: 'secondary.light',
          borderColor: 'secondary.main',
          textColor: 'secondary.dark',
          iconBg: 'secondary.main',
        };
      case 'green':
        return {
          bg: 'success.light',
          borderColor: 'success.main',
          textColor: 'success.dark',
          iconBg: 'success.main',
        };
      default:
        return {
          bg: 'grey.100',
          borderColor: 'grey.300',
          textColor: 'text.primary',
          iconBg: 'grey.500',
        };
    }
  };

  if (loading) {
    return (
      <Paper
        elevation={1}
        sx={{
          p: spacing.lg,
          borderRadius: borderRadius.xl,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight="semibold" sx={{ mb: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span>📋</span>
          Senaste aktivitet
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <CircularProgress size={40} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ height: 16, bgcolor: 'action.hover', borderRadius: 1, width: '75%', mb: spacing.sm }} />
                <Box sx={{ height: 12, bgcolor: 'action.hover', borderRadius: 1, width: '50%' }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={1}
      sx={{
        p: spacing.lg,
        borderRadius: borderRadius.xl,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" fontWeight="semibold" sx={{ mb: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span>📋</span>
        Senaste aktivitet
      </Typography>

      {activities.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h3" sx={{ mb: 1.5 }}>🌱</Typography>
          <Typography variant="body2" color="text.secondary">
            Ingen aktivitet än.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Börja genom att logga ditt humör!
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '500px', overflowY: 'auto' }}>
          {activities.map((activity, index) => {
            const colors = getColorStyles(activity.color);
            return (
              <Box
                component={motion.div}
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: borderRadius.md,
                  border: 1,
                  bgcolor: colors.bg,
                  borderColor: colors.borderColor,
                }}
              >
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: colors.iconBg,
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  {activity.icon}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="semibold" color={colors.textColor} noWrap>
                    {activity.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {activity.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {getTimeAgo(activity.timestamp)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

export default ActivityFeed;
