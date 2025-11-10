import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  IconButton,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  ContentCopy,
  Email,
  WhatsApp,
  Facebook,
  Twitter,
  CheckCircle,
  EmojiEvents
} from '@mui/icons-material';
import api from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  rewards_earned: number;
  next_reward_at: number;
}

const ReferralProgram: React.FC<{ userId: string }> = ({ userId }) => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchReferralStats();
  }, [userId]);

  const fetchReferralStats = async () => {
    try {
      const { data } = await api.get('/api/referral/stats', {
        params: { user_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch referral stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const getReferralLink = () => {
    return `https://lugntrygg.se/signup?ref=${stats?.referral_code || 'XXXXXX'}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getReferralLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaEmail = async () => {
    if (!emailInput) {
      setError('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    setError(null);

    try {
      await api.post('/api/referral/invite', {
        user_id: userId,
        email: emailInput,
        referral_link: getReferralLink()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Invitation sent successfully!');
      setEmailInput('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || String(e));
    } finally {
      setSendingEmail(false);
    }
  };

  const shareViaSocial = (platform: string) => {
    const link = getReferralLink();
    const message = 'Join me on Lugn & Trygg - a mental wellness app that helps you track your mood and improve your wellbeing! 🧠💙';

    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(message + ' ' + link)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}`;
        break;
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const progressToNextReward = stats
    ? ((stats.successful_referrals % 5) / 5) * 100
    : 0;

  return (
    <Card sx={{ maxWidth: 700, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <EmojiEvents color="warning" />
          Referral Program
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.lg }}>
          Invite friends to Lugn & Trygg and earn rewards! Get 1 week of premium for every 5 successful referrals.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: spacing.md }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: spacing.md }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {loading && <LinearProgress sx={{ mb: spacing.md }} />}

        {stats && !loading && (
          <>
            {/* Stats Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing.md, mb: spacing.lg }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {stats.successful_referrals}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Successful Referrals
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="warning.main">
                    {stats.pending_referrals}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pending
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="success.main">
                    {stats.rewards_earned}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Weeks Premium Earned
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Progress to Next Reward */}
            <Box sx={{ mb: spacing.lg }}>
              <Typography variant="subtitle2" gutterBottom>
                Progress to Next Reward
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progressToNextReward}
                sx={{ height: 10, borderRadius: 5, mb: spacing.sm }}
              />
              <Typography variant="caption" color="text.secondary">
                {stats.successful_referrals % 5} / 5 referrals
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Referral Link */}
            <Box sx={{ mb: spacing.lg }}>
              <Typography variant="h6" gutterBottom>
                Your Referral Link
              </Typography>
              <Box sx={{ display: 'flex', gap: spacing.sm }}>
                <TextField
                  fullWidth
                  value={getReferralLink()}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <IconButton onClick={copyToClipboard} edge="end">
                        {copied ? <CheckCircle color="success" /> : <ContentCopy />}
                      </IconButton>
                    )
                  }}
                />
              </Box>
              {copied && (
                <Typography variant="caption" color="success.main" sx={{ mt: spacing.sm, display: 'block' }}>
                  ✓ Copied to clipboard!
                </Typography>
              )}
            </Box>

            {/* Share via Email */}
            <Box sx={{ mb: spacing.lg }}>
              <Typography variant="h6" gutterBottom>
                Invite via Email
              </Typography>
              <Box sx={{ display: 'flex', gap: spacing.sm }}>
                <TextField
                  fullWidth
                  type="email"
                  placeholder="friend@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                <Button
                  variant="contained"
                  startIcon={<Email />}
                  onClick={shareViaEmail}
                  disabled={sendingEmail}
                >
                  Send
                </Button>
              </Box>
            </Box>

            {/* Social Sharing */}
            <Box sx={{ mb: spacing.lg }}>
              <Typography variant="h6" gutterBottom>
                Share on Social Media
              </Typography>
              <Box sx={{ display: 'flex', gap: spacing.md }}>
                <Button
                  variant="outlined"
                  startIcon={<WhatsApp />}
                  onClick={() => shareViaSocial('whatsapp')}
                  sx={{ color: '#25D366', borderColor: '#25D366' }}
                >
                  WhatsApp
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Facebook />}
                  onClick={() => shareViaSocial('facebook')}
                  sx={{ color: '#1877F2', borderColor: '#1877F2' }}
                >
                  Facebook
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Twitter />}
                  onClick={() => shareViaSocial('twitter')}
                  sx={{ color: '#1DA1F2', borderColor: '#1DA1F2' }}
                >
                  Twitter
                </Button>
              </Box>
            </Box>

            {/* Rewards Info */}
            <Alert severity="info" icon={<EmojiEvents />}>
              <Typography variant="subtitle2" gutterBottom>
                Reward Tiers
              </Typography>
              <Typography variant="body2">
                • 5 referrals = 1 week premium<br />
                • 10 referrals = 1 month premium<br />
                • 25 referrals = 3 months premium<br />
                • 50 referrals = 1 year premium FREE!
              </Typography>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralProgram;
