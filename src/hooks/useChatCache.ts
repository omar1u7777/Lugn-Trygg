import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sentiment?: string;
  emotions?: string[];
}

interface ChatCache {
  [userId: string]: {
    messages: ChatMessage[];
    lastUpdated: Date;
    unreadCount: number;
  };
}

const CACHE_KEY = 'lugn-trygg-chat-cache';
const MAX_CACHE_SIZE = 1000; // Max messages per user
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export const useChatCache = (userId: string) => {
  const [cache, setCache] = useState<ChatCache>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        // Clean expired entries
        const cleanedCache = cleanExpiredCache(parsedCache);
        
        setCache(cleanedCache);
        
        // Save cleaned cache back
        localStorage.setItem(CACHE_KEY, JSON.stringify(cleanedCache));
      }
    } catch (error) {
      logger.error('Failed to load chat cache:', error);
      // Clear corrupted cache
      localStorage.removeItem(CACHE_KEY);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Clean expired cache entries
  const cleanExpiredCache = (cache: ChatCache): ChatCache => {
    const cleaned: ChatCache = {};
    const now = new Date().getTime();
    
    for (const [uid, data] of Object.entries(cache)) {
      const lastUpdated = new Date(data.lastUpdated).getTime();
      
      if (now - lastUpdated < CACHE_EXPIRY) {
        // Limit message count
        if (data.messages.length > MAX_CACHE_SIZE) {
          cleaned[uid] = {
            ...data,
            messages: data.messages.slice(-MAX_CACHE_SIZE)
          };
        } else {
          cleaned[uid] = data;
        }
      }
    }
    
    return cleaned;
  };

  // Save cache to localStorage
  const saveCache = useCallback((updatedCache: ChatCache) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedCache));
      setCache(updatedCache);
    } catch (error) {
      logger.error('Failed to save chat cache:', error);
      
      // Try to clear some space
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        const trimmedCache = trimCache(cache);
        localStorage.setItem(CACHE_KEY, JSON.stringify(trimmedCache));
        setCache(trimmedCache);
      }
    }
  }, []);

  // Trim cache to free space
  const trimCache = (cache: ChatCache): ChatCache => {
    const trimmed: ChatCache = {};
    
    for (const [uid, data] of Object.entries(cache)) {
      trimmed[uid] = {
        ...data,
        messages: data.messages.slice(-MAX_CACHE_SIZE / 2) // Keep half
      };
    }
    
    return trimmed;
  };

  // Get cached messages for user
  const getCachedMessages = useCallback((): ChatMessage[] => {
    if (!userId || !isLoaded) return [];
    
    const userCache = cache[userId];
    if (!userCache) return [];
    
    return userCache.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  }, [userId, cache, isLoaded]);

  // Add messages to cache
  const addToCache = useCallback((messages: ChatMessage[]) => {
    if (!userId) return;
    
    const userCache = cache[userId] || {
      messages: [],
      lastUpdated: new Date(),
      unreadCount: 0
    };
    
    // Merge with existing messages, avoiding duplicates
    const existingIds = new Set(userCache.messages.map(m => m.id));
    const newMessages = messages.filter(m => !existingIds.has(m.id));
    
    const updatedCache = {
      ...cache,
      [userId]: {
        ...userCache,
        messages: [...userCache.messages, ...newMessages],
        lastUpdated: new Date()
      }
    };
    
    saveCache(updatedCache);
  }, [userId, cache, saveCache]);

  // Clear cache for user
  const clearUserCache = useCallback(() => {
    if (!userId) return;
    
    const updatedCache = { ...cache };
    delete updatedCache[userId];
    
    saveCache(updatedCache);
    localStorage.removeItem(CACHE_KEY);
  }, [userId, cache, saveCache]);

  // Mark messages as read
  const markAsRead = useCallback(() => {
    if (!userId) return;
    
    const userCache = cache[userId];
    if (!userCache) return;
    
    const updatedCache = {
      ...cache,
      [userId]: {
        ...userCache,
        unreadCount: 0
      }
    };
    
    saveCache(updatedCache);
  }, [userId, cache, saveCache]);

  // Get unread count
  const getUnreadCount = useCallback((): number => {
    if (!userId) return 0;
    
    return cache[userId]?.unreadCount || 0;
  }, [userId, cache]);

  // Sync with server
  const syncWithServer = useCallback(async (serverMessages: ChatMessage[]) => {
    if (!userId) return;
    
    const cachedMessages = getCachedMessages();
    
    // Find messages that exist locally but not on server
    const localOnly = cachedMessages.filter(local => 
      !serverMessages.some(server => server.id === local.id)
    );
    
    // Find messages that exist on server but not locally
    const serverOnly = serverMessages.filter(server => 
      !cachedMessages.some(local => local.id === server.id)
    );
    
    if (localOnly.length > 0 || serverOnly.length > 0) {
      logger.info(`Syncing ${localOnly.length} local and ${serverOnly.length} server messages`);
      
      // Merge all messages
      const allMessages = [...serverOnly, ...localOnly]
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      addToCache(allMessages);
    }
  }, [userId, getCachedMessages, addToCache]);

  return {
    isLoaded,
    getCachedMessages,
    addToCache,
    clearUserCache,
    markAsRead,
    getUnreadCount,
    syncWithServer
  };
};

export default useChatCache;
