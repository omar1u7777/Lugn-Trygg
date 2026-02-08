/**
 * Peer Support Chat Component
 * Real anonymous peer-to-peer support chat with Firebase backend
 */

import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Dialog } from './ui/tailwind';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../services/analytics';
import {
  getChatRooms,
  joinChatRoom,
  leaveChatRoom,
  getChatMessages,
  sendChatMessage,
  toggleMessageLike,
  reportChatMessage,
  updateTypingStatus,
  getRoomPresence,
  ChatRoom,
  ChatMessage,
  ChatSession
} from '../api/api';
import {
  PaperAirplaneIcon,
  UserGroupIcon,
  HeartIcon,
  FlagIcon,
  InformationCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { logger } from '../utils/logger';

interface PeerSupportChatProps {
  userId: string;
  username?: string;
}

// Polling interval for new messages (3 seconds)
const POLL_INTERVAL = 3000;
// Presence update interval (10 seconds)
const PRESENCE_INTERVAL = 10000;

export const PeerSupportChat: React.FC<PeerSupportChatProps> = ({ userId }) => {
  const { t, i18n } = useTranslation();
  const isSwedish = i18n.language?.startsWith('sv');

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ activeCount: number; typingUsers: string[] }>({ activeCount: 0, typingUsers: [] });
  const [showReportDialog, setShowReportDialog] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load chat rooms on mount
  useEffect(() => {
    loadRooms();
    return () => {
      // Cleanup intervals
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      // Leave room on unmount
      if (session && selectedRoom) {
        leaveChatRoom(selectedRoom.id, session.session_id);
      }
    };
  }, []);

  // Start polling when in chat room
  useEffect(() => {
    if (session && selectedRoom) {
      // Start polling for new messages
      pollIntervalRef.current = setInterval(() => {
        pollMessages();
      }, POLL_INTERVAL);

      // Start presence updates
      presenceIntervalRef.current = setInterval(() => {
        updatePresence();
      }, PRESENCE_INTERVAL);

      // Initial presence fetch
      updatePresence();
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    };
  }, [session, selectedRoom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const roomsData = await getChatRooms();
      setRooms(roomsData);
    } catch {
      setError(isSwedish ? 'Kunde inte ladda chattrum' : 'Failed to load chat rooms');
    } finally {
      setLoading(false);
    }
  };

  const pollMessages = async () => {
    if (!session || !selectedRoom) return;

    try {
      const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id : undefined;
      const newMessages = await getChatMessages(selectedRoom.id, session.session_id, lastMessageId);

      if (newMessages.length > 0) {
        // Merge new messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter((m: ChatMessage) => !existingIds.has(m.id));
          return [...prev, ...uniqueNewMessages];
        });
      }
    } catch (err) {
      logger.error('Poll messages error:', err);
    }
  };

  const updatePresence = async () => {
    if (!selectedRoom) return;
    try {
      const presenceData = await getRoomPresence(selectedRoom.id);
      setPresence(presenceData);
    } catch {
      // Silently fail presence updates
    }
  };

  const handleJoinRoom = async (room: ChatRoom) => {
    setLoadingMessages(true);
    setError(null);

    try {
      const sessionData = await joinChatRoom(room.id, userId);

      if (sessionData) {
        setSession(sessionData);
        setSelectedRoom(room);
        setMessages(sessionData.messages || []);
        setActiveTab(1);

        trackEvent('peer_chat_room_joined', {
          userId,
          roomId: room.id,
          roomName: room.name,
        });
      } else {
        setError(isSwedish ? 'Kunde inte gå med i rummet' : 'Failed to join room');
      }
    } catch {
      setError(isSwedish ? 'Något gick fel' : 'Something went wrong');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (session && selectedRoom) {
      await leaveChatRoom(selectedRoom.id, session.session_id);
    }

    setSession(null);
    setSelectedRoom(null);
    setMessages([]);
    setActiveTab(0);

    // Clear intervals
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || !session) return;

    setSending(true);
    setError(null);

    try {
      const sentMessage = await sendChatMessage(
        selectedRoom.id,
        session.session_id,
        newMessage.trim(),
        session.anonymous_name,
        session.avatar
      );

      if (sentMessage) {
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');

        trackEvent('peer_chat_message_sent', {
          userId,
          roomId: selectedRoom.id,
          messageLength: newMessage.length,
        });
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      const errorMsg = apiError?.response?.data?.error;
      setError(errorMsg || (isSwedish ? 'Kunde inte skicka meddelandet' : 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!session || !selectedRoom) return;

    // Send typing indicator
    updateTypingStatus(selectedRoom.id, session.session_id, true);

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(selectedRoom.id, session.session_id, false);
    }, 3000);
  };

  const handleLikeMessage = async (messageId: string) => {
    if (!session) return;

    const result = await toggleMessageLike(messageId, session.session_id);

    if (result) {
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, likes: result.likes } : msg
      ));

      trackEvent('peer_chat_message_liked', {
        userId,
        messageId,
      });
    }
  };

  const handleReportMessage = async () => {
    if (!showReportDialog || !session) return;

    const success = await reportChatMessage(showReportDialog, session.session_id, reportReason);

    if (success) {
      setShowReportDialog(null);
      setReportReason('');
      // Mark message as reported locally
      setMessages(prev => prev.map(msg =>
        msg.id === showReportDialog ? { ...msg, reported: true } : msg
      ));
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return isSwedish ? 'Nyss' : 'Just now';
    if (minutes < 60) return `${minutes}m ${isSwedish ? 'sedan' : 'ago'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${isSwedish ? 'sedan' : 'ago'}`;
    return date.toLocaleDateString();
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    return isSwedish ? room.name : (room.name_en || room.name);
  };

  const getRoomDisplayDesc = (room: ChatRoom) => {
    return isSwedish ? room.description : (room.description_en || room.description);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </Card>
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserGroupIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600" aria-hidden="true" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {t('chat.title', 'Peer Support Community')}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={loadRooms}
                className="min-h-[44px]"
              >
                <ArrowPathIcon className="w-5 h-5" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowGuidelines(true)}
                className="min-h-[44px]"
              >
                <InformationCircleIcon className="w-5 h-5 mr-2" aria-hidden="true" />
                {t('chat.guidelines', 'Guidelines')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-error-600" />
            <p className="text-sm text-error-800 dark:text-error-200">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700" role="tablist">
        <button
          onClick={() => { if (!loadingMessages) setActiveTab(0); }}
          role="tab"
          aria-selected={activeTab === 0}
          aria-controls="chat-rooms-panel"
          className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${activeTab === 0
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          {t('chat.rooms', 'Chat Rooms')}
        </button>
        <button
          onClick={() => setActiveTab(1)}
          role="tab"
          aria-selected={activeTab === 1}
          aria-controls="active-chat-panel"
          disabled={!selectedRoom}
          className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 1
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          {t('chat.activeChat', 'Active Chat')}
        </button>
      </div>

      {/* Chat Rooms Tab */}
      {activeTab === 0 && (
        <div id="chat-rooms-panel" role="tabpanel" className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('chat.anonymous', 'All chats are anonymous and moderated for safety. Be kind and supportive!')}
            </p>
          </div>

          {rooms.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {isSwedish ? 'Inga chattrum tillgängliga just nu' : 'No chat rooms available right now'}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => (
                <motion.div
                  key={room.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    onClick={() => !loadingMessages && handleJoinRoom(room)}
                    className={`cursor-pointer border-2 hover:shadow-lg transition-all duration-300 ${loadingMessages ? 'opacity-50' : ''}`}
                    style={{ borderColor: room.color }}
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{room.icon}</span>
                            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                              {getRoomDisplayName(room)}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {getRoomDisplayDesc(room)}
                          </p>
                        </div>
                        <div
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                          style={{ backgroundColor: `${room.color}22`, color: room.color }}
                        >
                          <UserGroupIcon className="w-4 h-4" aria-hidden="true" />
                          <span>{room.memberCount || 0} {isSwedish ? 'online' : 'online'}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Chat Tab */}
      {activeTab === 1 && selectedRoom && session && (
        <div id="active-chat-panel" role="tabpanel" className="space-y-4">
          {/* Room Header */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedRoom.icon}</span>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                      {getRoomDisplayName(selectedRoom)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {presence.activeCount} {isSwedish ? 'online' : 'online'}
                    </p>
                    <span className="text-xs text-gray-500">•</span>
                    <p className="text-xs text-primary-600">
                      {isSwedish ? 'Du är' : 'You are'} {session.avatar} {session.anonymous_name}
                    </p>
                  </div>
                  {presence.typingUsers.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      {presence.typingUsers.join(', ')} {isSwedish ? 'skriver...' : 'typing...'}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleLeaveRoom}
                  variant="outline"
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  {t('chat.changeRoom', 'Change Room')}
                </Button>
              </div>
            </div>
          </Card>

          {/* Messages Container */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 max-h-[500px] overflow-y-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>{isSwedish ? 'Inga meddelanden ännu. Starta konversationen!' : 'No messages yet. Start the conversation!'}</p>
                </div>
              ) : (
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className={`bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 ${msg.session_id === session.session_id ? 'border-l-4 border-primary-500' : ''
                        } ${msg.reported ? 'opacity-50' : ''}`}>
                        <div className="flex gap-3">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-lg font-semibold">
                              {msg.avatar}
                            </div>
                          </div>

                          {/* Message Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {msg.anonymous_name}
                              </span>
                              {msg.session_id === session.session_id && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200">
                                  {isSwedish ? 'Du' : 'You'}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                              {msg.message}
                            </p>

                            {/* Actions */}
                            {!msg.reported && (
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={() => handleLikeMessage(msg.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                  aria-label={`Like message from ${msg.anonymous_name}`}
                                >
                                  {msg.likes > 0 ? (
                                    <HeartIconSolid className="w-4 h-4 text-error-600" aria-hidden="true" />
                                  ) : (
                                    <HeartIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                                  )}
                                  {msg.likes > 0 && (
                                    <span className="text-xs font-medium text-error-600">
                                      {msg.likes}
                                    </span>
                                  )}
                                </button>
                                {msg.session_id !== session.session_id && (
                                  <button
                                    onClick={() => setShowReportDialog(msg.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                    aria-label="Report message"
                                  >
                                    <FlagIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <textarea
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  rows={2}
                  placeholder={t('chat.typeMessage', 'Type your message...')}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sending}
                />
                <Button
                  variant="primary"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 min-h-[44px] self-end"
                  aria-label="Send message"
                >
                  {sending ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <PaperAirplaneIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t('chat.reminder', 'Be respectful and supportive. Crisis? Call your local helpline.')}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Report Message Dialog */}
      <Dialog open={!!showReportDialog} onClose={() => setShowReportDialog(null)}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {isSwedish ? 'Rapportera meddelande' : 'Report Message'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isSwedish
              ? 'Beskriv varför detta meddelande bör granskas av moderatorer.'
              : 'Describe why this message should be reviewed by moderators.'}
          </p>
          <textarea
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            rows={3}
            placeholder={isSwedish ? 'Anledning...' : 'Reason...'}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
          />
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowReportDialog(null)} className="flex-1">
              {isSwedish ? 'Avbryt' : 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleReportMessage} disabled={!reportReason.trim()} className="flex-1">
              {isSwedish ? 'Rapportera' : 'Report'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Community Guidelines Dialog */}
      <Dialog open={showGuidelines} onClose={() => setShowGuidelines(false)}>
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t('chat.guidelinesTitle', 'Community Guidelines')}
            </h2>
            <button
              onClick={() => setShowGuidelines(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Close dialog"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('chat.safeSpace', 'This is a safe and supportive space for everyone.')}
              </p>
            </div>

            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                <span role="img" aria-label="checkmark">✅</span> {isSwedish ? 'Gör:' : 'Do:'}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>{isSwedish ? 'Var snäll, respektfull och stöttande' : 'Be kind, respectful, and supportive'}</li>
                <li>{isSwedish ? 'Dela dina erfarenheter och känslor' : 'Share your experiences and feelings'}</li>
                <li>{isSwedish ? 'Uppmuntra andra på deras resa' : 'Encourage others on their journey'}</li>
                <li>{isSwedish ? 'Respektera integritet och sekretess' : 'Respect privacy and confidentiality'}</li>
              </ul>
            </div>

            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                <span role="img" aria-label="prohibited">❌</span> {isSwedish ? 'Gör inte:' : "Don't:"}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>{isSwedish ? 'Dela personlig information (namn, adresser, etc.)' : 'Share personal information (names, addresses, etc.)'}</li>
                <li>{isSwedish ? 'Ge medicinsk rådgivning eller diagnoser' : 'Give medical advice or diagnoses'}</li>
                <li>{isSwedish ? 'Mobba, trakassera eller diskriminera' : 'Bully, harass, or discriminate'}</li>
                <li>{isSwedish ? 'Dela triggande eller grafiskt innehåll' : 'Share triggering or graphic content'}</li>
              </ul>
            </div>

            <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4">
              <p className="text-sm text-error-900 dark:text-error-100">
                <strong>{t('chat.crisis', 'In Crisis?')}</strong> {isSwedish
                  ? 'Detta är inte en kristjänst. Ring ditt lokala nödnummer eller krisjour omedelbart.'
                  : 'This is not a crisis service. Call your local emergency number or crisis helpline immediately.'}
              </p>
            </div>

            <div className="pt-4">
              <Button
                variant="primary"
                onClick={() => setShowGuidelines(false)}
                className="w-full min-h-[44px]"
              >
                {isSwedish ? 'Jag förstår' : 'I Understand'}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default PeerSupportChat;



