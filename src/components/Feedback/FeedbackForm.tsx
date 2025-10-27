import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';
import FeedbackHistory from './FeedbackHistory';

interface FeedbackData {
    category: string;
    rating: number;
    message: string;
    email?: string;
    allowContact: boolean;
}

const FeedbackForm: React.FC = () => {
    const { user } = useAuth();
    const [feedback, setFeedback] = useState<FeedbackData>({
        category: 'general',
        rating: 5,
        message: '',
        email: '',
        allowContact: false
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    const categories = [
        { value: 'general', label: '💬 Allmän feedback', emoji: '💬' },
        { value: 'bug', label: '🐛 Rapportera bugg', emoji: '🐛' },
        { value: 'feature', label: '✨ Förslag på funktion', emoji: '✨' },
        { value: 'ui', label: '🎨 Användargränssnitt', emoji: '🎨' },
        { value: 'performance', label: '⚡ Prestanda', emoji: '⚡' },
        { value: 'content', label: '📝 Innehåll/Texter', emoji: '📝' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user?.user_id) {
            setError('Du måste vara inloggad för att skicka feedback');
            return;
        }
        
        if (!feedback.message.trim()) {
            setError('Vänligen skriv ett meddelande');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            await api.post('/api/feedback/submit', {
                user_id: user.user_id,
                category: feedback.category,
                rating: feedback.rating,
                message: feedback.message,
                email: feedback.allowContact ? feedback.email : undefined,
                allow_contact: feedback.allowContact
            });

            setSubmitted(true);
            
            // Reset form after 3 seconds
            setTimeout(() => {
                setFeedback({
                    category: 'general',
                    rating: 5,
                    message: '',
                    email: '',
                    allowContact: false
                });
                setSubmitted(false);
            }, 3000);
        } catch (err: any) {
            console.error('❌ Failed to submit feedback:', err);
            setError(err.response?.data?.message || 'Något gick fel vid inlämnandet. Försök igen.');
        } finally {
            setLoading(false);
        }
    };

    const handleRatingClick = (rating: number) => {
        setFeedback({ ...feedback, rating });
    };

    if (submitted) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-3xl font-bold text-green-900 dark:text-green-100 mb-4">
                        Tack för din feedback!
                    </h2>
                    <p className="text-green-800 dark:text-green-200 mb-6">
                        Din feedback hjälper oss att göra Lugn & Trygg bättre för alla användare.
                    </p>
                    <button
                        onClick={() => setSubmitted(false)}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                        Skicka mer feedback
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    💬 Feedback
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                    Din åsikt är viktig för oss! Dela dina tankar, förslag eller rapportera problem.
                </p>
                
                {/* Toggle History Button */}
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="mt-4 px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-lg transition-colors"
                >
                    {showHistory ? '✍️ Ny feedback' : '📜 Visa min historik'}
                </button>
            </div>

            {/* Show history or form */}
            {showHistory ? (
                <FeedbackHistory />
            ) : (
                <>
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <p className="text-red-800 dark:text-red-200">❌ {error}</p>
                        </div>
                    )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category Selection */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <label className="block text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        📁 Kategori
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((cat) => (
                            <button
                                key={cat.value}
                                type="button"
                                onClick={() => setFeedback({ ...feedback, category: cat.value })}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    feedback.category === cat.value
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                            >
                                <div className="text-2xl mb-1">{cat.emoji}</div>
                                <p className={`text-sm font-medium ${
                                    feedback.category === cat.value
                                        ? 'text-blue-900 dark:text-blue-100'
                                        : 'text-slate-700 dark:text-slate-300'
                                }`}>
                                    {cat.label.replace(cat.emoji + ' ', '')}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rating */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <label className="block text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        ⭐ Hur nöjd är du med Lugn & Trygg?
                    </label>
                    <div className="flex justify-center space-x-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingClick(star)}
                                className="text-5xl transition-transform hover:scale-110"
                            >
                                {star <= feedback.rating ? '⭐' : '☆'}
                            </button>
                        ))}
                    </div>
                    <p className="text-center text-slate-600 dark:text-slate-400 mt-2">
                        {feedback.rating === 1 && 'Mycket missnöjd'}
                        {feedback.rating === 2 && 'Missnöjd'}
                        {feedback.rating === 3 && 'Okej'}
                        {feedback.rating === 4 && 'Nöjd'}
                        {feedback.rating === 5 && 'Mycket nöjd'}
                    </p>
                </div>

                {/* Message */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <label className="block text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        ✍️ Ditt meddelande
                    </label>
                    <textarea
                        value={feedback.message}
                        onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                        rows={6}
                        placeholder="Berätta vad du tycker, föreslå förbättringar eller rapportera problem..."
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        {feedback.message.length}/1000 tecken
                    </p>
                </div>

                {/* Contact Info */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <div className="flex items-start space-x-3 mb-4">
                        <input
                            type="checkbox"
                            id="allowContact"
                            checked={feedback.allowContact}
                            onChange={(e) => setFeedback({ ...feedback, allowContact: e.target.checked })}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <label htmlFor="allowContact" className="text-slate-900 dark:text-slate-100 cursor-pointer">
                            <span className="font-semibold">Jag vill bli kontaktad</span>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                Vi kanske behöver mer information om din feedback
                            </p>
                        </label>
                    </div>
                    
                    {feedback.allowContact && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                📧 E-postadress
                            </label>
                            <input
                                type="email"
                                value={feedback.email}
                                onChange={(e) => setFeedback({ ...feedback, email: e.target.value })}
                                placeholder="din.email@exempel.se"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-center">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${
                            loading
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
                        } text-white shadow-lg`}
                    >
                        {loading ? (
                            <>
                                <span className="inline-block animate-spin mr-2">⚙️</span>
                                Skickar...
                            </>
                        ) : (
                            <>
                                <span className="mr-2">📤</span>
                                Skicka feedback
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-4 mt-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                    <div className="text-3xl mb-3">📚</div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Hjälpcenter</h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        Hitta svar på vanliga frågor
                    </p>
                    <a href="https://github.com/omar1u7777/Lugn-Trygg/wiki" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
                        Besök hjälpcenter →
                    </a>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                    <div className="text-3xl mb-3">💬</div>
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Live Chat</h3>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                        Chatta med vårt AI support-team
                    </p>
                    <button 
                        onClick={() => window.location.href = '/chatbot'}
                        className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline"
                    >
                        Starta chatt →
                    </button>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                    <div className="text-3xl mb-3">📞</div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Kontakt</h3>
                    <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                        Skicka ett email till oss
                    </p>
                    <a href="mailto:support@lugn-trygg.se" className="text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline">
                        support@lugn-trygg.se →
                    </a>
                </div>
            </div>
            </>
            )}
        </div>
    );
};

export default FeedbackForm;
