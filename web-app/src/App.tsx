import { Routes, Route } from "react-router-dom";
import { useEffect, useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import NavigationPro from "./components/Layout/NavigationPro";
import AppLayout from "./components/AppLayout";
import TestPage from "./components/TestPage";
import TestingStrategy from "./components/TestingStrategy";
import { usePageTracking } from "./hooks/useAnalytics";
import { LoadingSpinner } from "./components/LoadingStates";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/styles.css";
import "./styles/responsive.css"; // Enhanced responsive design system
import "./styles/design-system.css"; // Professional design system v2.0
import "./styles/animations.css"; // Professional animations & micro-interactions

// Lazy load route components for code splitting with error boundaries
const LoginForm = lazy(() => import(/* webpackChunkName: "auth" */ "./components/Auth/LoginForm"));
const RegisterForm = lazy(() => import(/* webpackChunkName: "auth" */ "./components/Auth/RegisterForm"));
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ "./components/Dashboard/Dashboard"));
const SubscriptionForm = lazy(() => import(/* webpackChunkName: "subscription" */ "./components/SubscriptionForm"));
const AIStories = lazy(() => import(/* webpackChunkName: "ai-stories" */ "./components/AIStories"));
const MoodAnalytics = lazy(() => import(/* webpackChunkName: "analytics" */ "./components/MoodAnalytics"));
const OAuthHealthIntegrations = lazy(() => import(/* webpackChunkName: "integrations" */ "./components/Integrations/OAuthHealthIntegrations"));
const ReferralProgram = lazy(() => import(/* webpackChunkName: "referral" */ "./components/Referral/ReferralProgram"));
const FeedbackForm = lazy(() => import(/* webpackChunkName: "feedback" */ "./components/Feedback/FeedbackForm"));

function App() {
    const { t } = useTranslation();
    const [offlineMode, setOfflineMode] = useState<boolean>(!navigator.onLine);

    // Auto track page views
    usePageTracking();

    // 🌐 Lyssna på ändringar i internetstatus
    useEffect(() => {
        const handleOfflineStatus = () => setOfflineMode(!navigator.onLine);

        // Kontrollera initial status
        setOfflineMode(!navigator.onLine);

        window.addEventListener("online", handleOfflineStatus);
        window.addEventListener("offline", handleOfflineStatus);

        return () => {
            window.removeEventListener("online", handleOfflineStatus);
            window.removeEventListener("offline", handleOfflineStatus);
        };
    }, []);

    // 🚫 Offline-läge - Visa ett meddelande och en återanslutningsknapp
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

    return (
        <AppLayout>
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                {/* 📌 Navigation visas på alla sidor */}
                <NavigationPro />

                <main className="pt-20 pb-8 px-4 sm:px-6 lg:px-8">
                <div className="container-custom">
                    <ErrorBoundary>
                        <Suspense fallback={
                          <div className="min-h-[60vh] flex items-center justify-center">
                            <LoadingSpinner isLoading={true} message="Laddar sida..." />
                          </div>
                        }>
                            <Routes>
                                <Route path="/" element={<LoginForm />} />
                                <Route path="/login" element={<LoginForm />} />
                                <Route path="/register" element={<RegisterForm />} />
                                <Route
                                    path="/dashboard"
                                    element={
                                        <ProtectedRoute>
                                            <Dashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/subscribe"
                                    element={
                                        <ProtectedRoute>
                                            <SubscriptionForm />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/ai-stories"
                                    element={
                                        <ProtectedRoute>
                                            <AIStories />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/analytics"
                                    element={
                                        <ProtectedRoute>
                                            <MoodAnalytics />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/integrations"
                                    element={
                                        <ProtectedRoute>
                                            <OAuthHealthIntegrations />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/referral"
                                    element={
                                        <ProtectedRoute>
                                            <ReferralProgram />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/feedback"
                                    element={
                                        <ProtectedRoute>
                                            <FeedbackForm />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/test"
                                    element={<TestPage />}
                                />
                                <Route
                                    path="/testing-strategy"
                                    element={<TestingStrategy />}
                                />
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
                </div>
            </main>
            </div>
        </AppLayout>
    );
}

export default App;
