/**
 * PWA Service for Lugn & Trygg
 * Handles service worker registration, offline functionality, and app installation
 */

import { analytics } from './analytics';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isOnline: boolean = navigator.onLine;
  private installPromptShown: boolean = false;

  constructor() {
    this.initializePWA();
    this.setupNetworkListeners();
  }

  private initializePWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);

            // Handle updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.showUpdateNotification();
                  }
                });
              }
            });

            analytics.track('PWA Service Worker Registered', {
              scope: registration.scope,
            });
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
            analytics.track('PWA Service Worker Registration Failed', {
              error: registrationError.message,
            });
          });
      });
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;

      // Show install button if not already shown
      if (!this.installPromptShown) {
        this.showInstallPrompt();
      }

      analytics.track('PWA Install Prompt Available', {
        platforms: e.platforms,
      });
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.installPromptShown = false;

      analytics.track('PWA App Installed', {
        platform: 'pwa',
      });

      // Show success message
      this.showInstallSuccess();
    });

    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      analytics.track('PWA App Running in Standalone Mode');
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnline();
      analytics.track('Network Status Changed', { status: 'online' });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOffline();
      analytics.track('Network Status Changed', { status: 'offline' });
    });
  }

  private showInstallPrompt() {
    // Dispatch custom event for UI components to show install button
    const event = new CustomEvent('pwa-install-available', {
      detail: { prompt: this.deferredPrompt }
    });
    window.dispatchEvent(event);
    this.installPromptShown = true;
  }

  private showInstallSuccess() {
    const event = new CustomEvent('pwa-install-success');
    window.dispatchEvent(event);
  }

  private showUpdateNotification() {
    const event = new CustomEvent('pwa-update-available');
    window.dispatchEvent(event);
  }

  private handleOnline() {
    const event = new CustomEvent('pwa-online');
    window.dispatchEvent(event);

    // Sync any pending offline data
    this.syncOfflineData();
  }

  private handleOffline() {
    const event = new CustomEvent('pwa-offline');
    window.dispatchEvent(event);
  }

  private async syncOfflineData() {
    try {
      // Register background sync if supported
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('mood-sync');
        await registration.sync.register('chat-sync');
      }
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  // Public API methods
  public async installApp(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      analytics.track('PWA Install Prompt Result', {
        outcome,
        platform: this.deferredPrompt.platforms[0] || 'unknown',
      });

      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      analytics.track('PWA Install Prompt Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public isInstallable(): boolean {
    return this.deferredPrompt !== null;
  }

  public isInstalled(): boolean {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  public async updateApp(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();

      analytics.track('PWA Manual Update Triggered');
    }
  }

  public async shareContent(data: ShareData): Promise<boolean> {
    if (navigator.share && this.isInstalled()) {
      try {
        await navigator.share(data);
        analytics.track('PWA Content Shared', {
          hasText: !!data.text,
          hasUrl: !!data.url,
          hasFiles: !!(data.files && data.files.length > 0),
        });
        return true;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
          analytics.track('PWA Share Failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        return false;
      }
    }
    return false;
  }

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      analytics.track('PWA Notification Permission', {
        permission,
      });
      return permission;
    }
    return 'denied';
  }

  public canShare(data?: ShareData): boolean {
    return !!(navigator.share && this.isInstalled() && navigator.canShare && navigator.canShare(data));
  }

  public getPlatform(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Android')) return 'android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
    if (ua.includes('Windows')) return 'windows';
    if (ua.includes('Mac')) return 'macos';
    if (ua.includes('Linux')) return 'linux';
    return 'unknown';
  }

  public async vibrate(pattern: number | number[]): Promise<void> {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
      analytics.track('PWA Vibration Triggered', {
        pattern: Array.isArray(pattern) ? pattern.join(',') : pattern.toString(),
      });
    }
  }

  // Storage helpers for offline functionality
  public async storeOfflineData(key: string, data: any): Promise<void> {
    try {
      const offlineData = await this.getOfflineData(key) || [];
      offlineData.push({
        ...data,
        timestamp: Date.now(),
        id: crypto.randomUUID(),
      });

      localStorage.setItem(`lugn-trygg-offline-${key}`, JSON.stringify(offlineData));
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  public async getOfflineData(key: string): Promise<any[]> {
    try {
      const data = localStorage.getItem(`lugn-trygg-offline-${key}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return [];
    }
  }

  public async clearOfflineData(key: string): Promise<void> {
    try {
      localStorage.removeItem(`lugn-trygg-offline-${key}`);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  // Wake lock for preventing screen from turning off during meditation
  private wakeLock: WakeLockSentinel | null = null;

  public async requestWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          console.log('Wake lock released');
          this.wakeLock = null;
        });

        analytics.track('PWA Wake Lock Acquired');
        return true;
      } catch (error) {
        console.error('Wake lock request failed:', error);
        analytics.track('PWA Wake Lock Failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    }
    return false;
  }

  public async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      analytics.track('PWA Wake Lock Released');
    }
  }
}

// Create singleton instance
export const pwaService = new PWAService();

// Export types
export type { BeforeInstallPromptEvent };