import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, trackFeatureUsage } from '../services/analytics';import { logger } from '../utils/logger';


/**
 * Hook for automatic page view tracking
 * Tracks navigation changes automatically
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Extract page name from path
    const pageName = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
    
    trackPageView(pageName);
    
    logger.debug(`📊 Tracking page view: ${pageName}`);
  }, [location.pathname]);
};

/**
 * Hook for tracking feature usage
 */
export const useFeatureTracking = (featureName: string, action: string) => {
  useEffect(() => {
    trackFeatureUsage(featureName, action);
    logger.debug(`📊 Tracking feature: ${featureName} - ${action}`);
  }, [featureName, action]);
};

export default usePageTracking;
