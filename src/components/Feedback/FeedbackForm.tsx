import React, { useState } from 'react'
import { Button, Card, Alert, Input } from '../ui/tailwind';
import { PaperAirplaneIcon, ClockIcon, PencilIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
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
        } catch (err: unknown) {
            console.error('❌ Failed to submit feedback:', err);
            const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'message' in err.response.data
                ? String(err.response.data.message)
                : 'Något gick fel vid inlämnandet. Försök igen.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleRatingClick = (rating: number) => {
        setFeedback({ ...feedback, rating });
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 py-12">
                <Card className="max-w-md w-full p-8 text-center shadow-xl">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                        Tack för din feedback!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Din feedback hjälper oss att göra Lugn & Trygg bättre för alla användare.
                    </p>
                    <Button
                        variant="success"
                        size="lg"
                        onClick={() => setSubmitted(false)}
                        className="w-full"
                    >
                        Skicka mer feedback
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    💬 Feedback
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                    Din åsikt är viktig för oss! Dela dina tankar, förslag eller rapportera problem.
                </p>
                
                {/* Toggle History Button */}
                <Button
                    variant={showHistory ? "outline" : "primary"}
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2"
                >
                    {showHistory ? (
                        <>
                            <PencilIcon className="w-5 h-5" />
                            ✍️ Ny feedback
                        </>
                    ) : (
                        <>
                            <ClockIcon className="w-5 h-5" />
                            📜 Visa min historik
                        </>
                    )}
                </Button>
            </div>

            {/* Show history or form */}
            {showHistory ? (
                <FeedbackHistory />
            ) : (
                <div className="space-y-6">
                    {/* Error Message */}
                    {error && (
                        <Alert variant="error">
                            {error}
                        </Alert>
                    )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category Selection */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                        📁 Kategori
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {categories.map((cat) => (
                            <Button
                                key={cat.value}
                                type="button"
                                variant={feedback.category === cat.value ? "primary" : "outline"}
                                onClick={() => setFeedback({ ...feedback, category: cat.value })}
                                className="flex flex-col items-center justify-center py-4 h-auto"
                            >
                                <span className="text-4xl mb-2">{cat.emoji}</span>
                                <span className="text-sm font-medium">
                                    {cat.label.replace(cat.emoji + ' ', '')}
                                </span>
                            </Button>
                        ))}
                    </div>
                </Card>

                {/* Rating */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                        ⭐ Hur nöjd är du med Lugn & Trygg?
                    </h2>
                    <div className="flex justify-center gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingClick(star)}
                                className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                            >
                                {star <= feedback.rating ? (
                                    <StarIconSolid className="w-10 h-10 text-yellow-400" />
                                ) : (
                                    <StarIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                        {feedback.rating === 1 && 'Mycket missnöjd'}
                        {feedback.rating === 2 && 'Missnöjd'}
                        {feedback.rating === 3 && 'Okej'}
                        {feedback.rating === 4 && 'Nöjd'}
                        {feedback.rating === 5 && 'Mycket nöjd'}
                    </p>
                </Card>

                {/* Message */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                        ✍️ Ditt meddelande
                    </h2>
                    <textarea
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        rows={6}
                        value={feedback.message}
                        onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                        placeholder="Berätta vad du tycker, föreslå förbättringar eller rapportera problem..."
                        required
                        maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                        {feedback.message.length}/1000 tecken
                    </p>
                </Card>

                {/* Contact Info */}
                <Card className="p-6">
                    <label className="flex items-start gap-3 cursor-pointer mb-4">
                        <input
                            type="checkbox"
                            checked={feedback.allowContact}
                            onChange={(e) => setFeedback({ ...feedback, allowContact: e.target.checked })}
                            className="w-5 h-5 mt-1 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                        />
                        <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">
                                Jag vill bli kontaktad
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Vi kanske behöver mer information om din feedback
                            </p>
                        </div>
                    </label>
                    
                    {feedback.allowContact && (
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                📧 E-postadress
                            </label>
                            <Input
                                type="email"
                                value={feedback.email}
                                onChange={(e) => setFeedback({ ...feedback, email: e.target.value })}
                                placeholder="din.email@exempel.se"
                                className="w-full"
                            />
                        </div>
                    )}
                </Card>

                {/* Submit Button */}
                <div className="flex justify-center">
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        disabled={loading}
                        className="flex items-center gap-2 px-8"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Skickar...
                            </>
                        ) : (
                            <>
                                <PaperAirplaneIcon className="w-5 h-5" />
                                📤 Skicka feedback
                            </>
                        )}
                    </Button>
                </div>
            </form>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <Card className="p-6 text-center">
                    <div className="text-4xl mb-3">📚</div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                        Hjälpcenter
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Hitta svar på vanliga frågor
                    </p>
                    <a 
                        href="https://github.com/omar1u7777/Lugn-Trygg/wiki" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                    >
                        Besök hjälpcenter →
                    </a>
                </Card>
                <Card className="p-6 text-center">
                    <div className="text-4xl mb-3">💬</div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                        Live Chat
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Chatta med vårt AI support-team
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/chatbot'}
                    >
                        Starta chatt →
                    </Button>
                </Card>
                <Card className="p-6 text-center">
                    <div className="text-4xl mb-3">📞</div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                        Kontakt
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Skicka ett email till oss
                    </p>
                    <a 
                        href="mailto:support@lugn-trygg.se"
                        className="text-primary hover:underline font-medium"
                    >
                        support@lugn-trygg.se →
                    </a>
                </Card>
            </div>
            </div>
            )}
        </div>
    );
};

export default FeedbackForm;
