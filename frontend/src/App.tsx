import { Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginForm from "./components/Auth/LoginForm";
import RegisterForm from "./components/Auth/RegisterForm";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import Dashboard from "./components/Dashboard/Dashboard";
import { useAuth } from "./contexts/AuthContext";
import Navigation from "./components/Layout/Navigation"; 
import "./styles/styles.css";

function App() {
    const { isLoggedIn, logout, user } = useAuth(); //  Hämtar autentiseringsfunktioner och användardata
    const navigate = useNavigate(); //  Navigeringsfunktion för att omdirigera användare
    const [offlineMode, setOfflineMode] = useState<boolean>(!navigator.onLine); // 🌐 Kontroll av internetstatus

    //  Kontrollera om användaren är offline och uppdatera state
    useEffect(() => {
        const handleOfflineStatus = () => setOfflineMode(!navigator.onLine);

        window.addEventListener("online", handleOfflineStatus);
        window.addEventListener("offline", handleOfflineStatus);
        
        return () => {
            window.removeEventListener("online", handleOfflineStatus);
            window.removeEventListener("offline", handleOfflineStatus);
        };
    }, []); // Körs endast vid första renderingen

    //  Hantera utloggning av användare
    const handleLogout = async () => {
        if (user) {
            await logout(); //  Logga ut användaren och rensa autentisering
            navigate("/login"); //  Omdirigera till inloggningssidan
        }
    };

    //  Om användaren är offline, visa en offline-meddelande
    if (offlineMode) {
        return (
            <div className="offline-screen">
                <h2>🚫 Du är offline!</h2>
                <p>Kontrollera din internetanslutning och försök igen.</p>
                <button onClick={() => window.location.reload()} style={{
                    backgroundColor: "#ff9800",
                    color: "#fff",
                    fontSize: "1.1rem",
                    padding: "0.75rem",
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    marginTop: "1rem"
                }}>🔄 Försök igen</button>
            </div>
        );
    }

    return (
        <>
            {/* 📌 Navigation visas på alla sidor */}
            <Navigation /> 
            <main className="app-container">
                <Routes>
                    {/* 🏠 Huvudvägar i applikationen */}
                    <Route path="/" element={<LoginForm />} />
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/register" element={<RegisterForm />} />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute> {/* 🔒 Endast inloggade användare får se Dashboard */}
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    {/* 🚫 404-felsida för okända rutter */}
                    <Route path="*" element={<h2 className="not-found">🚫 Sidan hittades inte!</h2>} />
                </Routes>

                {/* 🔓 Logga ut-knapp visas endast om användaren är inloggad */}
                {isLoggedIn() && (
                    <button onClick={handleLogout} className="logout-button">Logga ut</button>
                )}
            </main>
        </>
    );
}

export default App;
