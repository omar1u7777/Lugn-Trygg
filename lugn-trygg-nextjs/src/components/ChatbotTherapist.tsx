import React, { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, List, ListItem, ListItemText } from '@mui/material';

const ChatbotTherapist: React.FC = () => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input) return;
    setLoading(true);
    setError(null);
    const newHistory = [...history, { role: 'user', content: input }];
    setHistory(newHistory);
    setInput('');
    // Simulate bot response
    setTimeout(() => {
      setHistory((h) => [...h, { role: 'bot', content: 'Tack för att du delar med dig. Hur känner du nu?' }]);
      setLoading(false);
    }, 1000);
  };

  return (
    <Card sx={{ maxWidth: 720, margin: '16px auto' }}>
      <CardContent>
        <Typography variant="h6">Chatbot Therapist</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A compassionate assistant to talk through your feelings. Not a replacement for professional care.
        </Typography>
        <List sx={{ maxHeight: 300, overflow: 'auto', background: '#fafafa' }}>
          {history.map((item, idx) => (
            <ListItem key={idx} disableGutters>
              <ListItemText primary={item.content} secondary={item.role} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <TextField fullWidth value={input} onChange={(e) => setInput(e.target.value)} placeholder="Skriv hur du känner" />
          <Button variant="contained" onClick={sendMessage} disabled={!input || loading}>
            Send
          </Button>
        </Box>
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatbotTherapist;
