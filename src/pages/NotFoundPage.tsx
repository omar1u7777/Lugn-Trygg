import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, HomeIcon } from '@heroicons/react/24/outline';

/**
 * Shown for any unknown route.
 *
 * The old page offered a single "Gå tillbaka" button wired to
 * window.history.back(), which does nothing — or leaves the site — when the
 * person arrived on the bad URL directly (UI audit N-5). "Back" now only
 * appears when there is somewhere in the app to go back to, and "Home"
 * always does.
 */
const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // React Router records its position in history.state.idx; 0 means this is
  // the first entry of the session, so there is no in-app page to return to.
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  const canGoBack = historyIndex > 0;

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl mb-6" aria-hidden="true">🔍</div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-8">
          {t('common.pageNotFound')}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {canGoBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-secondary inline-flex items-center gap-2 px-6 py-3 min-h-[44px]"
            >
              <ArrowLeftIcon className="w-5 h-5" aria-hidden="true" />
              {t('common.back')}
            </button>
          )}
          <Link
            to="/"
            className="btn btn-primary inline-flex items-center gap-2 px-6 py-3 min-h-[44px]"
          >
            <HomeIcon className="w-5 h-5" aria-hidden="true" />
            {t('bottomNav.home')}
          </Link>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
