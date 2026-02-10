import React, { Suspense } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AppLayout from '../AppLayout';
import { LoadingSpinner } from '../LoadingStates';
import { useTranslation } from 'react-i18next';
import WorldClassDashboardSkeleton from '../WorldClassDashboardSkeleton';
import { SkipLink } from '../Accessibility/SkipLink';
import { useAuth } from '../../contexts/AuthContext';

// CSS imports moved to src/main.tsx so they load on ALL pages (including
// auth pages like login / register).  Keeping them here caused the login
// page to render completely unstyled because ProtectedAppShell is lazy-loaded.
import { logger } from '../../utils/logger';


const ProtectedAppShell: React.FC = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { isLoggedIn, isInitialized } = useAuth();
  const isDashboardRoute = location.pathname === '/dashboard';

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

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
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
        {/* Skip Link for keyboard navigation */}
        <SkipLink targetId="main-content" />

        {/* Top Navigation */}
        <Navigation />

        {/* Sidebar - Desktop only */}
        <Sidebar />

        {/* Main Content Area - adjusted for sidebar on desktop */}
        <main
          id="main-content"
          tabIndex={-1}
          className="pt-20 pb-24 lg:pb-8 lg:ml-64 px-4 sm:px-6 lg:px-8 min-h-screen focus:outline-none"
          dir={i18n.dir()}
        >
          <div className="max-w-6xl mx-auto">
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
