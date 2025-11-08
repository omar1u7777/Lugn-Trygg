import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Paper, 
    Grid, 
    Button, 
    LinearProgress, 
    Alert,
    CircularProgress,
    Snackbar,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';
import ReferralLeaderboard from './ReferralLeaderboard';
import ReferralHistory from './ReferralHistory';
import RewardsCatalog from './RewardsCatalog';
import EmailInvite from './EmailInvite';

interface ReferralData {
    referralCode: string;
    referralLink: string;
    referralCount: number;
    rewards: number;
    tier: string;
}

interface ReferralStats {
    total: number;
    active: number;
    converted: number;
}

const ReferralProgram: React.FC = () => {
    const { user } = useAuth();
    const [referralData, setReferralData] = useState<ReferralData | null>(null);
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.user_id) {
            fetchReferralData();
            fetchReferralStats();
        }
    }, [user]);

    const fetchReferralData = async () => {
        if (!user?.user_id) {
            setError('User not authenticated');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/api/referral/generate', {
                user_id: user.user_id
            });
            
            const data = response.data;
            setReferralData({
                referralCode: data.referral_code || '',
                referralLink: `https://lugn-trygg.vercel.app/register?ref=${data.referral_code}`,
                referralCount: data.successful_referrals || 0,
                rewards: data.rewards_earned || 0,
                tier: calculateTier(data.successful_referrals || 0)
            });
            setError(null);
        } catch (err: any) {
            console.error('❌ Failed to fetch referral data:', err);
            setError(err.response?.data?.error || 'Failed to load referral data');
        } finally {
            setLoading(false);
        }
    };

    const fetchReferralStats = async () => {
        if (!user?.user_id) return;

        try {
            const response = await api.get(`/api/referral/stats?user_id=${user.user_id}`);
            const data = response.data;
            
            setStats({
                total: data.total_referrals || 0,
                active: data.successful_referrals || 0,
                converted: data.successful_referrals || 0
            });
        } catch (err: any) {
            console.error('❌ Failed to fetch referral stats:', err);
        }
    };

    const calculateTier = (referralCount: number): string => {
        if (referralCount >= 30) return 'Platinum';
        if (referralCount >= 15) return 'Gold';
        if (referralCount >= 5) return 'Silver';
        return 'Bronze';
    };

    const handleCopyCode = () => {
        if (referralData?.referralCode) {
            navigator.clipboard.writeText(referralData.referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleCopyLink = () => {
        if (referralData?.referralLink) {
            navigator.clipboard.writeText(referralData.referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleShare = (platform: string) => {
        if (!referralData) return;

        const message = `Gå med i Lugn & Trygg och få bättre mental hälsa! Använd min referenskod: ${referralData.referralCode}`;
        const encodedMessage = encodeURIComponent(message);
        const encodedLink = encodeURIComponent(referralData.referralLink);

        const shareUrls: { [key: string]: string } = {
            whatsapp: `https://wa.me/?text=${encodedMessage}%20${encodedLink}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`,
            twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedLink}`,
            email: `mailto:?subject=Gå med i Lugn & Trygg&body=${encodedMessage}%20${encodedLink}`
        };

        if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank');
        }
    };

    const getTierInfo = (tier: string): { emoji: string, color: string, nextTier?: string, required?: number } => {
        const defaultTier = { emoji: '🥉', color: 'bg-amber-700', nextTier: 'Silver', required: 5 };
        const tiers: { [key: string]: { emoji: string, color: string, nextTier?: string, required?: number } } = {
            Bronze: defaultTier,
            Silver: { emoji: '🥈', color: 'bg-slate-400', nextTier: 'Gold', required: 10 },
            Gold: { emoji: '🥇', color: 'bg-yellow-400', nextTier: 'Platinum', required: 15 },
            Platinum: { emoji: '💎', color: 'bg-purple-600' }
        };
        return tiers[tier] ?? defaultTier;
    };

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: '60vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                        Laddar referensprogram...
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
                <Alert severity="error" icon={<span style={{ fontSize: '1.5rem' }}>❌</span>} sx={{ borderRadius: 3, p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Något gick fel
                    </Typography>
                    <Typography variant="body2">
                        {error}
                    </Typography>
                </Alert>
            </Box>
        );
    }

    if (!referralData) {
        return (
            <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
                <Alert severity="warning" icon={<span style={{ fontSize: '1.5rem' }}>⚠️</span>} sx={{ borderRadius: 3, p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Ingen data tillgänglig
                    </Typography>
                    <Typography variant="body2">
                        Kunde inte ladda referensdata.
                    </Typography>
                </Alert>
            </Box>
        );
    }

    const tierInfo = getTierInfo(referralData.tier);

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography variant="h3" fontWeight="bold" color="text.primary" gutterBottom>
                    🤝 Referensprogram
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 'md', mx: 'auto' }}>
                    Bjud in vänner och få belöningar! Både du och din vän tjänar på det.
                </Typography>
            </Box>

            {/* Copy Confirmation Snackbar */}
            <Snackbar
                open={copied}
                autoHideDuration={3000}
                onClose={() => setCopied(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    ✅ Kopierat till urklipp!
                </Alert>
            </Snackbar>

            {/* Tier Status */}
            <Paper
                elevation={3}
                sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 3,
                    p: 4,
                    color: 'white',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box>
                        <Typography variant="h4" fontWeight="bold" gutterBottom>
                            Din nivå: {referralData.tier}
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            {tierInfo.nextTier 
                                ? `${tierInfo.required! - referralData.referralCount} fler referenser till ${tierInfo.nextTier}`
                                : 'Högsta nivån uppnådd! 🎉'}
                        </Typography>
                    </Box>
                    <Typography variant="h1" sx={{ fontSize: '4rem' }}>
                        {tierInfo.emoji}
                    </Typography>
                </Box>
                
                {/* Progress Bar */}
                {tierInfo.nextTier && (
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                {referralData.tier}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                {tierInfo.nextTier}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, (referralData.referralCount / tierInfo.required!) * 100)}
                            sx={{
                                height: 12,
                                borderRadius: 2,
                                bgcolor: 'rgba(255,255,255,0.2)',
                                '& .MuiLinearProgress-bar': {
                                    bgcolor: 'white',
                                },
                            }}
                        />
                        <Typography variant="body2" textAlign="center" sx={{ mt: 1, color: 'rgba(255,255,255,0.9)' }}>
                            {referralData.referralCount} / {tierInfo.required!} referenser
                        </Typography>
                    </Box>
                )}
                
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <Paper
                            elevation={0}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(10px)',
                                p: 2,
                                borderRadius: 2,
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h4" fontWeight="bold" color="white">
                                {referralData.referralCount || 0}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                Totalt bjudna
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Paper
                            elevation={0}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(10px)',
                                p: 2,
                                borderRadius: 2,
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h4" fontWeight="bold" color="white">
                                {stats?.active || 0}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                Aktiva användare
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Paper
                            elevation={0}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(10px)',
                                p: 2,
                                borderRadius: 2,
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h4" fontWeight="bold" color="white">
                                {referralData.rewards || 0} veckor
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                Premium-belöning
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>

            {/* Referral Code */}
            <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
                    🎟️ Din referenskod
                </Typography>
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                        p: 3,
                        mb: 2,
                        borderRadius: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                                Referenskod
                            </Typography>
                            <Typography variant="h4" fontFamily="monospace" fontWeight="bold" color="text.primary">
                                {referralData.referralCode}
                            </Typography>
                        </Box>
                        <Button
                            onClick={handleCopyCode}
                            variant="contained"
                            startIcon={<ContentCopy />}
                            sx={{ ml: 2, px: 3, py: 1.5 }}
                        >
                            Kopiera
                        </Button>
                    </Box>
                </Paper>
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                        p: 3,
                        borderRadius: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ flex: 1, overflow: 'hidden' }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                                Referenslänk
                            </Typography>
                            <Typography
                                variant="body2"
                                fontFamily="monospace"
                                color="text.primary"
                                sx={{ wordBreak: 'break-all' }}
                            >
                                {referralData.referralLink}
                            </Typography>
                        </Box>
                        <Button
                            onClick={handleCopyLink}
                            variant="contained"
                            startIcon={<ContentCopy />}
                            sx={{ ml: 2, px: 3, py: 1.5, flexShrink: 0 }}
                        >
                            Kopiera
                        </Button>
                    </Box>
                </Paper>
            </Paper>

            {/* Share Options */}
            <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
                    📢 Dela med vänner
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                        <Button
                            onClick={() => handleShare('whatsapp')}
                            fullWidth
                            sx={{
                                p: 2,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                                color: (theme) => theme.palette.mode === 'dark' ? 'rgb(134, 239, 172)' : 'rgb(22, 101, 52)',
                                '&:hover': {
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
                                },
                                borderRadius: 2,
                                flexDirection: 'column',
                            }}
                        >
                            <Box sx={{ fontSize: '2rem', mb: 1 }}>📱</Box>
                            <Typography variant="body1" fontWeight="600">
                                WhatsApp
                            </Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            onClick={() => handleShare('facebook')}
                            fullWidth
                            sx={{
                                p: 2,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                color: (theme) => theme.palette.mode === 'dark' ? 'rgb(147, 197, 253)' : 'rgb(30, 58, 138)',
                                '&:hover': {
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                                },
                                borderRadius: 2,
                                flexDirection: 'column',
                            }}
                        >
                            <Box sx={{ fontSize: '2rem', mb: 1 }}>👥</Box>
                            <Typography variant="body1" fontWeight="600">
                                Facebook
                            </Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            onClick={() => handleShare('twitter')}
                            fullWidth
                            sx={{
                                p: 2,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.1)',
                                color: (theme) => theme.palette.mode === 'dark' ? 'rgb(125, 211, 252)' : 'rgb(12, 74, 110)',
                                '&:hover': {
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(14, 165, 233, 0.2)',
                                },
                                borderRadius: 2,
                                flexDirection: 'column',
                            }}
                        >
                            <Box sx={{ fontSize: '2rem', mb: 1 }}>🐦</Box>
                            <Typography variant="body1" fontWeight="600">
                                Twitter
                            </Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Button
                            onClick={() => handleShare('email')}
                            fullWidth
                            sx={{
                                p: 2,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.1)',
                                color: (theme) => theme.palette.mode === 'dark' ? 'rgb(216, 180, 254)' : 'rgb(88, 28, 135)',
                                '&:hover': {
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.2)',
                                },
                                borderRadius: 2,
                                flexDirection: 'column',
                            }}
                        >
                            <Box sx={{ fontSize: '2rem', mb: 1 }}>📧</Box>
                            <Typography variant="body1" fontWeight="600">
                                Email
                            </Typography>
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Email Invitation */}
            <EmailInvite referralCode={referralData.referralCode} />

            {/* Rewards Catalog */}
            <RewardsCatalog 
                availableWeeks={referralData.rewards || 0}
                onRedemption={fetchReferralData}
            />

            {/* Referral History */}
            <ReferralHistory />

            {/* Leaderboard */}
            <ReferralLeaderboard />

            {/* Rewards Info */}
            <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
                    🎁 Belöningar
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography variant="h5">✅</Typography>
                        <Box>
                            <Typography variant="body1" fontWeight="600" color="text.primary">
                                Varje ny användare
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Du och din vän får båda 1 vecka gratis premium
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography variant="h5">🥈</Typography>
                        <Box>
                            <Typography variant="body1" fontWeight="600" color="text.primary">
                                Silver-nivå (5 referenser)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                1 månad gratis premium + prioriterad support
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography variant="h5">🥇</Typography>
                        <Box>
                            <Typography variant="body1" fontWeight="600" color="text.primary">
                                Gold-nivå (15 referenser)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                3 månader gratis premium + exklusiva funktioner
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography variant="h5">💎</Typography>
                        <Box>
                            <Typography variant="body1" fontWeight="600" color="text.primary">
                                Platinum-nivå (30 referenser)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                6 månader gratis premium + VIP-support + Lugn & Trygg merchandise
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography variant="h5">🎁</Typography>
                        <Box>
                            <Typography variant="body1" fontWeight="600" color="text.primary">
                                Bonus: Varje 10:e referens
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Extra 2 veckor premium + överraskning!
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Paper>

            {/* Terms */}
            <Paper
                elevation={0}
                sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                    p: 3,
                    borderRadius: 3,
                }}
            >
                <Typography variant="h6" fontWeight="600" color="text.primary" gutterBottom>
                    📋 Villkor
                </Typography>
                <Box component="ul" sx={{ pl: 0, listStyle: 'none', color: 'text.secondary' }}>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        • Båda parter måste vara nya användare eller ha aktivt konto
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        • Belöningen aktiveras när din vän slutför registreringen
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        • Belöningar kan inte växlas till kontanter
                    </Typography>
                    <Typography component="li" variant="body2">
                        • Lugn & Trygg förbehåller sig rätten att ändra villkoren
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
};

export default ReferralProgram;
