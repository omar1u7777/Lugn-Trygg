import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';
import { API_ENDPOINTS } from '../../api/constants';
import { Paper, Spinner, Alert, Chip, Divider, Button } from '../ui/tailwind';
import { logger } from '../../utils/logger';


interface ReferralHistoryEntry {
    inviteeName: string;
    inviteeEmail: string;
    completedAt: string;
    rewardsGranted: number;
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
            const response = await api.get(`${API_ENDPOINTS.REFERRAL.HISTORY}?user_id=${user.user_id}`);
            const data = response.data?.data || response.data;
            setHistory(data.history || []);
            setError(null);
        } catch (err: unknown) {
            logger.error('Failed to fetch referral history:', err);
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
            <div className="flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <Spinner size="sm" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Laddar historik...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                {error}
            </Alert>
        );
    }

    return (
        <Paper className="shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    📜 Referenshistorik
                </h2>
                <Chip
                    label={`${history.length} totalt`}
                    size="small"
                    color="primary"
                />
            </div>

            {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-6xl mb-4">🌱</div>
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Inga referenser än
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                        Dela din referenskod för att komma igång!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {history.map((entry, idx) => (
                        <div
                            key={idx}
                            className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/70"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">👤</span>
                                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                        {entry.inviteeName}
                                    </p>
                                </div>
                                {entry.inviteeEmail && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        📧 {entry.inviteeEmail}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                    🕐 {formatDate(entry.completedAt)}
                                </p>
                            </div>

                            <Chip
                                label={`+${entry.rewardsGranted} vecka`}
                                color="success"
                                size="small"
                            />
                        </div>
                    ))}
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-6">
                    <Divider />
                    <Button
                        onClick={fetchHistory}
                        className="w-full mt-4"
                        variant="text"
                    >
                        🔄 Uppdatera historik
                    </Button>
                </div>
            )}
        </Paper>
    );
};

export default ReferralHistory;

