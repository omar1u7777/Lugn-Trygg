import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Paper, 
    CircularProgress, 
    Alert,
    Chip,
    Divider
} from '@mui/material';
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

    const statusColors: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
        pending: 'warning',
        reviewed: 'info',
        resolved: 'success'
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                    Laddar din feedback...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ textAlign: 'center' }}>
                {error}
            </Alert>
        );
    }

    if (feedback.length === 0) {
        return (
            <Paper elevation={2} sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>📭</Typography>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Ingen feedback ännu
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Du har inte skickat någon feedback än. Dela dina tankar med oss!
                </Typography>
            </Paper>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight="bold">
                    📜 Min Feedback-historik
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {feedback.length} {feedback.length === 1 ? 'feedback' : 'feedbacks'}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {feedback.map((item) => (
                    <Paper
                        key={item.id}
                        elevation={2}
                        sx={{ 
                            p: 3,
                            borderLeft: 4,
                            borderColor: 'primary.main',
                            '&:hover': { boxShadow: 6 },
                            transition: 'box-shadow 0.3s'
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="h3">{categoryEmojis[item.category] || '💬'}</Typography>
                                <Box>
                                    <Typography variant="h6" fontWeight="bold">
                                        {categoryNames[item.category] || item.category}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDate(item.created_at)}
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip 
                                label={statusNames[item.status] || item.status} 
                                color={statusColors[item.status] || 'default'} 
                                size="small"
                            />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <span key={star} style={{ fontSize: '1.25rem' }}>
                                        {star <= item.rating ? '⭐' : '☆'}
                                    </span>
                                ))}
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                    ({item.rating}/5)
                                </Typography>
                            </Box>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                {item.message}
                            </Typography>
                        </Box>

                        {item.response && (
                            <Paper 
                                elevation={0}
                                sx={{ 
                                    p: 2, 
                                    mt: 2,
                                    bgcolor: 'info.light',
                                    border: 1,
                                    borderColor: 'info.main'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="h6">💬</Typography>
                                    <Typography variant="subtitle2" fontWeight="bold">
                                        Svar från teamet
                                    </Typography>
                                    {item.responded_at && (
                                        <Typography variant="caption" color="text.secondary">
                                            • {formatDate(item.responded_at)}
                                        </Typography>
                                    )}
                                </Box>
                                <Typography variant="body2">
                                    {item.response}
                                </Typography>
                            </Paper>
                        )}

                        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                            Feedback-ID: #{item.id.slice(0, 8)}
                        </Typography>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};

export default FeedbackHistory;
