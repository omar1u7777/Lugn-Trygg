import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import WorldClassDashboardSkeleton from "../WorldClassDashboardSkeleton";import { logger } from '../../utils/logger';


interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isLoggedIn, isInitialized, user } = useAuth();
  const location = useLocation();
  const shouldShowDashboardSkeleton = location.pathname === '/dashboard';

  // Show loading spinner while checking authentication
  if (!isInitialized) {
    if (shouldShowDashboardSkeleton) {
      return <WorldClassDashboardSkeleton />;
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Laddar...</p>
        </div>
      </div>
    );
  }

  const loggedIn = isLoggedIn;
  logger.debug('🛡️ ProtectedRoute check:', { loggedIn, isInitialized, requireAdmin, userRole: user?.role });

  // Not logged in at all
  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not admin when admin required
  if (requireAdmin && user?.role !== 'admin') {
    logger.warn('⚠️ Admin access denied for user:', user?.email);
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Ingen åtkomst
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Den här sidan är endast tillgänglig för administratörer.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Gå tillbaka
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
