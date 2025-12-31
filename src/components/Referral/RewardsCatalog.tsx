import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';

interface Reward {
    id: string;
    name: string;
    description: string;
    cost: number;
    emoji: string;
    type: string;
}

interface RewardsCatalogProps {
    availableWeeks: number;
    onRedemption: () => void;
}

const RewardsCatalog: React.FC<RewardsCatalogProps> = ({ availableWeeks, onRedemption }) => {
    const { user } = useAuth();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchRewards();
    }, []);

    const fetchRewards = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/referral/rewards/catalog');
            setRewards(response.data.rewards || []);
        } catch (err) {
            console.error('Failed to fetch rewards:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async (rewardId: string, cost: number) => {
        if (!user?.user_id) return;
        if (availableWeeks < cost) {
            setMessage({ type: 'error', text: 'Inte tillräckligt med veckor!' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        try {
            setRedeeming(rewardId);
            await api.post('/api/referral/rewards/redeem', {
                user_id: user.user_id,
                reward_id: rewardId
            });

            setMessage({ type: 'success', text: 'Belöning inlöst! 🎉' });
            setTimeout(() => setMessage(null), 3000);
            onRedemption(); // Refresh parent data
        } catch (err: unknown) {
            const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
                ? String(err.response.data.error)
                : 'Kunde inte lösa in belöning';
            setMessage({ 
                type: 'error', 
                text: errorMessage
            });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setRedeeming(null);
        }
    };

    const getCategoryColor = (type: string): string => {
        switch (type) {
            case 'premium': return 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800';
            case 'support': return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
            case 'customization': return 'bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800';
            case 'feature': return 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800';
            case 'merchandise': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
            default: return 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin text-4xl">🎁</div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                    🎁 Belöningskatalog
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                    Du har <span className="font-bold text-purple-600 dark:text-purple-400">{availableWeeks} veckor</span> att spendera
                </p>
            </div>

            {message && (
                <div className={`mb-4 p-4 rounded-lg ${
                    message.type === 'success' 
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rewards.map((reward) => {
                    const canAfford = availableWeeks >= reward.cost;
                    
                    return (
                        <div
                            key={reward.id}
                            className={`border-2 rounded-lg p-4 transition-all ${getCategoryColor(reward.type)} ${
                                canAfford ? 'opacity-100' : 'opacity-50'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-3xl">{reward.emoji}</span>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-slate-100">
                                            {reward.name}
                                        </h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                                            {reward.type}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                        {reward.cost}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                        veckor
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                                {reward.description}
                            </p>

                            <button
                                onClick={() => handleRedeem(reward.id, reward.cost)}
                                disabled={!canAfford || redeeming === reward.id}
                                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                                    canAfford
                                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                {redeeming === reward.id ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin">⚙️</span>
                                        Löser in...
                                    </span>
                                ) : canAfford ? (
                                    `Lös in nu →`
                                ) : (
                                    `Behöver ${reward.cost - availableWeeks} veckor till`
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 <strong>Tips:</strong> Bjud in fler vänner för att tjäna fler veckor! Varje referens = 1 vecka premium.
                </p>
            </div>
        </div>
    );
};

export default RewardsCatalog;
