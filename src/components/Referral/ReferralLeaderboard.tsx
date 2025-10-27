import React, { useState, useEffect } from 'react';
import api from '../../api/api';

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

    const getRankColor = (rank: number): string => {
        if (rank === 1) return 'from-yellow-400 to-yellow-600';
        if (rank === 2) return 'from-gray-300 to-gray-500';
        if (rank === 3) return 'from-amber-600 to-amber-800';
        return 'from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-2">🏆</div>
                    <p className="text-slate-600 dark:text-slate-400">Laddar leaderboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <p className="text-red-800 dark:text-red-200">❌ {error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    🏆 Topplista
                </h2>
                <button
                    onClick={fetchLeaderboard}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    🔄 Uppdatera
                </button>
            </div>

            {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p className="text-4xl mb-2">🌟</p>
                    <p>Inga referenser än. Bli den första!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {leaderboard.map((entry) => (
                        <div
                            key={entry.user_id}
                            className={`rounded-lg p-4 flex items-center justify-between bg-gradient-to-r ${getRankColor(entry.rank)} ${
                                entry.rank <= 3 ? 'shadow-md' : ''
                            }`}
                        >
                            <div className="flex items-center gap-4 flex-1">
                                {/* Rank Badge */}
                                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                                    <span className="text-2xl font-bold">
                                        {getRankBadge(entry.rank)}
                                    </span>
                                </div>

                                {/* User Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className={`font-semibold ${
                                            entry.rank <= 3 
                                                ? 'text-white' 
                                                : 'text-slate-900 dark:text-slate-100'
                                        }`}>
                                            {entry.name}
                                        </p>
                                        <span className="text-xl">{entry.tier_emoji}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            entry.rank <= 3
                                                ? 'bg-white/20 text-white'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {entry.tier}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${
                                        entry.rank <= 3 
                                            ? 'text-white/80' 
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {entry.successful_referrals} referenser • {entry.rewards_earned} veckor premium
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    🎯 <strong>Nivåer:</strong>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                        <span>🥉</span>
                        <span className="text-slate-700 dark:text-slate-300">Bronze: 0-4</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>🥈</span>
                        <span className="text-slate-700 dark:text-slate-300">Silver: 5-14</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>🥇</span>
                        <span className="text-slate-700 dark:text-slate-300">Gold: 15-29</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>💎</span>
                        <span className="text-slate-700 dark:text-slate-300">Platinum: 30+</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReferralLeaderboard;
