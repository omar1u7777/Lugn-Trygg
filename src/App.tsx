import { Routes, Route } from "react-router-dom";
import { useEffect, useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import { usePageTracking } from "./hooks/useAnalytics";
import { LoadingSpinner } from "./components/LoadingStates";
import ErrorBoundary from "./components/ErrorBoundary";
import { PremiumGate } from "./components/PremiumGate";
import { ROUTES, type RouteDefinition } from "./config/appRoutes";
import AuthEntryLayout from "./components/Layout/AuthEntryLayout";

const ProtectedAppShell = lazy(() => import("./components/Layout/ProtectedAppShell"));

const AUTH_ROUTE_PATHS = new Set(["/", "/login", "/register"]);

const renderRouteElement = (route: RouteDefinition) => {
    let element = <route.component />;

    if (route.feature) {
        element = (
            <PremiumGate feature={route.feature} title={route.featureTitle}>
                {element}
            </PremiumGate>
        );
    }

    if (route.protected || route.requireAdmin) {
        element = (
            <ProtectedRoute requireAdmin={route.requireAdmin}>
                {element}
            </ProtectedRoute>
        );
    }

    return element;
};

function App() {
    const { t, i18n } = useTranslation();
    const [offlineMode, setOfflineMode] = useState<boolean>(!navigator.onLine);

    usePageTracking();

    useEffect(() => {
        const dir = i18n.dir();
        if (typeof document !== 'undefined') {
            document.documentElement.dir = dir;
            document.body.dir = dir;
            document.documentElement.lang = i18n.language;
        }
    }, [i18n.language, i18n]);

    useEffect(() => {
        const handleOfflineStatus = () => setOfflineMode(!navigator.onLine);

        setOfflineMode(!navigator.onLine);

        window.addEventListener("online", handleOfflineStatus);
        window.addEventListener("offline", handleOfflineStatus);

        return () => {
            window.removeEventListener("online", handleOfflineStatus);
            window.removeEventListener("offline", handleOfflineStatus);
        };
    }, []);

    if (offlineMode) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 px-4">
                <div className="text-center max-w-md mx-auto">
                    <div className="text-6xl mb-6">📡</div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                        {t('common.offlineTitle')}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                        {t('common.offlineMessage')}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primary px-8 py-3 text-lg font-semibold"
                    >
                        <span className="mr-2">🔄</span>
                        {t('common.retry')}
                    </button>
                </div>
            </div>
        );
    }

    const authRoutes = ROUTES.filter(route => AUTH_ROUTE_PATHS.has(route.path));
    const appRoutes = ROUTES.filter(route => !AUTH_ROUTE_PATHS.has(route.path));

    return (
        <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner isLoading={false} />}>
                <Routes>
                    <Route element={<AuthEntryLayout />}>
                        {authRoutes.map((route) => (
                            <Route
                                key={route.path}
                                path={route.path}
                                element={<route.component />}
                            />
                        ))}
                    </Route>

                    <Route element={<ProtectedAppShell />}>
                        {appRoutes.map((route) => (
                            <Route
                                key={route.path}
                                path={route.path}
                                element={renderRouteElement(route)}
                            />
                        ))}
                    </Route>

                    <Route
                        path="*"
                        element={
                            <div className="min-h-[60vh] flex items-center justify-center">
                                <div className="text-center">
                                    <div className="text-8xl mb-6">🔍</div>
                                    <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                                        {t('common.pageNotFound')}
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 text-lg mb-8">
                                        Sidan du letar efter finns inte.
                                    </p>
                                    <button
                                        onClick={() => window.history.back()}
                                        className="btn btn-primary px-6 py-3"
                                    >
                                        <span className="mr-2">⬅️</span>
                                        Gå tillbaka
                                    </button>
                                </div>
                            </div>
                        }
                    />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
}

export default App;
