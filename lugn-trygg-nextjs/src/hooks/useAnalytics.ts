import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView, trackFeatureUsage } from '../services/analytics';

export const usePageTracking = () => {
  const pathname = usePathname();

  useEffect(() => {
    const pageName = pathname?.split('/').filter(Boolean)[0] || 'dashboard';
    trackPageView(pageName);
    console.log(`📊 Tracking page view: ${pageName}`);
  }, [pathname]);
};

export const useFeatureTracking = (featureName: string, action: string) => {
  useEffect(() => {
    trackFeatureUsage(featureName, action);
    console.log(`📊 Tracking feature: ${featureName} - ${action}`);
  }, [featureName, action]);
};

export default usePageTracking;
