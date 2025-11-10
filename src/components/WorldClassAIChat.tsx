import React, { useState, useEffect, useRef } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Avatar,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Send,
  Close,
  Psychology,
  SmartToy,
  Person,
  ThumbUp,
  ThumbDown,
  MoreVert,
  VolumeUp,
  VolumeOff,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { chatWithAI, getChatHistory } from '../api/api';
import useAuth from '../hooks/useAuth';
import '../styles/world-class-design.css';

interface WorldClassAIChatProps {
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sentiment?: string;
  emotions?: string[];
}

const WorldClassAIChat: React.FC<WorldClassAIChatProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    analytics.page('World Class AI Chat', {
      component: 'WorldClassAIChat',
    });

    loadChatHistory();
    announceToScreenReader('AI therapist chat loaded. How can I help you today?', 'polite');
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    if (!user?.user_id) return;

    try {
      const history = await getChatHistory(user.user_id);
      const formattedMessages: ChatMessage[] = history.map((msg: any, index: number) => ({
        id: `history-${index}`,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || msg.message || '',
        timestamp: new Date(msg.timestamp || Date.now()),
        sentiment: msg.sentiment,
        emotions: msg.emotions,
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user?.user_id) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    analytics.track('AI Chat Message Sent', {
      message_length: inputMessage.length,
      component: 'WorldClassAIChat',
    });

    try {
      const response = await chatWithAI(user.user_id, inputMessage);

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.response || response.message || 'Jag är här för att lyssna och hjälpa till.',
        timestamp: new Date(),
        sentiment: response.sentiment,
        emotions: response.emotions,
      };

      setMessages(prev => [...prev, aiMessage]);

      analytics.track('AI Chat Response Received', {
        response_length: aiMessage.content.length,
        has_sentiment: !!response.sentiment,
        component: 'WorldClassAIChat',
      });

      announceToScreenReader('AI therapist responded', 'polite');

    } catch (error) {
      console.error('Failed to get AI response:', error);

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Förlåt, jag hade problem med att svara just nu. Kan du försöka igen?',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      announceToScreenReader('AI response failed', 'assertive');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    announceToScreenReader(
      voiceEnabled ? 'Voice responses disabled' : 'Voice responses enabled',
      'polite'
    );
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success.main';
      case 'negative': return 'error.main';
      case 'neutral': return 'warning.main';
      default: return 'primary.main';
    }
  };

  const quickSuggestions = [
    'Jag känner mig stressad idag',
    'Jag har svårt att sova',
    'Jag känner mig ensam',
    'Jag behöver motivation',
    'Berätta om mindfulness',
  ];

  if (loading) {
    return (
      <Box className="world-class-app" sx={{ p: spacing.xl, textAlign: 'center' }}>
        <Typography variant="h6" className="world-class-body">
          Laddar din AI-terapeut...
        </Typography>
        <LinearProgress sx={{ mt: spacing.md, borderRadius: borderRadius.md, height: 8 }} />
      </Box>
    );
  }

  return (
    <Box
      className="world-class-app"
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #f8fafc 0%, colors.text.inverse 50%, #f1f5f9 100%)',
      }}
    >
      {/* Header */}
      <Card className="world-class-dashboard-card" sx={{ borderRadius: 0, boxShadow: 1 }}>
        <CardContent sx={{ py: spacing.md, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <Psychology />
              </Avatar>
              <Box>
                <Typography variant="h6" className="world-class-heading-3">
                  AI Terapeut
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isTyping ? 'Skriver...' : 'Redo att lyssna'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <IconButton
                onClick={toggleVoice}
                color={voiceEnabled ? 'primary' : 'default'}
                aria-label={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
              >
                {voiceEnabled ? <VolumeUp /> : <VolumeOff />}
              </IconButton>

              <IconButton onClick={onClose} aria-label="Close chat">
                <Close />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Psychology sx={{ fontSize: 64, color: 'primary.main', mb: spacing.md, opacity: 0.5 }} />
            <Typography variant="h6" className="world-class-heading-3" gutterBottom>
              Välkommen till din AI-terapeut!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.lg }}>
              Jag är här för att lyssna och hjälpa dig. Vad ligger dig på hjärtat idag?
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
              {quickSuggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  label={suggestion}
                  onClick={() => setInputMessage(suggestion)}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'primary.light', color: 'white' }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              gap: spacing.md,
              alignItems: 'flex-start',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <Avatar
              sx={{
                bgcolor: message.role === 'user' ? 'secondary.main' : 'primary.main',
                width: 40,
                height: 40,
              }}
            >
              {message.role === 'user' ? <Person /> : <SmartToy />}
            </Avatar>

            <Box
              sx={{
                maxWidth: '70%',
                p: spacing.md,
                borderRadius: borderRadius.lg,
                bgcolor: message.role === 'user' ? 'secondary.light' : 'grey.50',
                border: message.role === 'user' ? 'none' : '1px solid',
                borderColor: 'divider',
                position: 'relative',
              }}
            >
              <Typography variant="body1" sx={{ mb: spacing.sm }}>
                {message.content}
              </Typography>

              {message.sentiment && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mt: spacing.sm }}>
                  <Chip
                    size="small"
                    label={message.sentiment}
                    sx={{
                      bgcolor: getSentimentColor(message.sentiment),
                      color: 'white',
                      fontSize: '0.75rem',
                    }}
                  />
                  {message.emotions && message.emotions.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {message.emotions.join(', ')}
                    </Typography>
                  )}
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: spacing.sm, display: 'block' }}>
                {message.timestamp.toLocaleTimeString('sv-SE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Typography>
            </Box>
          </Box>
        ))}

        {isTyping && (
          <Box sx={{ display: 'flex', gap: spacing.md, alignItems: 'flex-start' }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              <SmartToy />
            </Avatar>
            <Box
              sx={{
                p: spacing.md,
                borderRadius: borderRadius.lg,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box className="world-class-loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </Box>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Card sx={{ borderRadius: 0, boxShadow: shadows.md }}>
        <CardContent sx={{ py: spacing.md, px: 3 }}>
          <Box sx={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Skriv ditt meddelande här..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isTyping}
              inputRef={inputRef}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: borderRadius.lg,
                }
              }}
            />

            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              variant="contained"
              className="world-class-btn-primary"
              sx={{
                borderRadius: '50%',
                width: 56,
                height: 56,
                minWidth: 56,
              }}
              aria-label="Send message"
            >
              <Send />
            </Button>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: spacing.sm }}>
            <Typography variant="caption" color="text.secondary">
              Tryck Enter för att skicka • Shift+Enter för ny rad
            </Typography>

            {messages.length > 0 && (
              <Box sx={{ display: 'flex', gap: spacing.sm }}>
                <IconButton size="small" aria-label="Thumbs up">
                  <ThumbUp fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="Thumbs down">
                  <ThumbDown fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WorldClassAIChat;