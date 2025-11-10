import React, { useState } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { Box, Button, Card, CardContent, TextField, Typography, List, ListItem, ListItemText } from '@mui/material';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';

const ChatbotTherapist: React.FC = () => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();

  const sendMessage = async () => {
    if (!input) return;
    setLoading(true);
    setError(null);

    const newHistory = [...history, { role: 'user', content: input }];
    setHistory(newHistory);
    setInput('');

    try {
      const { data } = await api.post('/api/chatbot/chat', {
        user_id: user?.user_id,
        message: input,
        history: history
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory((h) => [...h, { role: 'bot', content: data.response || data.reply || '...' }]);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 720, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h6">Chatbot Therapist</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.md }}>
          A compassionate assistant to talk through your feelings. Not a replacement for professional care.
        </Typography>

        <List sx={{ maxHeight: 300, overflow: 'auto', background: '#fafafa' }}>
          {history.map((item, idx) => (
            <ListItem key={idx} disableGutters>
              <ListItemText primary={item.content} secondary={item.role} />
            </ListItem>
          ))}
        </List>

        <Box sx={{ display: 'flex', gap: spacing.md, mt: spacing.md }}>
          <TextField fullWidth value={input} onChange={(e) => setInput(e.target.value)} placeholder="Skriv hur du känner" />
          <Button variant="contained" onClick={sendMessage} disabled={!input || loading}>
            Send
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mt: spacing.md }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatbotTherapist;
