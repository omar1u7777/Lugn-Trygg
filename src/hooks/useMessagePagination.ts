import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

interface PaginatedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sentiment?: string;
  emotions?: string[];
}

interface UseMessagePaginationOptions {
  pageSize?: number;
  initialLoadCount?: number;
}

export const useMessagePagination = (
  allMessages: PaginatedMessage[],
  options: UseMessagePaginationOptions = {}
) => {
  const {
    pageSize = 20,
    initialLoadCount = 50
  } = options;

  const [displayedMessages, setDisplayedMessages] = useState<PaginatedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Initialize with latest messages
  useEffect(() => {
    if (allMessages.length > 0) {
      // Show the latest messages first
      const latest = allMessages.slice(-initialLoadCount);
      setDisplayedMessages(latest);
      setHasMore(allMessages.length > initialLoadCount);
      setPage(0);
    }
  }, [allMessages, initialLoadCount]);

  // Load more messages (older ones)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const nextPage = page + 1;
      const startIndex = Math.max(0, allMessages.length - (nextPage * pageSize) - initialLoadCount);
      const endIndex = allMessages.length - (nextPage * pageSize);
      
      if (startIndex >= 0) {
        const olderMessages = allMessages.slice(startIndex, endIndex);
        
        // Prepend older messages
        setDisplayedMessages(prev => [...olderMessages, ...prev]);
        setPage(nextPage);
        
        // Check if there are more messages
        setHasMore(startIndex > 0);
        
        logger.info(`Loaded ${olderMessages.length} older messages`);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      logger.error('Failed to load more messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [allMessages, page, pageSize, initialLoadCount, isLoading, hasMore]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target?.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px' // Start loading 100px before visible
      }
    );

    const loadingElement = loadingRef.current;

    if (loadingElement) {
      observer.observe(loadingElement);
    }

    return () => {
      if (loadingElement) {
        observer.unobserve(loadingElement);
      }
    };
  }, [loadMore, hasMore, isLoading]);

  return {
    displayedMessages,
    isLoading,
    hasMore,
    loadMore,
    loadingRef,
  };
};

export default useMessagePagination;
