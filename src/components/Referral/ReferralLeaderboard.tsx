import React, { useState, useEffect } from 'react'
import api from '../../api/api';
import { API_ENDPOINTS } from '../../api/constants';
import { Paper, Spinner, Alert, Chip, Divider, Button, Grid } from '../ui/tailwind';
import { logger } from '../../utils/logger';


interface LeaderboardEntry {
    rank: number;
    userId: string;
    name: string;
    successfulReferrals: number;
    rewardsEarned: number;
    tier: string;
    tierEmoji: string;
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
            const response = await api.get(`${API_ENDPOINTS.REFERRAL.LEADERBOARD}?limit=20`);
            const data = response.data?.data || response.data;
            setLeaderboard(data.leaderboard || []);
            setError(null);
        } catch (err: unknown) {
            logger.error('Failed to fetch leaderboard:', err);
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

    const isTopThree = (rank: number) => rank <= 3;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <Spinner size="sm" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Laddar leaderboard...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="error">
                {error}
            </Alert>
        );
    }

    return (
        <Paper className="shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    🏆 Topplista
                </h2>
                <Button
                    onClick={fetchLeaderboard}
                    variant="text"
                    size="small"
                >
                    🔄 Uppdatera
                </Button>
            </div>

            {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-6xl mb-4">🌟</div>
                    <p className="text-base text-gray-600 dark:text-gray-400">
                        Inga referenser än. Bli den första!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {leaderboard.map((entry) => (
                        <div
                            key={entry.userId}
                            className={`p-4 rounded-lg ${
                                isTopThree(entry.rank)
                                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 shadow-md'
                                    : 'bg-gray-50 dark:bg-gray-800/50'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                {/* Rank Badge */}
                                <div className="text-2xl font-bold">
                                    {getRankBadge(entry.rank)}
                                </div>

                                {/* User Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                            {entry.name}
                                        </p>
                                        <span className="text-xl">{entry.tierEmoji}</span>
                                        <Chip
                                            label={entry.tier}
                                            size="small"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {entry.successfulReferrals} referenser • {entry.rewardsEarned} veckor premium
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="mt-6">
                <Divider />
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 mt-4">
                    🎯 Nivåer:
                </p>
                <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                        <div className="flex flex-col items-center text-center">
                            <span className="text-2xl mb-1">🥉</span>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Bronze: 0-4
                            </p>
                        </div>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <div className="flex flex-col items-center text-center">
                            <span className="text-2xl mb-1">🥈</span>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Silver: 5-14
                            </p>
                        </div>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <div className="flex flex-col items-center text-center">
                            <span className="text-2xl mb-1">🥇</span>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Gold: 15-29
                            </p>
                        </div>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <div className="flex flex-col items-center text-center">
                            <span className="text-2xl mb-1">💎</span>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                Platinum: 30+
                            </p>
                        </div>
                    </Grid>
                </Grid>
            </div>
        </Paper>
    );
};

export default ReferralLeaderboard;

