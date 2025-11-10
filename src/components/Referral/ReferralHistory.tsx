import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    Chip,
    Button,
    Divider,
} from '@mui/material';

interface ReferralHistoryEntry {
    invitee_name: string;
    invitee_email: string;
    completed_at: string;
    rewards_granted: number;
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
            const response = await api.get(`/api/referral/history?user_id=${user.user_id}`);
            setHistory(response.data.history || []);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch referral history:', err);
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={40} sx={{ mb: spacing.sm }} />
                    <Typography variant="body2" color="text.secondary">
                        Laddar historik...
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ borderRadius: borderRadius.md }}>
                {error}
            </Alert>
        );
    }

    return (
        <Paper elevation={3} sx={{ p: spacing.lg, borderRadius: borderRadius.lg }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.md }}>
                <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    📜 Referenshistorik
                </Typography>
                <Chip
                    label={`${history.length} totalt`}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                />
            </Box>

            {history.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h2" sx={{ fontSize: '3rem', mb: spacing.sm }}>
                        🌱
                    </Typography>
                    <Typography variant="body1" fontWeight="500" color="text.secondary" gutterBottom>
                        Inga referenser än
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Dela din referenskod för att komma igång!
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {history.map((entry, idx) => (
                        <Paper
                            key={idx}
                            elevation={0}
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                p: spacing.md,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                                borderRadius: borderRadius.md,
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                                },
                            }}
                        >
                            <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: 0.5 }}>
                                    <Typography variant="body1">👤</Typography>
                                    <Typography variant="body1" fontWeight="600" color="text.primary">
                                        {entry.invitee_name}
                                    </Typography>
                                </Box>
                                {entry.invitee_email && (
                                    <Typography variant="body2" color="text.secondary" sx={{ ml: 3.5 }}>
                                        📧 {entry.invitee_email}
                                    </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5, mt: 0.5, display: 'block' }}>
                                    🕐 {formatDate(entry.completed_at)}
                                </Typography>
                            </Box>

                            <Chip
                                label={`+${entry.rewards_granted} vecka`}
                                color="success"
                                size="small"
                                sx={{ fontWeight: 600, flexShrink: 0 }}
                            />
                        </Paper>
                    ))}
                </Box>
            )}

            {history.length > 0 && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Button
                        onClick={fetchHistory}
                        fullWidth
                        variant="text"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        🔄 Uppdatera historik
                    </Button>
                </>
            )}
        </Paper>
    );
};

export default ReferralHistory;
