import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

export interface ChatRoom {
  id: string;
  name: string;
  name_en?: string;
  description: string;
  description_en?: string;
  memberCount: number;
  color?: string;
  icon?: string;
  category?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  session_id: string;
  anonymous_name: string;
  avatar: string;
  message: string;
  timestamp: string;
  likes: number;
  liked_by: string[];
  reported: boolean;
}

export interface ChatSession {
  sessionId: string;
  session_id: string;  // Alias for backwards compatibility
  anonymousName: string;
  anonymous_name: string;  // Alias for backwards compatibility
  avatar: string;
  room: ChatRoom;
  messages: ChatMessage[];
}

/**
 * Get available chat rooms
 * @returns Promise resolving to chat rooms
 */
export const getChatRooms = async (): Promise<ChatRoom[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.PEER_CHAT.CHAT_ROOMS);
    return response.data?.data?.rooms || response.data?.rooms || [];
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
 * @param userId - User ID
 * @returns Promise resolving to session data
 */
export const joinChatRoom = async (roomId: string, userId: string): Promise<ChatSession> => {
  try {
    const response = await api.post(`${API_ENDPOINTS.PEER_CHAT.CHAT_ROOM_JOIN}/${roomId}/join`, { user_id: userId });
    const data = response.data?.data || response.data;
    
    // Normalize response to include both camelCase and snake_case for compatibility
    return {
      sessionId: data.sessionId,
      session_id: data.sessionId,  // Alias
      anonymousName: data.anonymousName,
      anonymous_name: data.anonymousName,  // Alias
      avatar: data.avatar,
      room: data.room,
      messages: data.messages || []
    };
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
 * @param sessionId - Session ID
 * @returns Promise resolving to leave result
 */
export const leaveChatRoom = async (roomId: string, sessionId: string) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.PEER_CHAT.CHAT_ROOM_LEAVE}/${roomId}/leave`, { session_id: sessionId });
    return response.data?.data || response.data;
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
 * @param sessionId - Session ID
 * @param after - Last message ID for incremental updates
 * @returns Promise resolving to messages
 */
export const getChatMessages = async (roomId: string, sessionId?: string, after?: string): Promise<ChatMessage[]> => {
  try {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (after) params.append('after', after);
    
    const response = await api.get(`${API_ENDPOINTS.PEER_CHAT.CHAT_MESSAGES}/${roomId}/messages?${params.toString()}`);
    return response.data?.data?.messages || response.data?.messages || [];
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
 * @param sessionId - Session ID
 * @param message - Message content
 * @param anonymousName - Anonymous display name
 * @param avatar - Avatar emoji
 * @returns Promise resolving to sent message
 */
export const sendChatMessage = async (
  roomId: string, 
  sessionId: string, 
  message: string,
  anonymousName?: string,
  avatar?: string
) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.PEER_CHAT.CHAT_SEND}/${roomId}/send`, {
      session_id: sessionId,
      message,
      anonymous_name: anonymousName,
      avatar
    });
    return response.data?.data?.message || response.data?.message || response.data;
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
 * @param sessionId - Session ID
 * @returns Promise resolving to toggle result
 */
export const toggleMessageLike = async (messageId: string, sessionId: string) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.PEER_CHAT.CHAT_LIKE}/${messageId}/like`, { session_id: sessionId });
    return response.data?.data || response.data;
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
 * @param sessionId - Session ID
 * @param reason - Report reason
 * @returns Promise resolving to report result
 */
export const reportChatMessage = async (messageId: string, sessionId: string, reason: string) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.PEER_CHAT.CHAT_REPORT}/${messageId}/report`, { 
      session_id: sessionId,
      reason 
    });
    return response.data?.data || response.data;
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
 * @param sessionId - Session ID
 * @param isTyping - Whether user is typing
 * @returns Promise resolving to status update
 */
export const updateTypingStatus = async (roomId: string, sessionId: string, isTyping: boolean) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.PEER_CHAT.CHAT_TYPING}/${roomId}/typing`, { 
      session_id: sessionId,
      is_typing: isTyping 
    });
    return response.data?.data || response.data;
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
    const response = await api.get(`${API_ENDPOINTS.PEER_CHAT.CHAT_PRESENCE}/${roomId}/presence`);
    return response.data?.data || response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};