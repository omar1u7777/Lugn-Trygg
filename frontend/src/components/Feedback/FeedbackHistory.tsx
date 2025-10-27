import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';

interface FeedbackItem {
    id: string;
    category: string;
    rating: number;
    message: string;
    status: string;
    created_at: string;
    response?: string;
    responded_at?: string;
}

const FeedbackHistory: React.FC = () => {
    const { user } = useAuth();
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.user_id) {
            fetchFeedback();
        }
    }, [user]);

    const fetchFeedback = async () => {
        if (!user?.user_id) return;

        try {
            setLoading(true);
            const response = await api.get(`/api/feedback/my-feedback?user_id=${user.user_id}`);
            setFeedback(response.data.feedback || []);
        } catch (err: any) {
            console.error('Failed to fetch feedback history:', err);
            setError('Kunde inte hämta din feedback-historik');
        } finally {
            setLoading(false);
        }
    };

    const categoryEmojis: Record<string, string> = {
        general: '💬',
        bug: '🐛',
        feature: '✨',
        ui: '🎨',
        performance: '⚡',
        content: '📝'
    };

    const categoryNames: Record<string, string> = {
        general: 'Allmän feedback',
        bug: 'Buggrapport',
        feature: 'Funktionsförslag',
        ui: 'Användargränssnitt',
        performance: 'Prestanda',
        content: 'Innehåll/Texter'
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
        reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
        resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
    };

    const statusNames: Record<string, string> = {
        pending: 'Väntar',
        reviewed: 'Granskad',
        resolved: 'Löst'
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
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
            <div className="flex justify-center items-center py-12">
                <div className="text-center">
                    <div className="text-5xl mb-4 animate-spin">⚙️</div>
                    <p className="text-slate-600 dark:text-slate-400">Laddar din feedback...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                <p className="text-red-800 dark:text-red-200">❌ {error}</p>
            </div>
        );
    }

    if (feedback.length === 0) {
        return (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    Ingen feedback ännu
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                    Du har inte skickat någon feedback än. Dela dina tankar med oss!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    📜 Min Feedback-historik
                </h2>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                    {feedback.length} {feedback.length === 1 ? 'feedback' : 'feedbacks'}
                </span>
            </div>

            {feedback.map((item) => (
                <div
                    key={item.id}
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{categoryEmojis[item.category] || '💬'}</span>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                    {categoryNames[item.category] || item.category}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {formatDate(item.created_at)}
                                </p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[item.status] || statusColors.pending}`}>
                            {statusNames[item.status] || item.status}
                        </span>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className="text-xl">
                                    {star <= item.rating ? '⭐' : '☆'}
                                </span>
                            ))}
                            <span className="text-sm text-slate-600 dark:text-slate-400 ml-2">
                                ({item.rating}/5)
                            </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {item.message}
                        </p>
                    </div>

                    {item.response && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">💬</span>
                                <span className="font-semibold text-blue-900 dark:text-blue-100">
                                    Svar från teamet
                                </span>
                                {item.responded_at && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400">
                                        • {formatDate(item.responded_at)}
                                    </span>
                                )}
                            </div>
                            <p className="text-blue-800 dark:text-blue-200">
                                {item.response}
                            </p>
                        </div>
                    )}

                    <div className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                        Feedback-ID: #{item.id.slice(0, 8)}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FeedbackHistory;
