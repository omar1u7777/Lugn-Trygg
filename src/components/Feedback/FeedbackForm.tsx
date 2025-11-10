import React, { useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { 
    Box, 
    Container, 
    Typography, 
    Button, 
    TextField, 
    Paper, 
    Grid, 
    Alert,
    FormControlLabel,
    Checkbox,
    CircularProgress,
    ButtonGroup,
    Rating,
    Card,
    CardContent,
    Link as MuiLink,
    useTheme
} from '@mui/material';
import { 
    Send as SendIcon, 
    History as HistoryIcon, 
    Edit as EditIcon,
    Email as EmailIcon,
    Help as HelpIcon,
    Chat as ChatIcon,
    Phone as PhoneIcon
} from '@mui/icons-material';
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
            <Container maxWidth="sm">
                <Paper 
                    elevation={3}
                    sx={{ 
                        p: spacing.xl, 
                        textAlign: 'center',
                        bgcolor: 'success.light',
                        color: 'success.contrastText'
                    }}
                >
                    <Typography variant="h1" sx={{ fontSize: '4rem', mb: spacing.md }}>✅</Typography>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>
                        Tack för din feedback!
                    </Typography>
                    <Typography variant="body1" sx={{ mb: spacing.lg }}>
                        Din feedback hjälper oss att göra Lugn & Trygg bättre för alla användare.
                    </Typography>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        onClick={() => setSubmitted(false)}
                    >
                        Skicka mer feedback
                    </Button>
                </Paper>
            </Container>
        );
    }

    const theme = useTheme();

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: spacing.xl }}>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                    💬 Feedback
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: spacing.md }}>
                    Din åsikt är viktig för oss! Dela dina tankar, förslag eller rapportera problem.
                </Typography>
                
                {/* Toggle History Button */}
                <Button
                    variant={showHistory ? "outlined" : "contained"}
                    color="primary"
                    startIcon={showHistory ? <EditIcon /> : <HistoryIcon />}
                    onClick={() => setShowHistory(!showHistory)}
                    sx={{ mt: spacing.md }}
                >
                    {showHistory ? '✍️ Ny feedback' : '📜 Visa min historik'}
                </Button>
            </Box>

            {/* Show history or form */}
            {showHistory ? (
                <FeedbackHistory />
            ) : (
                <Box>
                    {/* Error Message */}
                    {error && (
                        <Alert severity="error" sx={{ mb: spacing.lg }}>
                            {error}
                        </Alert>
                    )}

            {/* Main Form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {/* Category Selection */}
                <Paper elevation={2} sx={{ p: spacing.lg }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        📁 Kategori
                    </Typography>
                    <Grid container spacing={2}>
                        {categories.map((cat) => (
                            <Grid item xs={6} md={4} key={cat.value}>
                                <Button
                                    fullWidth
                                    variant={feedback.category === cat.value ? "contained" : "outlined"}
                                    color={feedback.category === cat.value ? "primary" : "inherit"}
                                    onClick={() => setFeedback({ ...feedback, category: cat.value })}
                                    sx={{ 
                                        height: '100%',
                                        py: spacing.md,
                                        flexDirection: 'column',
                                        gap: spacing.sm
                                    }}
                                >
                                    <Typography variant="h4">{cat.emoji}</Typography>
                                    <Typography variant="body2" fontWeight="medium">
                                        {cat.label.replace(cat.emoji + ' ', '')}
                                    </Typography>
                                </Button>
                            </Grid>
                        ))}
                    </Grid>
                </Paper>

                {/* Rating */}
                <Paper elevation={2} sx={{ p: spacing.lg }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        ⭐ Hur nöjd är du med Lugn & Trygg?
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <Rating
                            value={feedback.rating}
                            onChange={(event, newValue) => {
                                if (newValue !== null) {
                                    setFeedback({ ...feedback, rating: newValue });
                                }
                            }}
                            size="large"
                            sx={{ fontSize: '3rem' }}
                        />
                    </Box>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                        {feedback.rating === 1 && 'Mycket missnöjd'}
                        {feedback.rating === 2 && 'Missnöjd'}
                        {feedback.rating === 3 && 'Okej'}
                        {feedback.rating === 4 && 'Nöjd'}
                        {feedback.rating === 5 && 'Mycket nöjd'}
                    </Typography>
                </Paper>

                {/* Message */}
                <Paper elevation={2} sx={{ p: spacing.lg }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        ✍️ Ditt meddelande
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={6}
                        value={feedback.message}
                        onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                        placeholder="Berätta vad du tycker, föreslå förbättringar eller rapportera problem..."
                        required
                        inputProps={{ maxLength: 1000 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: spacing.sm, display: 'block' }}>
                        {feedback.message.length}/1000 tecken
                    </Typography>
                </Paper>

                {/* Contact Info */}
                <Paper elevation={2} sx={{ p: spacing.lg }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={feedback.allowContact}
                                onChange={(e) => setFeedback({ ...feedback, allowContact: e.target.checked })}
                                color="primary"
                            />
                        }
                        label={
                            <Box>
                                <Typography fontWeight="bold">Jag vill bli kontaktad</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Vi kanske behöver mer information om din feedback
                                </Typography>
                            </Box>
                        }
                    />
                    
                    {feedback.allowContact && (
                        <TextField
                            fullWidth
                            type="email"
                            label="📧 E-postadress"
                            value={feedback.email}
                            onChange={(e) => setFeedback({ ...feedback, email: e.target.value })}
                            placeholder="din.email@exempel.se"
                            sx={{ mt: spacing.md }}
                        />
                    )}
                </Paper>

                {/* Submit Button */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        size="large"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                        sx={{ 
                            px: 4, 
                            py: 1.5,
                            fontSize: '1.1rem',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading ? 'Skickar...' : '📤 Skicka feedback'}
                    </Button>
                </Box>
            </Box>

            {/* Quick Actions */}
            <Grid container spacing={2} sx={{ mt: spacing.xl }}>
                <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%', bgcolor: 'info.light' }}>
                        <CardContent>
                            <Typography variant="h3" sx={{ mb: spacing.md }}>📚</Typography>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Hjälpcenter
                            </Typography>
                            <Typography variant="body2" sx={{ mb: spacing.md }}>
                                Hitta svar på vanliga frågor
                            </Typography>
                            <MuiLink 
                                href="https://github.com/omar1u7777/Lugn-Trygg/wiki" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                underline="hover"
                                fontWeight="medium"
                            >
                                Besök hjälpcenter →
                            </MuiLink>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%', bgcolor: 'success.light' }}>
                        <CardContent>
                            <Typography variant="h3" sx={{ mb: spacing.md }}>💬</Typography>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Live Chat
                            </Typography>
                            <Typography variant="body2" sx={{ mb: spacing.md }}>
                                Chatta med vårt AI support-team
                            </Typography>
                            <Button
                                onClick={() => window.location.href = '/chatbot'}
                                sx={{ p: 0, textTransform: 'none', fontWeight: 'medium' }}
                            >
                                Starta chatt →
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%', bgcolor: 'secondary.light' }}>
                        <CardContent>
                            <Typography variant="h3" sx={{ mb: spacing.md }}>📞</Typography>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Kontakt
                            </Typography>
                            <Typography variant="body2" sx={{ mb: spacing.md }}>
                                Skicka ett email till oss
                            </Typography>
                            <MuiLink 
                                href="mailto:support@lugn-trygg.se"
                                underline="hover"
                                fontWeight="medium"
                            >
                                support@lugn-trygg.se →
                            </MuiLink>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            </Box>
            )}
        </Container>
    );
};

export default FeedbackForm;
