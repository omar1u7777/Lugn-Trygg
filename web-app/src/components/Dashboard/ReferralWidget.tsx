import React, { useState, useEffect } from 'react';
import api from '../../api/api';

interface ReferralStats {
    referral_code: string;
    successful_referrals: number;
    rewards_earned: number;
}

interface ReferralWidgetProps {
    userId: string;
}

const ReferralWidget: React.FC<ReferralWidgetProps> = ({ userId }) => {
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchStats();
        }
    }, [userId]);

    const fetchStats = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const response = await api.post('/api/referral/generate', {
                user_id: userId
            });
            setStats(response.data);
        } catch (err) {
            console.error('Failed to fetch referral stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const getTier = (count: number): { emoji: string, name: string, color: string } => {
        if (count >= 30) return { emoji: '💎', name: 'Platinum', color: 'from-purple-600 to-pink-600' };
        if (count >= 15) return { emoji: '🥇', name: 'Gold', color: 'from-yellow-400 to-yellow-600' };
        if (count >= 5) return { emoji: '🥈', name: 'Silver', color: 'from-gray-300 to-gray-500' };
        return { emoji: '🥉', name: 'Bronze', color: 'from-amber-600 to-amber-800' };
    };

    if (loading || !stats) {
        return null; // Don't show widget while loading
    }

    const tier = getTier(stats.successful_referrals);

    return (
        <div className={`bg-gradient-to-r ${tier.color} rounded-xl p-6 shadow-lg text-white`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-4xl">{tier.emoji}</span>
                    <div>
                        <h3 className="text-lg font-bold">Referensprogram</h3>
                        <p className="text-white/80 text-sm">{tier.name} Level</p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.href = '/referral'}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                    Visa mer →
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                    <div className="text-2xl font-bold">{stats.successful_referrals}</div>
                    <div className="text-white/80 text-xs">Referenser</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold">{stats.rewards_earned}</div>
                    <div className="text-white/80 text-xs">Veckor</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-mono">{stats.referral_code}</div>
                    <div className="text-white/80 text-xs">Din kod</div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-white/90 text-sm text-center">
                    🎁 Bjud in vänner och få premium belöningar!
                </p>
            </div>
        </div>
    );
};

export default ReferralWidget;
