import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import api from '../../api/api';
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    Button,
    Chip,
    Grid,
    Divider,
} from '@mui/material';

interface LeaderboardEntry {
    rank: number;
    user_id: string;
    name: string;
    successful_referrals: number;
    rewards_earned: number;
    tier: string;
    tier_emoji: string;
}

const ReferralLeaderboard: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/referral/leaderboard?limit=20');
            setLeaderboard(response.data.leaderboard || []);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch leaderboard:', err);
            setError('Kunde inte ladda leaderboard');
        } finally {
            setLoading(false);
        }
    };

    const getRankBadge = (rank: number): string => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'linear-gradient(135deg, #fbbf24 0%, colors.mood.sad 100%)'; // Gold
        if (rank === 2) return 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)'; // Silver
        if (rank === 3) return 'linear-gradient(135deg, #d97706 0%, #92400e 100%)'; // Bronze
        return undefined; // Default MUI background
    };

    const isTopThree = (rank: number) => rank <= 3;

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={50} sx={{ mb: spacing.sm }} />
                    <Typography variant="body1" color="text.secondary">
                        Laddar leaderboard...
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ borderRadius: borderRadius.lg, p: spacing.lg }}>
                {error}
            </Alert>
        );
    }

    return (
        <Paper elevation={3} sx={{ p: spacing.lg, borderRadius: borderRadius.lg }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.lg }}>
                <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    🏆 Topplista
                </Typography>
                <Button
                    onClick={fetchLeaderboard}
                    variant="text"
                    size="small"
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                    🔄 Uppdatera
                </Button>
            </Box>

            {leaderboard.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h1" sx={{ fontSize: '4rem', mb: spacing.sm }}>
                        🌟
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Inga referenser än. Bli den första!
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {leaderboard.map((entry) => (
                        <Paper
                            key={entry.user_id}
                            elevation={isTopThree(entry.rank) ? 3 : 0}
                            sx={{
                                p: spacing.md,
                                borderRadius: borderRadius.md,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: getRankColor(entry.rank) || (
                                    (theme) => theme.palette.mode === 'dark' 
                                        ? 'rgba(0,0,0,0.2)' 
                                        : 'rgba(0,0,0,0.03)'
                                ),
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                                {/* Rank Badge */}
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Typography variant="h5" fontWeight="bold">
                                        {getRankBadge(entry.rank)}
                                    </Typography>
                                </Box>

                                {/* User Info */}
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: 0.5 }}>
                                        <Typography
                                            variant="body1"
                                            fontWeight="600"
                                            sx={{
                                                color: isTopThree(entry.rank) 
                                                    ? 'white' 
                                                    : 'text.primary',
                                            }}
                                        >
                                            {entry.name}
                                        </Typography>
                                        <Typography variant="h6">{entry.tier_emoji}</Typography>
                                        <Chip
                                            label={entry.tier}
                                            size="small"
                                            sx={{
                                                fontSize: '0.75rem',
                                                height: 24,
                                                bgcolor: isTopThree(entry.rank)
                                                    ? 'colors.overlay.medium'
                                                    : undefined,
                                                color: isTopThree(entry.rank)
                                                    ? 'white'
                                                    : undefined,
                                            }}
                                        />
                                    </Box>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: isTopThree(entry.rank)
                                                ? 'colors.overlay.medium'
                                                : 'text.secondary',
                                        }}
                                    >
                                        {entry.successful_referrals} referenser • {entry.rewards_earned} veckor premium
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Box>
            )}

            {/* Legend */}
            <Box sx={{ mt: spacing.lg, pt: 3 }}>
                <Divider sx={{ mb: spacing.md }} />
                <Typography variant="body2" color="text.secondary" fontWeight="600" gutterBottom>
                    🎯 Nivåer:
                </Typography>
                <Grid container spacing={1}>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2">🥉</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Bronze: 0-4
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2">🥈</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Silver: 5-14
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2">🥇</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Gold: 15-29
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2">💎</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Platinum: 30+
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Paper>
    );
};

export default ReferralLeaderboard;
