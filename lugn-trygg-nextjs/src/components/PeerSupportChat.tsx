import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Avatar, List, Chip, IconButton, Dialog, DialogTitle, DialogContent, Alert, Tabs, Tab, Badge,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SendIcon from '@mui/icons-material/Send';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ReportIcon from '@mui/icons-material/Report';
import GroupIcon from '@mui/icons-material/Group';
//

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
  { id: 'anxiety', name: 'Anxiety Support', description: 'Share your experiences with anxiety and find support', memberCount: 234, category: 'anxiety', color: '#FFB74D' },
  { id: 'depression', name: 'Depression Support', description: 'A safe space to talk about depression', memberCount: 189, category: 'depression', color: '#64B5F6' },
  { id: 'stress', name: 'Stress Management', description: 'Tips and support for managing stress', memberCount: 312, category: 'stress', color: '#81C784' },
  { id: 'general', name: 'General Wellness', description: 'General mental health discussions', memberCount: 456, category: 'general', color: '#BA68C8' },
  { id: 'recovery', name: 'Recovery Journey', description: 'Share your recovery progress and milestones', memberCount: 178, category: 'recovery', color: '#4DB6AC' },
];

const MOCK_MESSAGES: Message[] = [
  { id: '1', userId: 'user1', username: 'AnonymousUser123', avatar: '🌟', message: 'I\'ve been feeling anxious lately. Does anyone have tips for calming down?', timestamp: new Date(Date.now() - 10 * 60000), likes: 5 },
  { id: '2', userId: 'user2', username: 'HopefulHeart', avatar: '💙', message: 'Deep breathing exercises really help me. Try the 4-7-8 technique!', timestamp: new Date(Date.now() - 8 * 60000), likes: 8, isSupporter: true },
  { id: '3', userId: 'user3', username: 'CalmMind', avatar: '🧘', message: 'I also find that going for a walk helps clear my mind.', timestamp: new Date(Date.now() - 5 * 60000), likes: 3 },
];

interface PeerSupportChatProps {
  userId: string;
  username?: string;
}

const PeerSupportChat: React.FC<PeerSupportChatProps> = ({ userId, username }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

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
      // trackEvent('peer_chat_message_sent', { userId, roomId: selectedRoom.id, messageLength: newMessage.length });
    }
  };

  const handleLikeMessage = (messageId: string) => {
    setMessages(messages.map(msg => msg.id === messageId ? { ...msg, likes: msg.likes + 1 } : msg));
    // trackEvent('peer_chat_message_liked', { userId, messageId });
  };

  const handleJoinRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
    setActiveTab(1);
    // trackEvent('peer_chat_room_joined', { userId, roomId: room.id, roomName: room.name });
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
      {/* ...UI code unchanged, see legacy for full details... */}
      <div className="bg-yellow-100 text-yellow-900 p-4 rounded-lg">
        <strong>PeerSupportChat</strong> komponenten är under migrering till Next.js.
      </div>
    </Box>
  );
};

export default PeerSupportChat;
