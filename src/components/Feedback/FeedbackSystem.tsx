import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';
import FeedbackForm from './FeedbackForm';

interface FeedbackItem {
    id: string;
    user_id: string;
    category: string;
    rating: number;
    message: string;
    status: 'pending' | 'reviewed' | 'resolved';
    created_at: string;
    response?: string;
}

interface FeedbackStats {
    total: number;
    pending: number;
    reviewed: number;
    resolved: number;
    averageRating: number;
}

const FeedbackSystem: React.FC = () => {
    const { user } = useAuth();
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [stats, setStats] = useState<FeedbackStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

    useEffect(() => {
        if (user?.user_id && activeTab === 'history') {
            fetchFeedbackHistory();
            fetchFeedbackStats();
        }
    }, [user, activeTab]);

    const fetchFeedbackHistory = async () => {
        if (!user?.user_id) return;

        try {
            setLoading(true);
            const response = await api.get(`/api/feedback/history?user_id=${user.user_id}`);
            setFeedbacks(response.data.feedbacks || []);
            setError(null);
        } catch (err: any) {
            console.error('❌ Failed to fetch feedback history:', err);
            setError(err.response?.data?.error || 'Kunde inte ladda feedbackhistorik');
        } finally {
            setLoading(false);
        }
    };

    const fetchFeedbackStats = async () => {
        if (!user?.user_id) return;

        try {
            const response = await api.get(`/api/feedback/stats?user_id=${user.user_id}`);
            setStats(response.data);
        } catch (err: any) {
            console.error('❌ Failed to fetch feedback stats:', err);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200';
            case 'reviewed':
                return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200';
            case 'resolved':
                return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
            default:
                return 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending':
                return '⏳ Väntar';
            case 'reviewed':
                return '👀 Granskad';
            case 'resolved':
                return '✅ Löst';
            default:
                return status;
        }
    };

    const getCategoryEmoji = (category: string) => {
        const emojis: { [key: string]: string } = {
            general: '💬',
            bug: '🐛',
            feature: '✨',
            ui: '🎨',
            performance: '⚡',
            content: '📝'
        };
        return emojis[category] || '💬';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    💬 Feedbacksystem
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                    Dela dina åsikter och följ upp tidigare feedback
                </p>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-2 flex gap-2">
                <button
                    onClick={() => setActiveTab('submit')}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                        activeTab === 'submit'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    ✍️ Skicka feedback
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                        activeTab === 'history'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    📜 Min historik
                </button>
            </div>

            {/* Content */}
            {activeTab === 'submit' ? (
                <FeedbackForm />
            ) : (
                <div className="space-y-6">
                    {/* Stats */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                                <div className="text-3xl mb-2">📊</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                                    {stats.total}
                                </div>
                                <p className="text-slate-600 dark:text-slate-400">Totalt skickad</p>
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 shadow-sm">
                                <div className="text-3xl mb-2">⏳</div>
                                <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                                    {stats.pending}
                                </div>
                                <p className="text-yellow-800 dark:text-yellow-200">Väntar</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 shadow-sm">
                                <div className="text-3xl mb-2">👀</div>
                                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                                    {stats.reviewed}
                                </div>
                                <p className="text-blue-800 dark:text-blue-200">Granskad</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 shadow-sm">
                                <div className="text-3xl mb-2">✅</div>
                                <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                                    {stats.resolved}
                                </div>
                                <p className="text-green-800 dark:text-green-200">Löst</p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <p className="text-red-800 dark:text-red-200">❌ {error}</p>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin text-6xl mb-4">⚙️</div>
                            <p className="text-slate-600 dark:text-slate-400">Laddar feedbackhistorik...</p>
                        </div>
                    ) : feedbacks.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-12 text-center">
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                                Ingen feedback ännu
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                Du har inte skickat någon feedback än. Börja genom att gå till "Skicka feedback".
                            </p>
                            <button
                                onClick={() => setActiveTab('submit')}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                ✍️ Skicka din första feedback
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {feedbacks.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="text-3xl">{getCategoryEmoji(item.category)}</div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                                                    {item.category}
                                                </h3>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {new Date(item.created_at).toLocaleString('sv-SE')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="flex">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className="text-xl">
                                                        {i < item.rating ? '⭐' : '☆'}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                                                {getStatusText(item.status)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                            {item.message}
                                        </p>
                                    </div>

                                    {item.response && (
                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                            <div className="flex items-start space-x-2">
                                                <div className="text-xl">💬</div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                                        Svar från teamet:
                                                    </p>
                                                    <p className="text-blue-800 dark:text-blue-200">
                                                        {item.response}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Help Section */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-6">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    💡 Tips för bra feedback
                </h3>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                    <li>• Var specifik - beskriv exakt vad du upplever eller vad du vill förbättra</li>
                    <li>• Inkludera steg för att återskapa buggar om möjligt</li>
                    <li>• Förklara varför en funktion skulle vara användbar</li>
                    <li>• Var respektfull och konstruktiv i din feedback</li>
                    <li>• Kolla din feedbackhistorik för att se status på dina tidigare inlämningar</li>
                </ul>
            </div>
        </div>
    );
};

export default FeedbackSystem;
