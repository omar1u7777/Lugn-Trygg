import React, { useState, useEffect } from 'react';
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
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin text-6xl mb-4">⚙️</div>
                    <p className="text-slate-600 dark:text-slate-400">Laddar referensprogram...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">❌ Något gick fel</h2>
                    <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
            </div>
        );
    }

    if (!referralData) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Ingen data tillgänglig</h2>
                    <p className="text-yellow-700 dark:text-yellow-300">Kunde inte ladda referensdata.</p>
                </div>
            </div>
        );
    }

    const tierInfo = getTierInfo(referralData.tier);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    🤝 Referensprogram
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                    Bjud in vänner och få belöningar! Både du och din vän tjänar på det.
                </p>
            </div>

            {/* Copy Confirmation */}
            {copied && (
                <div className="fixed top-24 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
                    ✅ Kopierat till urklipp!
                </div>
            )}

            {/* Tier Status */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">Din nivå: {referralData.tier}</h2>
                        <p className="text-purple-100">
                            {tierInfo.nextTier 
                                ? `${tierInfo.required! - referralData.referralCount} fler referenser till ${tierInfo.nextTier}`
                                : 'Högsta nivån uppnådd! 🎉'}
                        </p>
                    </div>
                    <div className="text-6xl">{tierInfo.emoji}</div>
                </div>
                
                {/* Progress Bar */}
                {tierInfo.nextTier && (
                    <div className="mb-6">
                        <div className="flex justify-between text-sm text-purple-100 mb-2">
                            <span>{referralData.tier}</span>
                            <span>{tierInfo.nextTier}</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3">
                            <div 
                                className="bg-white h-3 rounded-full transition-all duration-500"
                                style={{ 
                                    width: `${Math.min(100, (referralData.referralCount / tierInfo.required!) * 100)}%` 
                                }}
                            ></div>
                        </div>
                        <p className="text-center text-sm text-purple-100 mt-2">
                            {referralData.referralCount} / {tierInfo.required!} referenser
                        </p>
                    </div>
                )}
                
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-3xl font-bold">{referralData.referralCount || 0}</div>
                        <p className="text-purple-100">Totalt bjudna</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-3xl font-bold">{stats?.active || 0}</div>
                        <p className="text-purple-100">Aktiva användare</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-3xl font-bold">{referralData.rewards || 0} veckor</div>
                        <p className="text-purple-100">Premium-belöning</p>
                    </div>
                </div>
            </div>

            {/* Referral Code */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    🎟️ Din referenskod
                </h2>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-6 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Referenskod</p>
                            <p className="text-3xl font-mono font-bold text-slate-900 dark:text-slate-100">
                                {referralData.referralCode}
                            </p>
                        </div>
                        <button
                            onClick={handleCopyCode}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ml-4"
                        >
                            📋 Kopiera
                        </button>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Referenslänk</p>
                            <p className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                                {referralData.referralLink}
                            </p>
                        </div>
                        <button
                            onClick={handleCopyLink}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ml-4 flex-shrink-0"
                        >
                            🔗 Kopiera
                        </button>
                    </div>
                </div>
            </div>

            {/* Share Options */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    📢 Dela med vänner
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => handleShare('whatsapp')}
                        className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    >
                        <div className="text-3xl mb-2">📱</div>
                        <p className="font-semibold text-green-900 dark:text-green-100">WhatsApp</p>
                    </button>
                    <button
                        onClick={() => handleShare('facebook')}
                        className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                        <div className="text-3xl mb-2">👥</div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Facebook</p>
                    </button>
                    <button
                        onClick={() => handleShare('twitter')}
                        className="p-4 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 rounded-lg transition-colors"
                    >
                        <div className="text-3xl mb-2">🐦</div>
                        <p className="font-semibold text-sky-900 dark:text-sky-100">Twitter</p>
                    </button>
                    <button
                        onClick={() => handleShare('email')}
                        className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                    >
                        <div className="text-3xl mb-2">📧</div>
                        <p className="font-semibold text-purple-900 dark:text-purple-100">Email</p>
                    </button>
                </div>
            </div>

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
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    🎁 Belöningar
                </h2>
                <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                        <div className="text-2xl">✅</div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">Varje ny användare</p>
                            <p className="text-slate-600 dark:text-slate-400">Du och din vän får båda 1 vecka gratis premium</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="text-2xl">🥈</div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">Silver-nivå (5 referenser)</p>
                            <p className="text-slate-600 dark:text-slate-400">1 månad gratis premium + prioriterad support</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="text-2xl">🥇</div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">Gold-nivå (15 referenser)</p>
                            <p className="text-slate-600 dark:text-slate-400">3 månader gratis premium + exklusiva funktioner</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="text-2xl">💎</div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">Platinum-nivå (30 referenser)</p>
                            <p className="text-slate-600 dark:text-slate-400">6 månader gratis premium + VIP-support + Lugn & Trygg merchandise</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="text-2xl">🎁</div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">Bonus: Varje 10:e referens</p>
                            <p className="text-slate-600 dark:text-slate-400">Extra 2 veckor premium + överraskning!</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Terms */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-6">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">📋 Villkor</h3>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>• Båda parter måste vara nya användare eller ha aktivt konto</li>
                    <li>• Belöningen aktiveras när din vän slutför registreringen</li>
                    <li>• Belöningar kan inte växlas till kontanter</li>
                    <li>• Lugn & Trygg förbehåller sig rätten att ändra villkoren</li>
                </ul>
            </div>
        </div>
    );
};

export default ReferralProgram;
