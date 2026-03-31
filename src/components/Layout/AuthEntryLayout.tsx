
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Container } from '../ui/tailwind/Layout';
import Navigation from './Navigation';
import { useTranslation } from 'react-i18next';

const AuthEntryLayout: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div 
      className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.16),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),_transparent_50%),linear-gradient(135deg,#f8fafc_0%,#f0f9ff_45%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(74,222,128,0.10),_transparent_52%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#020617_100%)] flex flex-col"
      role="main"
      aria-label={t('authLayout.pageLabel')}
    >
      {/* Navigation */}
      <Navigation />
      
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8 pt-24">
      {/* Skip to content link for accessibility */}
      <a
        href="#login-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        {t('authLayout.skipToForm')}
      </a>
      <Container maxWidth="xl" centered>
        <main 
          id="main-content"
          className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-7 items-start lg:items-center"
        >
          {/* Compact Intro (Mobile/Tablet) */}
          <section 
            className="lg:hidden order-1 rounded-2xl bg-white/85 dark:bg-slate-900/75 backdrop-blur-xl border border-white/50 dark:border-slate-700/70 shadow-[0_16px_45px_-26px_rgba(15,23,42,0.45)] p-4 sm:p-5"
            aria-label={t('authLayout.introLabel')}
          >
            <p className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-700 dark:text-primary-200 bg-primary-100/90 dark:bg-primary-900/40 mb-2">
              {t('app.name')}
            </p>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {t('authLayout.tagline')}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-700 dark:text-slate-300">
              {t('authLayout.loginCta')}
            </p>
          </section>

          {/* Info/Branding Section */}
          <section 
            className="hidden lg:flex order-1 flex-col justify-between h-full rounded-3xl bg-white/85 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/50 dark:border-slate-800 shadow-[0_20px_60px_-20px_rgba(2,132,199,0.25)] dark:shadow-[0_24px_80px_-30px_rgba(15,23,42,0.65)] p-5 md:p-8 transition-all"
            aria-label={t('authLayout.infoLabel')}
          >
            <header>
              <p className="inline-flex items-center rounded-full px-3 py-1 text-xs md:text-sm uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200 bg-primary-100/90 dark:bg-primary-900/40 mb-3 md:mb-4">
                {t('app.name')}
              </p>
              <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
                {t('authLayout.tagline')}
              </h1>
              <p className="mt-3 md:mt-4 text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                {t('authLayout.description')}
              </p>
            </header>
            <ul 
              className="space-y-3 md:space-y-4 text-slate-700 dark:text-slate-200 mt-6 md:mt-10"
              aria-label={t('authLayout.featuresLabel')}
            >
              <li className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl" aria-hidden="true">🛡️</span>
                <p className="text-sm md:text-base">{t('authLayout.feature1')}</p>
              </li>
              <li className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl" aria-hidden="true">📈</span>
                <p className="text-sm md:text-base">{t('authLayout.feature2')}</p>
              </li>
              <li className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl" aria-hidden="true">🤖</span>
                <p className="text-sm md:text-base">{t('authLayout.feature3')}</p>
              </li>
            </ul>
          </section>
          {/* Login Form Section */}
          <section 
            id="login-form"
            className="order-2 w-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-[0_22px_65px_-28px_rgba(15,23,42,0.45)] border border-slate-200/80 dark:border-slate-700/70 p-4 sm:p-6 md:p-8 transition-all"
            aria-label={t('authLayout.formLabel')}
          >
            <Outlet />
          </section>
        </main>
      </Container>
      </div>
    </div>
  );
};

export default AuthEntryLayout;
