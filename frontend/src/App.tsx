import React from "react";
import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LoginForm from "./components/Auth/LoginForm";
import RegisterForm from "./components/Auth/RegisterForm";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import Dashboard from "./components/Dashboard/Dashboard";
import Navigation from "./components/Layout/Navigation";
import SubscriptionForm from "./components/SubscriptionForm";
import "./styles/styles.css";

function App() {
    const { t } = useTranslation();
    const [offlineMode, setOfflineMode] = useState<boolean>(!navigator.onLine);

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
            <div className="offline-screen">
                <h2>{t('common.offlineTitle')}</h2>
                <p>{t('common.offlineMessage')}</p>
                <button onClick={() => window.location.reload()} className="retry-button">
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return (
        <>
            {/* 📌 Navigation visas på alla sidor */}
            <Navigation />

            <main className="app-container">
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
                    <Route path="*" element={<h2 className="not-found">{t('common.pageNotFound')}</h2>} />
                </Routes>
            </main>
        </>
    );
}

export default App;
