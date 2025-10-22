import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';

interface ReferralHistoryEntry {
    invitee_name: string;
    invitee_email: string;
    completed_at: string;
    rewards_granted: number;
}

const ReferralHistory: React.FC = () => {
    const { user } = useAuth();
    const [history, setHistory] = useState<ReferralHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.user_id) {
            fetchHistory();
        }
    }, [user]);

    const fetchHistory = async () => {
        if (!user?.user_id) return;

        try {
            setLoading(true);
            const response = await api.get(`/api/referral/history?user_id=${user.user_id}`);
            setHistory(response.data.history || []);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch referral history:', err);
            setError('Kunde inte ladda historik');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (isoDate: string): string => {
        const date = new Date(isoDate);
        return date.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <div className="animate-spin text-3xl mb-2">📜</div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Laddar historik...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">❌ {error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    📜 Referenshistorik
                </h2>
                <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
                    {history.length} totalt
                </span>
            </div>

            {history.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p className="text-3xl mb-2">🌱</p>
                    <p className="font-medium mb-1">Inga referenser än</p>
                    <p className="text-sm">Dela din referenskod för att komma igång!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((entry, idx) => (
                        <div
                            key={idx}
                            className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">👤</span>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                        {entry.invitee_name}
                                    </p>
                                </div>
                                {entry.invitee_email && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">
                                        📧 {entry.invitee_email}
                                    </p>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-500 ml-7 mt-1">
                                    🕐 {formatDate(entry.completed_at)}
                                </p>
                            </div>

                            <div className="flex-shrink-0 text-right">
                                <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-semibold">
                                    +{entry.rewards_granted} vecka
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={fetchHistory}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                        🔄 Uppdatera historik
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReferralHistory;
