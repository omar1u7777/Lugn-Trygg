/**
 * Achievement Sharing Component
 * Share milestones and achievements with friends and community
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  Grid
} from '@mui/material';

import { useTranslation } from 'react-i18next';
import ShareIcon from '@mui/icons-material/Share';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import { trackEvent } from '../services/analytics';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  date: Date;
  category: 'streak' | 'milestone' | 'badge' | 'challenge';
}

interface AchievementSharingProps {
  achievement: Achievement;
  userId: string;
  onClose: () => void;
}

export const AchievementSharing: React.FC<AchievementSharingProps> = ({
  achievement,
  userId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [shareMessage, setShareMessage] = useState(
    `I just earned "${achievement.title}" on Lugn & Trygg! 🎉`
  );
  const [shareAnonymously, setShareAnonymously] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  const generateShareableImage = () => {
    // In production, this would generate a beautiful share card
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 630);
      
      // Achievement icon
      ctx.font = '120px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(achievement.icon, 600, 250);
      
      // Achievement title
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.fillText(achievement.title, 600, 380);
      
      // Description
      ctx.font = '32px Arial';
      ctx.fillText(achievement.description, 600, 450);
      
      // App name
      ctx.font = '24px Arial';
      ctx.fillText('Lugn & Trygg', 600, 550);
    }
    
    return canvas.toDataURL('image/png');
  };

  const handleShareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://lugn-trygg.app/achievements/' + achievement.id)}`;
    window.open(url, '_blank', 'width=600,height=400');
    
    trackEvent('achievement_shared', {
      userId,
      achievementId: achievement.id,
      platform: 'facebook',
      anonymous: shareAnonymously,
    });
  };

  const handleShareToTwitter = () => {
    const text = encodeURIComponent(shareMessage);
    const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent('https://lugn-trygg.app')}`;
    window.open(url, '_blank', 'width=600,height=400');
    
    trackEvent('achievement_shared', {
      userId,
      achievementId: achievement.id,
      platform: 'twitter',
      anonymous: shareAnonymously,
    });
  };

  const handleCopyLink = () => {
    const link = `https://lugn-trygg.app/achievements/${achievement.id}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    
    setTimeout(() => setLinkCopied(false), 3000);
    
    trackEvent('achievement_link_copied', {
      userId,
      achievementId: achievement.id,
    });
  };

  const handleDownloadImage = () => {
    const imageUrl = generateShareableImage();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `lugn-trygg-achievement-${achievement.id}.png`;
    link.click();
    
    trackEvent('achievement_image_downloaded', {
      userId,
      achievementId: achievement.id,
    });
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareIcon color="primary" />
          {t('share.title', 'Share Achievement')}
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Achievement Preview */}
        <Card
          sx={{
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textAlign: 'center',
            p: 3,
          }}
        >
          <Typography variant="h1" sx={{ mb: 2 }}>
            {achievement.icon}
          </Typography>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            {achievement.title}
          </Typography>
          <Typography variant="body2">{achievement.description}</Typography>
          <Chip
            label={new Date(achievement.date).toLocaleDateString()}
            size="small"
            sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
        </Card>

        {/* Share Message */}
        <TextField
          fullWidth
          multiline
          rows={3}
          label={t('share.message', 'Share Message')}
          value={shareMessage}
          onChange={(e) => setShareMessage(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* Privacy Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={shareAnonymously}
              onChange={(e) => setShareAnonymously(e.target.checked)}
            />
          }
          label={t('share.anonymous', 'Share anonymously (hide your name)')}
          sx={{ mb: 2 }}
        />

        {shareAnonymously && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('share.anonymousInfo', 'Your personal information will not be included when sharing.')}
          </Alert>
        )}

        {/* Share Buttons */}
        <Typography variant="subtitle2" gutterBottom>
          {t('share.platforms', 'Share to:')}
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid xs={6}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FacebookIcon />}
              onClick={handleShareToFacebook}
              sx={{ justifyContent: 'flex-start' }}
            >
              Facebook
            </Button>
          </Grid>
          <Grid xs={6}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<TwitterIcon />}
              onClick={handleShareToTwitter}
              sx={{ justifyContent: 'flex-start' }}
            >
              Twitter
            </Button>
          </Grid>
          <Grid xs={6}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={handleCopyLink}
              color={linkCopied ? 'success' : 'primary'}
              sx={{ justifyContent: 'flex-start' }}
            >
              {linkCopied ? t('share.copied', 'Copied!') : t('share.copyLink', 'Copy Link')}
            </Button>
          </Grid>
          <Grid xs={6}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadImage}
              sx={{ justifyContent: 'flex-start' }}
            >
              {t('share.downloadImage', 'Download')}
            </Button>
          </Grid>
        </Grid>

        <Alert severity="success">
          {t('share.motivation', 'Sharing your progress can inspire others and strengthen your own commitment! 💪')}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

// Main component to trigger sharing
interface ShareAchievementButtonProps {
  achievement: Achievement;
  userId: string;
}

export const ShareAchievementButton: React.FC<ShareAchievementButtonProps> = ({
  achievement,
  userId,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton color="primary" onClick={() => setOpen(true)} aria-label="Share achievement">
        <ShareIcon />
      </IconButton>
      {open && (
        <AchievementSharing
          achievement={achievement}
          userId={userId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default AchievementSharing;
