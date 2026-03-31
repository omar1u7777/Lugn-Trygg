import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

interface FailedRequest {
  id: string;
  timestamp: Date;
  error: Error;
  retryCount: number;
  retry: () => Promise<any>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000
};

export const useErrorRecovery = (config: Partial<RetryConfig> = {}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [failedRequests, setFailedRequests] = useState<FailedRequest[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('Network connection restored');
      // Trigger retry of failed requests
      retryFailedRequests();
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add failed request to queue
  const addFailedRequest = useCallback((
    id: string,
    error: Error,
    retryFunction: () => Promise<any>,
    retryCount: number = 0
  ) => {
    const failedRequest: FailedRequest = {
      id,
      timestamp: new Date(),
      error,
      retryCount,
      retry: retryFunction
    };

    setFailedRequests(prev => {
      // Remove any existing request with same ID
      const filtered = prev.filter(req => req.id !== id);
      return [...filtered, failedRequest];
    });

    logger.warn(`Request failed: ${id}`, error);
  }, []);

  // Retry a specific request
  const retryRequest = useCallback(async (request: FailedRequest) => {
    const { id, retryCount, retry } = request;

    // Check if we've exceeded max retries
    if (retryCount >= retryConfig.maxRetries) {
      logger.error(`Max retries exceeded for request: ${id}`);
      setFailedRequests(prev => prev.filter(req => req.id !== id));
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, retryCount),
      retryConfig.maxDelay
    );

    logger.info(`Retrying request: ${id} (attempt ${retryCount + 1}/${retryConfig.maxRetries})`);

    // Schedule retry
    const timeoutId = setTimeout(async () => {
      try {
        await retry();
        // Success - remove from failed requests
        setFailedRequests(prev => prev.filter(req => req.id !== id));
        logger.info(`Request retry successful: ${id}`);
      } catch (error) {
        // Failed again - increment retry count
        addFailedRequest(id, error instanceof Error ? error : new Error('Retry failed'), retry, retryCount + 1);
      }
    }, delay);

    retryTimeouts.current.set(id, timeoutId);
  }, [retryConfig, addFailedRequest]);

  // Retry all failed requests
  const retryFailedRequests = useCallback(async () => {
    if (failedRequests.length === 0) return;

    setIsRecovering(true);
    logger.info(`Attempting to recover ${failedRequests.length} failed requests`);

    // Retry all requests in parallel with a small delay between each
    const retryPromises = failedRequests.map((request, index) => 
      new Promise(resolve => {
        setTimeout(() => {
          retryRequest(request);
          resolve(null);
        }, index * 100); // 100ms delay between each retry
      })
    );

    await Promise.all(retryPromises);
    setIsRecovering(false);
  }, [failedRequests, retryRequest]);

  // Execute with error recovery
  const executeWithRecovery = useCallback(async <T>(
    id: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    try {
      // Cancel any existing retry for this request
      const existingTimeout = retryTimeouts.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        retryTimeouts.current.delete(id);
      }

      // Remove from failed requests if it was there
      setFailedRequests(prev => prev.filter(req => req.id !== id));

      // Execute the operation
      const result = await operation();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Operation failed');
      
      // Add to failed requests queue
      addFailedRequest(id, err, () => operation());
      
      // Re-throw the error
      throw err;
    }
  }, [addFailedRequest]);

  // Clear all failed requests
  const clearFailedRequests = useCallback(() => {
    // Clear all timeouts
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();
    
    setFailedRequests([]);
    logger.info('Cleared all failed requests');
  }, []);

  // Get failed requests count
  const getFailedRequestsCount = useCallback(() => {
    return failedRequests.length;
  }, [failedRequests]);

  // Get network status
  const getNetworkStatus = useCallback(() => {
    return {
      isOnline,
      isRecovering,
      failedRequestsCount: failedRequests.length
    };
  }, [isOnline, isRecovering, failedRequests]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    isOnline,
    isRecovering,
    failedRequests,
    executeWithRecovery,
    retryFailedRequests,
    clearFailedRequests,
    getFailedRequestsCount,
    getNetworkStatus
  };
};

export default useErrorRecovery;
