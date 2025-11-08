import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Container, 
    Typography, 
    Button, 
    Paper, 
    Grid, 
    Tabs,
    Tab,
    Alert,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    Divider,
    useTheme
} from '@mui/material';
import { 
    Edit as EditIcon,
    History as HistoryIcon,
    HourglassEmpty as PendingIcon,
    Visibility as ReviewedIcon,
    CheckCircle as ResolvedIcon,
    Assessment as StatsIcon
} from '@mui/icons-material';
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

    const theme = useTheme();

    const getStatusColor = (status: string): 'warning' | 'info' | 'success' | 'default' => {
        switch (status) {
            case 'pending':
                return 'warning';
            case 'reviewed':
                return 'info';
            case 'resolved':
                return 'success';
            default:
                return 'default';
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
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                    💬 Feedbacksystem
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
                    Dela dina åsikter och följ upp tidigare feedback
                </Typography>
            </Box>

            {/* Tabs */}
            <Paper elevation={2} sx={{ mb: 3 }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                >
                    <Tab 
                        value="submit" 
                        label="✍️ Skicka feedback" 
                        icon={<EditIcon />} 
                        iconPosition="start"
                    />
                    <Tab 
                        value="history" 
                        label="📜 Min historik" 
                        icon={<HistoryIcon />} 
                        iconPosition="start"
                    />
                </Tabs>
            </Paper>

            {/* Content */}
            {activeTab === 'submit' ? (
                <FeedbackForm />
            ) : (
                <Box>
                    {/* Stats */}
                    {stats && (
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={6} md={3}>
                                <Card>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <StatsIcon sx={{ fontSize: 40, mb: 1, color: 'text.secondary' }} />
                                        <Typography variant="h4" fontWeight="bold">
                                            {stats.total}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Totalt skickad
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Card sx={{ bgcolor: 'warning.light' }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <PendingIcon sx={{ fontSize: 40, mb: 1 }} />
                                        <Typography variant="h4" fontWeight="bold">
                                            {stats.pending}
                                        </Typography>
                                        <Typography variant="body2">
                                            Väntar
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Card sx={{ bgcolor: 'info.light' }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <ReviewedIcon sx={{ fontSize: 40, mb: 1 }} />
                                        <Typography variant="h4" fontWeight="bold">
                                            {stats.reviewed}
                                        </Typography>
                                        <Typography variant="body2">
                                            Granskad
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Card sx={{ bgcolor: 'success.light' }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <ResolvedIcon sx={{ fontSize: 40, mb: 1 }} />
                                        <Typography variant="h4" fontWeight="bold">
                                            {stats.resolved}
                                        </Typography>
                                        <Typography variant="body2">
                                            Löst
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}

                    {/* Error Message */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                            <CircularProgress size={60} sx={{ mb: 2 }} />
                            <Typography variant="body1" color="text.secondary">
                                Laddar feedbackhistorik...
                            </Typography>
                        </Box>
                    ) : feedbacks.length === 0 ? (
                        <Paper elevation={2} sx={{ p: 6, textAlign: 'center' }}>
                            <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>📭</Typography>
                            <Typography variant="h5" fontWeight="bold" gutterBottom>
                                Ingen feedback ännu
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                Du har inte skickat någon feedback än. Börja genom att gå till "Skicka feedback".
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<EditIcon />}
                                onClick={() => setActiveTab('submit')}
                            >
                                ✍️ Skicka din första feedback
                            </Button>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {feedbacks.map((item) => (
                                <Paper
                                    key={item.id}
                                    elevation={2}
                                    sx={{ p: 3, '&:hover': { boxShadow: 6 }, transition: 'box-shadow 0.3s' }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Typography variant="h3">{getCategoryEmoji(item.category)}</Typography>
                                            <Box>
                                                <Typography variant="h6" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                                                    {item.category}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {new Date(item.created_at).toLocaleString('sv-SE')}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ display: 'flex' }}>
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} style={{ fontSize: '1.25rem' }}>
                                                        {i < item.rating ? '⭐' : '☆'}
                                                    </span>
                                                ))}
                                            </Box>
                                            <Chip 
                                                label={getStatusText(item.status)} 
                                                color={getStatusColor(item.status)} 
                                                size="small"
                                            />
                                        </Box>
                                    </Box>
                                    
                                    <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                                        {item.message}
                                    </Typography>

                                    {item.response && (
                                        <Paper 
                                            elevation={0} 
                                            sx={{ 
                                                p: 2, 
                                                bgcolor: 'info.light',
                                                border: 1,
                                                borderColor: 'info.main'
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                <Typography variant="h6">💬</Typography>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                                        Svar från teamet:
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {item.response}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    )}
                                </Paper>
                            ))}
                        </Box>
                    )}
                </Box>
            )}

            {/* Help Section */}
            <Paper elevation={1} sx={{ p: 3, bgcolor: 'background.default', mt: 4 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    💡 Tips för bra feedback
                </Typography>
                <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                        Var specifik - beskriv exakt vad du upplever eller vad du vill förbättra
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                        Inkludera steg för att återskapa buggar om möjligt
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                        Förklara varför en funktion skulle vara användbar
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                        Var respektfull och konstruktiv i din feedback
                    </Typography>
                    <Typography component="li" variant="body2">
                        Kolla din feedbackhistorik för att se status på dina tidigare inlämningar
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default FeedbackSystem;
