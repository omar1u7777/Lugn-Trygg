import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

interface FeedbackWidgetProps {
    userId: string;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ userId }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalFeedback: 0,
        lastFeedbackAt: null as string | null
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchStats();
        }
    }, [userId]);

    const fetchStats = async () => {
        try {
            const response = await api.get(`/api/feedback/my-feedback?user_id=${userId}`);
            const feedbackList = response.data.feedback || [];
            
            setStats({
                totalFeedback: feedbackList.length,
                lastFeedbackAt: feedbackList.length > 0 ? feedbackList[0].created_at : null
            });
        } catch (err) {
            console.error('Failed to fetch feedback stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Idag';
        if (days === 1) return 'Igår';
        if (days < 7) return `${days} dagar sedan`;
        if (days < 30) return `${Math.floor(days / 7)} veckor sedan`;
        return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 shadow-lg animate-pulse">
                <div className="h-8 bg-purple-200 dark:bg-purple-700 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-purple-100 dark:bg-purple-800 rounded w-3/4"></div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100 dark:border-purple-800">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xl">💬</span>
                        <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                            Feedback
                        </h3>
                    </div>
                    <p className="text-purple-700 dark:text-purple-300 text-sm">
                        Dela dina tankar och förbättringsförslag
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white dark:bg-purple-900/30 rounded-lg p-3">
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {stats.totalFeedback}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                        Inskickad feedback
                    </p>
                </div>
                <div className="bg-white dark:bg-purple-900/30 rounded-lg p-3">
                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                        {stats.lastFeedbackAt ? formatDate(stats.lastFeedbackAt) : 'Aldrig'}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                        Senaste feedback
                    </p>
                </div>
            </div>

            <button
                onClick={() => navigate('/feedback')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
                <span>✍️</span>
                <span>Ge feedback</span>
            </button>
        </div>
    );
};

export default FeedbackWidget;
