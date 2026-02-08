import React, { useState, useEffect } from 'react'
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
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
        } catch (err: unknown) {
            console.error('❌ Failed to fetch referral data:', err);
            const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data
                ? String(err.response.data.error)
                : 'Failed to load referral data';
            setError(errorMessage);
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
        } catch (err: unknown) {
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-slate-900 dark:to-slate-800">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mb-4"></div>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Laddar referensprogram...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">❌</span>
                        <div>
                            <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
                                Något gick fel
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!referralData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                                Ingen data tillgänglig
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                Kunde inte ladda referensdata.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const tierInfo = getTierInfo(referralData.tier);
    const progress = tierInfo.required ? Math.min(100, (referralData.referralCount / tierInfo.required) * 100) : 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                        🤝 Referensprogram
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400">
                        Bjud in vänner och få belöningar! Både du och din vän tjänar på det.
                    </p>
                </div>

                {/* Copy Confirmation Toast */}
                {copied && (
                    <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in-right">
                        <span>✅</span>
                        <span className="font-medium">Kopierat till urklipp!</span>
                    </div>
                )}

                {/* Tier Status Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                                Din nivå: {referralData.tier}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                {tierInfo.nextTier 
                                    ? `${tierInfo.required! - referralData.referralCount} fler referenser till ${tierInfo.nextTier}`
                                    : 'Högsta nivån uppnådd! 🎉'}
                            </p>
                        </div>
                        <div className="text-6xl">
                            {tierInfo.emoji}
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    {tierInfo.nextTier && (
                        <div className="mb-6">
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                                <span>{referralData.tier}</span>
                                <span>{tierInfo.nextTier}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">
                                {referralData.referralCount} / {tierInfo.required!} referenser
                            </p>
                        </div>
                    )}
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg p-4 text-white text-center">
                            <div className="text-3xl font-bold mb-1">
                                {referralData.referralCount || 0}
                            </div>
                            <div className="text-sm opacity-90">
                                Totalt bjudna
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-lg p-4 text-white text-center">
                            <div className="text-3xl font-bold mb-1">
                                {stats?.active || 0}
                            </div>
                            <div className="text-sm opacity-90">
                                Aktiva användare
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-lg p-4 text-white text-center">
                            <div className="text-3xl font-bold mb-1">
                                {referralData.rewards || 0} veckor
                            </div>
                            <div className="text-sm opacity-90">
                                Premium-belöning
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referral Code Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                        🎟️ Din referenskod
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        Referenskod
                                    </p>
                                    <p className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
                                        {referralData.referralCode}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="btn btn-primary flex items-center gap-2"
                                >
                                    <DocumentDuplicateIcon className="h-5 w-5" />
                                    Kopiera
                                </button>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        Referenslänk
                                    </p>
                                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">
                                        {referralData.referralLink}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className="btn btn-primary flex items-center gap-2 ml-4"
                                >
                                    <DocumentDuplicateIcon className="h-5 w-5" />
                                    Kopiera
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Share Options Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                        📢 Dela med vänner
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button
                            onClick={() => handleShare('whatsapp')}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 transition-colors"
                        >
                            <span className="text-3xl">📱</span>
                            <span className="font-semibold">WhatsApp</span>
                        </button>
                        <button
                            onClick={() => handleShare('facebook')}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 transition-colors"
                        >
                            <span className="text-3xl">👥</span>
                            <span className="font-semibold">Facebook</span>
                        </button>
                        <button
                            onClick={() => handleShare('twitter')}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-700 dark:text-sky-300 transition-colors"
                        >
                            <span className="text-3xl">🐦</span>
                            <span className="font-semibold">Twitter</span>
                        </button>
                        <button
                            onClick={() => handleShare('email')}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 transition-colors"
                        >
                            <span className="text-3xl">📧</span>
                            <span className="font-semibold">Email</span>
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

                {/* Rewards Info Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                        🎁 Belöningar
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <span className="text-3xl">✅</span>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                    Varje ny användare
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Du och din vän får båda 1 vecka gratis premium
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <span className="text-3xl">🥈</span>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                    Silver-nivå (5 referenser)
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    1 månad gratis premium + prioriterad support
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <span className="text-3xl">🥇</span>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                    Gold-nivå (15 referenser)
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    3 månader gratis premium + exklusiva funktioner
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <span className="text-3xl">💎</span>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                    Platinum-nivå (30 referenser)
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    6 månader gratis premium + VIP-support + Lugn & Trygg merchandise
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <span className="text-3xl">🎁</span>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                    Bonus: Varje 10:e referens
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Extra 2 veckor premium + överraskning!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Terms Card */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        📋 Villkor
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="mt-1">•</span>
                            <span>Båda parter måste vara nya användare eller ha aktivt konto</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1">•</span>
                            <span>Belöningen aktiveras när din vän slutför registreringen</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1">•</span>
                            <span>Belöningar kan inte växlas till kontanter</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1">•</span>
                            <span>Lugn & Trygg förbehåller sig rätten att ändra villkoren</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ReferralProgram;


