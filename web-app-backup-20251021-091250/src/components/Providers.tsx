'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>
          {children}
        </I18nextProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
