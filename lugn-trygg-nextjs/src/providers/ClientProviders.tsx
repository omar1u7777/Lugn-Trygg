"use client";

import React, { ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import analytics from '../services/analytics';

interface Props { children: ReactNode }

export default function ClientProviders({ children }: Props) {
  useEffect(() => {
    // Initialize analytics on client
    try {
      analytics.initializeAnalytics();
    } catch (e) {
      // swallow init errors in client
      console.warn('Analytics init failed', e);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
