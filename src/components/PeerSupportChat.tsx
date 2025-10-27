/**
 * Peer Support Chat Component
 * Anonymous peer-to-peer support chat for mental health discussions
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SendIcon from '@mui/icons-material/Send';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ReportIcon from '@mui/icons-material/Report';
import GroupIcon from '@mui/icons-material/Group';
import { trackEvent } from '../services/analytics';

interface Message {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: Date;
  likes: number;
  isSupporter?: boolean;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  category: 'anxiety' | 'depression' | 'stress' | 'general' | 'recovery';
  color: string;
}

const CHAT_ROOMS: ChatRoom[] = [
  {
    id: 'anxiety',
    name: 'Anxiety Support',
    description: 'Share your experiences with anxiety and find support',
    memberCount: 234,
    category: 'anxiety',
    color: '#FFB74D',
  },
  {
    id: 'depression',
    name: 'Depression Support',
    description: 'A safe space to talk about depression',
    memberCount: 189,
    category: 'depression',
    color: '#64B5F6',
  },
  {
    id: 'stress',
    name: 'Stress Management',
    description: 'Tips and support for managing stress',
    memberCount: 312,
    category: 'stress',
    color: '#81C784',
  },
  {
    id: 'general',
    name: 'General Wellness',
    description: 'General mental health discussions',
    memberCount: 456,
    category: 'general',
    color: '#BA68C8',
  },
  {
    id: 'recovery',
    name: 'Recovery Journey',
    description: 'Share your recovery progress and milestones',
    memberCount: 178,
    category: 'recovery',
    color: '#4DB6AC',
  },
];

// Mock messages for demonstration
const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    userId: 'user1',
    username: 'AnonymousUser123',
    avatar: '🌟',
    message: 'I\'ve been feeling anxious lately. Does anyone have tips for calming down?',
    timestamp: new Date(Date.now() - 10 * 60000),
    likes: 5,
  },
  {
    id: '2',
    userId: 'user2',
    username: 'HopefulHeart',
    avatar: '💙',
    message: 'Deep breathing exercises really help me. Try the 4-7-8 technique!',
    timestamp: new Date(Date.now() - 8 * 60000),
    likes: 8,
    isSupporter: true,
  },
  {
    id: '3',
    userId: 'user3',
    username: 'CalmMind',
    avatar: '🧘',
    message: 'I also find that going for a walk helps clear my mind.',
    timestamp: new Date(Date.now() - 5 * 60000),
    likes: 3,
  },
];

interface PeerSupportChatProps {
  userId: string;
  username?: string;
}

export const PeerSupportChat: React.FC<PeerSupportChatProps> = ({ userId, username }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && selectedRoom) {
      const message: Message = {
        id: Date.now().toString(),
        userId,
        username: username || 'Anonymous',
        avatar: '😊',
        message: newMessage,
        timestamp: new Date(),
        likes: 0,
      };
      
      setMessages([...messages, message]);
      setNewMessage('');
      
      trackEvent('peer_chat_message_sent', {
        userId,
        roomId: selectedRoom.id,
        messageLength: newMessage.length,
      });
    }
  };

  const handleLikeMessage = (messageId: string) => {
    setMessages(messages.map(msg => 
      msg.id === messageId ? { ...msg, likes: msg.likes + 1 } : msg
    ));
    
    trackEvent('peer_chat_message_liked', {
      userId,
      messageId,
    });
  };

  const handleJoinRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
    setActiveTab(1);
    
    trackEvent('peer_chat_room_joined', {
      userId,
      roomId: room.id,
      roomName: room.name,
    });
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <Box>
      <Card sx={{ mb: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              {t('chat.title', 'Peer Support Community')}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowGuidelines(true)}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              {t('chat.guidelines', 'Guidelines')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('chat.rooms', 'Chat Rooms')} />
        <Tab label={t('chat.activeChat', 'Active Chat')} disabled={!selectedRoom} />
      </Tabs>

      {activeTab === 0 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('chat.anonymous', 'All chats are anonymous and moderated for safety. Be kind and supportive!')}
          </Alert>
          
          <List>
            {CHAT_ROOMS.map((room) => (
              <motion.div
                key={room.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  sx={{
                    mb: 2,
                    cursor: 'pointer',
                    border: `2px solid ${room.color}`,
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: `0 0 20px ${room.color}`,
                    },
                  }}
                  onClick={() => handleJoinRoom(room)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {room.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {room.description}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip
                          icon={<GroupIcon />}
                          label={`${room.memberCount} members`}
                          size="small"
                          sx={{ bgcolor: `${room.color}22`, color: room.color }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </List>
        </Box>
      )}

      {activeTab === 1 && selectedRoom && (
        <Box>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">{selectedRoom.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedRoom.memberCount} members online
                  </Typography>
                </Box>
                <Button onClick={() => setActiveTab(0)} size="small">
                  {t('chat.changeRoom', 'Change Room')}
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ height: 500, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card
                      sx={{
                        mb: 2,
                        bgcolor: msg.userId === userId ? '#E3F2FD' : 'white',
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                          <Avatar sx={{ bgcolor: msg.isSupporter ? '#4CAF50' : '#9E9E9E' }}>
                            {msg.avatar}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {msg.username}
                              </Typography>
                              {msg.isSupporter && (
                                <Chip
                                  label="Supporter"
                                  size="small"
                                  color="success"
                                  sx={{ height: 20 }}
                                />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {formatTimestamp(msg.timestamp)}
                              </Typography>
                            </Box>
                            <Typography variant="body2">{msg.message}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleLikeMessage(msg.id)}
                                color={msg.likes > 0 ? 'error' : 'default'}
                              >
                                <Badge badgeContent={msg.likes} color="error">
                                  <FavoriteIcon fontSize="small" />
                                </Badge>
                              </IconButton>
                              <IconButton size="small" color="default">
                                <ReportIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </Box>

            <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={3}
                  placeholder={t('chat.typeMessage', 'Type your message...')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  sx={{ minWidth: 50 }}
                >
                  <SendIcon />
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('chat.reminder', 'Be respectful and supportive. Crisis? Call your local helpline.')}
              </Typography>
            </Box>
          </Card>
        </Box>
      )}

      {/* Community Guidelines Dialog */}
      <Dialog open={showGuidelines} onClose={() => setShowGuidelines(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('chat.guidelinesTitle', 'Community Guidelines')}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('chat.safeSpace', 'This is a safe and supportive space for everyone.')}
          </Alert>
          <Typography variant="body2" paragraph>
            <strong>✅ Do:</strong>
          </Typography>
          <ul>
            <li>Be kind, respectful, and supportive</li>
            <li>Share your experiences and feelings</li>
            <li>Encourage others on their journey</li>
            <li>Respect privacy and confidentiality</li>
          </ul>
          <Typography variant="body2" paragraph sx={{ mt: 2 }}>
            <strong>❌ Don't:</strong>
          </Typography>
          <ul>
            <li>Share personal information (names, addresses, etc.)</li>
            <li>Give medical advice or diagnoses</li>
            <li>Bully, harass, or discriminate</li>
            <li>Share triggering or graphic content</li>
          </ul>
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>{t('chat.crisis', 'In Crisis?')}</strong> This is not a crisis service. Call your local emergency number or crisis helpline immediately.
          </Alert>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PeerSupportChat;
