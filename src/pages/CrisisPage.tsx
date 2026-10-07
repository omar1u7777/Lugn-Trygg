import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  HeartIcon,
  LifebuoyIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import {
  CRISIS_LINKS,
  CRISIS_NUMBERS,
  CRISIS_RESOURCES,
  CRISIS_RESOURCE_STYLES,
  CRISIS_TEL,
} from '../config/crisisResources';

/**
 * 🆘 Crisis Support Page - Professional Mental Health Resources
 *
 * Psychological principles:
 * - Immediate accessibility: All options visible at once
 * - Multiple channels: Phone, chat, web (works on desktop & mobile)
 * - Normalizing: "It's okay to ask for help"
 * - Clear hierarchy: Emergency → Crisis → Support
 *
 * Every string here used to be a hardcoded Swedish literal — this page had no
 * useTranslation at all, so it ignored the language the user had chosen for the
 * entire rest of the app. A non-Swedish speaker who had deliberately switched
 * locale reached the one page where clarity matters most and could not read it.
 *
 * The contact data comes from config/crisisResources, not from this file and
 * not from the translation files, so the numbers cannot drift per locale.
 */
const CrisisPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  /** Icon per resource. Structure, not data — stays with the presentation. */
  const iconFor = (id: string) => {
    switch (id) {
      case 'bris':
        return <ChatBubbleLeftRightIcon className="w-6 h-6" />;
      case 'priest':
      case 'companion':
        return <HeartIcon className="w-6 h-6" />;
      case 'spes':
        return <LifebuoyIcon className="w-6 h-6" />;
      default:
        return <PhoneIcon className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/*
        112 first, above everything, and sticky.
        Previously 112 appeared only inside the body text of the "Jourhavande
        Präst" card — a user had to scroll past an intro and several other cards
        to find the number for immediate danger to life.
      */}
      <div
        role="alert"
        className="sticky top-0 z-50 bg-red-600 text-white shadow-md"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span className="text-sm sm:text-base font-semibold">
            {t('crisis.page.emergencyBanner.text')}
          </span>
          <a
            href={CRISIS_TEL.emergency}
            className="inline-flex items-center gap-1.5 bg-white text-red-700 font-bold px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors min-h-[44px] sm:min-h-0 sm:py-1.5"
          >
            <PhoneIcon className="w-4 h-4" aria-hidden="true" />
            {t('crisis.page.emergencyBanner.call', { number: CRISIS_NUMBERS.emergency })}
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                // A user can land here directly (deep link, bookmark, a link
                // shared with someone in distress), in which case there is no
                // history entry to go back to and navigate(-1) leaves the
                // button doing nothing. Fall back to the dashboard.
                if (window.history.state?.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/dashboard');
                }
              }}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">{t('common.back')}</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('crisis.page.title')}
            </h1>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero Message */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full mb-4">
            <HeartIcon className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
            {t('crisis.page.heroTitle')}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            {t('crisis.page.heroBody')}
          </p>
        </div>

        {/* Crisis Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {CRISIS_RESOURCES.map((resource) => {
            const style = CRISIS_RESOURCE_STYLES[resource.id];
            const base = `crisis.page.resources.${resource.id}`;
            return (
              <div
                key={resource.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${style?.border ?? 'border-slate-300'} p-5 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${style?.button ?? 'bg-slate-600'} text-white shrink-0`}>
                    {iconFor(resource.id)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                      {resource.emoji} {t(`${base}.title`)}
                    </h3>
                    <p className={`text-sm ${style?.text ?? 'text-slate-600'} font-medium mb-1`}>
                      {t(`${base}.subtitle`)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      {t(`${base}.description`, { number: resource.phone ?? '' })}
                    </p>
                    {/*
                      The number in plain text as well as behind the button.
                      A user reading this on a desktop cannot tap tel:, and the
                      Mind card in particular used to show no number at all.
                    */}
                    {resource.phone && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                        <PhoneIcon className="w-4 h-4 inline-block mr-1 -mt-0.5" aria-hidden="true" />
                        {resource.phone}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        🕐 {t(`${base}.available`)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {resource.chat && (
                          <a
                            href={resource.chat}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg border-2 ${style?.border ?? 'border-slate-300'} ${style?.text ?? 'text-slate-700'} text-sm font-medium bg-white dark:bg-slate-800`}
                          >
                            <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />
                            {t(`${base}.chatAction`)}
                          </a>
                        )}
                        <a
                          href={resource.href}
                          {...(resource.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg text-white text-sm font-medium ${style?.button ?? 'bg-slate-600'} transition-colors`}
                        >
                          {resource.external ? (
                            <GlobeAltIcon className="w-4 h-4" />
                          ) : (
                            <PhoneIcon className="w-4 h-4" />
                          )}
                          {t(`${base}.action`, { number: resource.phone ?? '' })}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Resources */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4">
            {t('crisis.page.otherWays')}
          </h3>
          <div className="space-y-3">
            <a
              href="/ai-chat"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                {/* The app name is a proper noun and comes from app.name, which
                    is itself translated ("Calm & Safe" in en). */}
                <p className="font-medium text-slate-900 dark:text-white">
                  {t('crisis.page.aiChat.title', { app: t('app.name') })}
                </p>
                <p className="text-xs text-slate-500">{t('crisis.page.aiChat.subtitle')}</p>
              </div>
            </a>

            <a
              href={CRISIS_LINKS.healthcareWeb}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <GlobeAltIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">1177.se</p>
                <p className="text-xs text-slate-500">{t('crisis.page.healthcareWeb')}</p>
              </div>
            </a>
          </div>
        </div>

        {/* Supportive Message */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            {t('crisis.page.closing')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default CrisisPage;
