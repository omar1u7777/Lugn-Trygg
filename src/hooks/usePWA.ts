/**
 * PWA Hook for Lugn & Trygg
 * React hook for PWA functionality and offline capabilities
 */

import { useState, useEffect } from 'react';
import { pwaService } from '../services/pwaService';
import { analytics } from '../services/analytics';

interface PWAState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  canShare: boolean;
  platform: string;
  updateAvailable: boolean;
  installSuccess: boolean;
}

interface PWAActions {
  installApp: () => Promise<boolean>;
  updateApp: () => Promise<void>;
  shareContent: (data: ShareData) => Promise<boolean>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  vibrate: (pattern: number | number[]) => Promise<void>;
  requestWakeLock: () => Promise<boolean>;
  releaseWakeLock: () => Promise<void>;
}

export const usePWA = (): PWAState & PWAActions => {
  const [state, setState] = useState<PWAState>({
    isOnline: pwaService.getNetworkStatus(),
    isInstallable: pwaService.isInstallable(),
    isInstalled: pwaService.isInstalled(),
    canShare: pwaService.canShare(),
    platform: pwaService.getPlatform(),
    updateAvailable: false,
    installSuccess: false,
  });

  useEffect(() => {
    // Listen for PWA events
    const handleInstallAvailable = () => {
      setState(prev => ({ ...prev, isInstallable: true }));
      analytics.track('PWA Install Available Event');
    };

    const handleInstallSuccess = () => {
      setState(prev => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        installSuccess: true
      }));
      analytics.track('PWA Install Success Event');
    };

    const handleUpdateAvailable = () => {
      setState(prev => ({ ...prev, updateAvailable: true }));
      analytics.track('PWA Update Available Event');
    };

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    // Add event listeners
    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-install-success', handleInstallSuccess);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-online', handleOnline);
    window.addEventListener('pwa-offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-install-success', handleInstallSuccess);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-online', handleOnline);
      window.removeEventListener('pwa-offline', handleOffline);
    };
  }, []);

  // Update canShare when state changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      canShare: pwaService.canShare()
    }));
  }, [state.isInstalled]);

  const actions: PWAActions = {
    installApp: async () => {
      const success = await pwaService.installApp();
      if (success) {
        setState(prev => ({
          ...prev,
          isInstalled: true,
          isInstallable: false,
          installSuccess: true
        }));
      }
      return success;
    },

    updateApp: async () => {
      await pwaService.updateApp();
      setState(prev => ({ ...prev, updateAvailable: false }));
    },

    shareContent: async (data: ShareData) => {
      return await pwaService.shareContent(data);
    },

    requestNotificationPermission: async () => {
      return await pwaService.requestNotificationPermission();
    },

    vibrate: async (pattern: number | number[]) => {
      await pwaService.vibrate(pattern);
    },

    requestWakeLock: async () => {
      return await pwaService.requestWakeLock();
    },

    releaseWakeLock: async () => {
      await pwaService.releaseWakeLock();
    },
  };

  return {
    ...state,
    ...actions,
  };
};

// Hook for offline data management
export const useOfflineStorage = (key: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [key]);

  const loadData = async () => {
    try {
      const storedData = await pwaService.getOfflineData(key);
      setData(storedData);
    } catch (error) {
      console.error('Failed to load offline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addData = async (newData: any) => {
    try {
      await pwaService.storeOfflineData(key, newData);
      await loadData(); // Refresh data
      analytics.track('Offline Data Stored', {
        key,
        dataType: typeof newData,
      });
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  };

  const clearData = async () => {
    try {
      await pwaService.clearOfflineData(key);
      setData([]);
      analytics.track('Offline Data Cleared', { key });
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  };

  return {
    data,
    loading,
    addData,
    clearData,
    refresh: loadData,
  };
};

// Hook for network status
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Hook for PWA install prompt
export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleInstallAvailable = (event: CustomEvent) => {
      setDeferredPrompt(event.detail.prompt);
      setShowPrompt(true);
    };

    const handleInstallSuccess = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable as EventListener);
    window.addEventListener('pwa-install-success', handleInstallSuccess);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable as EventListener);
      window.removeEventListener('pwa-install-success', handleInstallSuccess);
    };
  }, []);

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setShowPrompt(false);
      setDeferredPrompt(null);
      return outcome === 'accepted';
    }
    return false;
  };

  const dismiss = () => {
    setShowPrompt(false);
    analytics.track('PWA Install Prompt Dismissed');
  };

  return {
    showPrompt,
    install,
    dismiss,
  };
};