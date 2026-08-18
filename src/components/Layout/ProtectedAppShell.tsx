import React, { Suspense } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AppLayout from '../AppLayout';
import { LoadingSpinner } from '../LoadingStates';
import { useTranslation } from 'react-i18next';
import WorldClassDashboardSkeleton from '../WorldClassDashboardSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../config/appRoutes';

// CSS imports moved to src/main.tsx so they load on ALL pages (including
// auth pages like login / register).  Keeping them here caused the login
// page to render completely unstyled because ProtectedAppShell is lazy-loaded.
import { logger } from '../../utils/logger';


const ProtectedAppShell: React.FC = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { isLoggedIn, isInitialized } = useAuth();
  const isDashboardRoute = location.pathname === '/dashboard';
  const isContentHeavyRoute = location.pathname.startsWith('/recommendations') || location.pathname.startsWith('/wellness');
  // Unknown paths fall through to the 404 route and are treated as protected,
  // so a typo cannot expose anything.
  const isPublicRoute = ROUTES.some(
    (route) => route.path === location.pathname && route.protected === false
  );

  // Show loading state while authentication is being checked
  if (!isInitialized) {
    if (isDashboardRoute) {
      return <WorldClassDashboardSkeleton />;
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#fff7f0] to-[#fffaf5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Laddar...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated — UNLESS the route says it is public.
  //
  // This shell wraps every app route, so it used to redirect regardless of what
  // the route itself declared. `protected: false` in appRoutes only reached
  // renderRouteElement, one level further in, which meant a route could be
  // marked public and still demand a login. /crisis was exactly that: the flag
  // was flipped, the fix shipped, and production still answered a person in
  // acute crisis with a login form instead of 112.
  //
  // A flag that does not do what it says is worse than no flag, because the
  // next person will trust it too. The shell reads it now.
  if (!isLoggedIn && !isPublicRoute) {
    logger.debug('🔒 ProtectedAppShell: Not logged in, redirecting to login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const suspenseFallback = isDashboardRoute ? (
    <WorldClassDashboardSkeleton />
  ) : (
    <LoadingSpinner isLoading message="Laddar sidan..." />
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#fff7f0] to-[#fffaf5] dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Top Navigation */}
        <Navigation />

        {/* Sidebar - Desktop only */}
        <Sidebar />

        {/* Main Content Area - adjusted for sidebar on desktop */}
        <main
          id="main-content"
          tabIndex={-1}
          className="pt-20 pb-24 lg:pb-8 lg:ml-64 px-4 sm:px-6 lg:px-8 focus:outline-none"
          dir={i18n.dir()}
        >
          <div className={`${isContentHeavyRoute ? 'max-w-7xl' : 'max-w-6xl'} mx-auto`}>
            <Suspense fallback={suspenseFallback}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* Bottom Navigation - Mobile only */}
        <BottomNav />
      </div>
    </AppLayout>
  );
};

export default ProtectedAppShell;
