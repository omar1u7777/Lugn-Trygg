import React, { useState, useEffect } from 'react'
import { usePWA } from '../hooks/usePWA';
import { analytics } from '../services/analytics';
import { 
  StarIcon, 
  XMarkIcon, 
  ArrowDownTrayIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  DeviceTabletIcon
} from '@heroicons/react/24/outline';

const PWAInstallPrompt: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    installSuccess,
    platform,
    installApp,
    updateAvailable,
    updateApp,
  } = usePWA();

  const [dismissed, setDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    const dismissedPrompt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedPrompt) {
      const dismissedTime = parseInt(dismissedPrompt);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (installSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [installSuccess]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      analytics.track('PWA Install Button Clicked', { platform });
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    analytics.track('PWA Install Prompt Dismissed', { platform });
  };

  const handleUpdate = async () => {
    await updateApp();
    analytics.track('PWA Update Button Clicked', { platform });
  };

  // Don't show if already installed, dismissed, or not installable
  if (isInstalled || dismissed || !isInstallable) {
    return null;
  }

  const getPlatformIcon = () => {
    switch (platform) {
      case 'ios':
      case 'android':
        return <DevicePhoneMobileIcon className="w-5 h-5" />;
      case 'windows':
      case 'macos':
        return <ComputerDesktopIcon className="w-5 h-5" />;
      default:
        return <DeviceTabletIcon className="w-5 h-5" />;
    }
  };

  const getPlatformName = () => {
    switch (platform) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      case 'windows':
        return 'Windows';
      case 'macos':
        return 'macOS';
      default:
        return 'Din enhet';
    }
  };

  return (
    <>
      {/* Install Prompt */}
      <div
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-lg"
        role="dialog"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-description"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
              <ArrowDownTrayIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="pwa-install-title" className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Installera Lugn & Trygg
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {getPlatformIcon()}
                <span>För {getPlatformName()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Stäng installationsprompt"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <p id="pwa-install-description" className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Installera appen för snabb åtkomst, offline-funktionalitet och push-notiser.
          Fungerar även utan internetanslutning!
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full border border-primary-200 dark:border-primary-800">
            <StarIcon className="w-4 h-4" aria-hidden="true" />
            Offline-först
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 text-xs font-medium rounded-full border border-secondary-200 dark:border-secondary-800">
            <DevicePhoneMobileIcon className="w-4 h-4" aria-hidden="true" />
            Snabb åtkomst
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 text-xs font-medium rounded-full border border-success-200 dark:border-success-800">
            <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
            Push-notiser
          </span>
        </div>

        <button
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
        >
          <ArrowDownTrayIcon className="w-5 h-5" aria-hidden="true" />
          Installera nu
        </button>
      </div>

      {/* Update Prompt */}
      {updateAvailable && (
        <div
          className="bg-white dark:bg-gray-800 rounded-lg border border-warning-200 dark:border-warning-800 p-4 sm:p-6 shadow-lg"
          role="dialog"
          aria-labelledby="pwa-update-title"
        >
          <h2 id="pwa-update-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Uppdatering tillgänglig! 🚀
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            En ny version av Lugn & Trygg är tillgänglig med förbättringar och nya funktioner.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleUpdate}
              className="flex-1 px-6 py-2 bg-warning-600 hover:bg-warning-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500 min-h-[44px]"
            >
              Uppdatera nu
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 px-6 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
            >
              Senare
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccess && (
        <div
          className="fixed top-4 right-4 z-50 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg shadow-lg p-4 max-w-md"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎉</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-success-900 dark:text-success-100">
                Lugn & Trygg har installerats framgångsrikt!
              </p>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="p-1 hover:bg-success-100 dark:hover:bg-success-900/40 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-success-500"
              aria-label="Stäng meddelande"
            >
              <XMarkIcon className="w-5 h-5 text-success-700 dark:text-success-300" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;


