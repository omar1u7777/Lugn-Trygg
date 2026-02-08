import React, { useState, useEffect, useCallback } from 'react'
import { Card, Alert } from '../ui/tailwind';
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

    const fetchFeedback = useCallback(async () => {
        if (!user?.user_id) return;

        try {
            setLoading(true);
            const response = await api.get(`/api/feedback/my-feedback?user_id=${user.user_id}`);
            setFeedback(response.data.feedback || []);
        } catch (err: unknown) {
            console.error('Failed to fetch feedback history:', err);
            setError('Kunde inte hämta din feedback-historik');
        } finally {
            setLoading(false);
        }
    }, [user?.user_id]);

    useEffect(() => {
        if (user?.user_id) {
            fetchFeedback();
        }
    }, [user?.user_id, fetchFeedback]);

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
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                    Laddar din feedback...
                </p>
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

    if (feedback.length === 0) {
        return (
            <Card className="p-8 text-center">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Ingen feedback ännu
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    Du har inte skickat någon feedback än. Dela dina tankar med oss!
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    📜 Min Feedback-historik
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feedback.length} {feedback.length === 1 ? 'feedback' : 'feedbacks'}
                </p>
            </div>

            <div className="space-y-4">
                {feedback.map((item) => (
                    <Card
                        key={item.id}
                        className="p-6 border-l-4 border-primary-500 hover:shadow-lg transition-shadow duration-300"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-3">
                                <div className="text-3xl">{categoryEmojis[item.category] || '💬'}</div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {categoryNames[item.category] || item.category}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(item.created_at)}
                                    </p>
                                </div>
                            </div>
                            <span 
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    item.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    item.status === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}
                            >
                                {statusNames[item.status] || item.status}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <span key={star} className="text-xl">
                                        {star <= item.rating ? '⭐' : '☆'}
                                    </span>
                                ))}
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    ({item.rating}/5)
                                </span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300">
                                {item.message}
                            </p>
                        </div>

                        {item.response && (
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">💬</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        Svar från teamet
                                    </span>
                                    {item.responded_at && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            • {formatDate(item.responded_at)}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {item.response}
                                </p>
                            </div>
                        )}

                        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                            Feedback-ID: #{item.id.slice(0, 8)}
                        </p>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default FeedbackHistory;

