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
  const prevMessagesRef = useRef<PaginatedMessage[]>([]);

  // Initialize with latest messages, or append when a new message arrives.
  // Resetting to slice(-initialLoadCount) on every allMessages change would
  // discard any "load older" progress the instant a new message is sent or
  // received -- only reset on the initial load or when the array was
  // actually replaced/reordered (e.g. a server resync), not on a plain append.
  useEffect(() => {
    const prevMessages = prevMessagesRef.current;
    prevMessagesRef.current = allMessages;

    if (allMessages.length === 0) return;

    const isPureAppend =
      prevMessages.length > 0 &&
      allMessages.length > prevMessages.length &&
      allMessages[prevMessages.length - 1]?.id === prevMessages[prevMessages.length - 1]?.id;

    if (isPureAppend) {
      const newTail = allMessages.slice(prevMessages.length);
      setDisplayedMessages(prev => [...prev, ...newTail]);
      return;
    }

    // Initial load, or a resync that replaced/reordered messages.
    const latest = allMessages.slice(-initialLoadCount);
    setDisplayedMessages(latest);
    setHasMore(allMessages.length > initialLoadCount);
    setPage(0);
  }, [allMessages, initialLoadCount]);

  // Load more messages (older ones)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // The oldest index currently on screen is initialLoadCount + page*pageSize
      // back from the end -- the next page must start *before* that, not just
      // pageSize back from the end, or it overlaps the already-displayed window
      // (duplicate messages + duplicate React keys) whenever initialLoadCount > pageSize.
      const currentOldestIndex = Math.max(0, allMessages.length - initialLoadCount - page * pageSize);
      const startIndex = Math.max(0, currentOldestIndex - pageSize);

      if (currentOldestIndex > 0) {
        const olderMessages = allMessages.slice(startIndex, currentOldestIndex);

        // Prepend older messages
        setDisplayedMessages(prev => [...olderMessages, ...prev]);
        setPage(page + 1);

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
