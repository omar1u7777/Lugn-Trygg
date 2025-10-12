'use client';

import { useEffect, useState } from 'react';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import ErrorBoundary from '../src/components/ErrorBoundary';
import Navigation from '../src/components/Layout/Navigation';
import i18n from '../src/i18n/i18n';
import '../src/styles/styles.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [offlineMode, setOfflineMode] = useState<boolean>(!navigator.onLine);

  // 🌐 Lyssna på ändringar i internetstatus
  useEffect(() => {
    const handleOfflineStatus = () => setOfflineMode(!navigator.onLine);

    // Kontrollera initial status
    setOfflineMode(!navigator.onLine);

    window.addEventListener('online', handleOfflineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('online', handleOfflineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, []);

  // 🚫 Offline-läge - Visa ett meddelande och en återanslutningsknapp
  if (offlineMode) {
    return (
      <html lang="en">
        <body>
          <div className="offline-screen">
            <h2>{t('common.offlineTitle')}</h2>
            <p>{t('common.offlineMessage')}</p>
            <button onClick={() => window.location.reload()} className="retry-button">
              {t('common.retry')}
            </button>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <I18nextProvider i18n={i18n}>
            <ThemeProvider>
              <AuthProvider>
                <Navigation />
                <main className="app-container">
                  {children}
                </main>
              </AuthProvider>
            </ThemeProvider>
          </I18nextProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}