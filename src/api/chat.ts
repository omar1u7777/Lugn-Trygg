import { api } from "./client";
import { ApiError } from "./errors";

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isJoined: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  likes: number;
  isLiked: boolean;
}

/**
 * Get available chat rooms
 * @returns Promise resolving to chat rooms
 */
export const getChatRooms = async (): Promise<ChatRoom[]> => {
  try {
    const response = await api.get('/api/chat/rooms');
    return response.data.rooms || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Join a chat room
 * @param roomId - Room ID to join
 * @returns Promise resolving to join result
 */
export const joinChatRoom = async (roomId: string) => {
  try {
    const response = await api.post(`/api/chat/rooms/${roomId}/join`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Leave a chat room
 * @param roomId - Room ID to leave
 * @returns Promise resolving to leave result
 */
export const leaveChatRoom = async (roomId: string) => {
  try {
    const response = await api.post(`/api/chat/rooms/${roomId}/leave`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get chat messages for a room
 * @param roomId - Room ID
 * @returns Promise resolving to messages
 */
export const getChatMessages = async (roomId: string): Promise<ChatMessage[]> => {
  try {
    const response = await api.get(`/api/chat/messages/${roomId}`);
    return response.data.messages || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Send a chat message
 * @param roomId - Room ID
 * @param message - Message content
 * @returns Promise resolving to sent message
 */
export const sendChatMessage = async (roomId: string, message: string) => {
  try {
    const response = await api.post('/api/chat/messages', {
      room_id: roomId,
      message
    });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Toggle like on a message
 * @param messageId - Message ID
 * @returns Promise resolving to toggle result
 */
export const toggleMessageLike = async (messageId: string) => {
  try {
    const response = await api.post(`/api/chat/messages/${messageId}/like`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Report a chat message
 * @param messageId - Message ID
 * @param reason - Report reason
 * @returns Promise resolving to report result
 */
export const reportChatMessage = async (messageId: string, reason: string) => {
  try {
    const response = await api.post(`/api/chat/messages/${messageId}/report`, { reason });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Update typing status
 * @param roomId - Room ID
 * @param isTyping - Whether user is typing
 * @returns Promise resolving to status update
 */
export const updateTypingStatus = async (roomId: string, isTyping: boolean) => {
  try {
    const response = await api.post(`/api/chat/rooms/${roomId}/typing`, { is_typing: isTyping });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get room presence (online users)
 * @param roomId - Room ID
 * @returns Promise resolving to presence data
 */
export const getRoomPresence = async (roomId: string) => {
  try {
    const response = await api.get(`/api/chat/rooms/${roomId}/presence`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};