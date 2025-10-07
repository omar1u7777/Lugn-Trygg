import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logoutUser, refreshAccessToken } from "../api/api";
import ConsentModal from "../components/Auth/ConsentModal";
import type { AuthContextProps, User } from "../types/index";

// 🎯 Skapa AuthContext för att hantera autentisering globalt i appen
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
   const [user, setUserState] = useState<User | null>(() => {
      try {
        const savedUser = localStorage.getItem("user");
        return savedUser ? JSON.parse(savedUser) : null;
      } catch (error) {
        console.warn("Failed to parse user data from localStorage:", error);
        return null;
      }
    });
   // Internal UI state for initialization and modals
   const [uiState, setUiState] = useState<{
     isInitialized: boolean;
     isConsentModalOpen: boolean;
   }>({
     isInitialized: false,
     isConsentModalOpen: false,
   });

   // Helper functions to update UI state safely
   const setIsInitialized = useCallback((value: boolean) => {
     setUiState(prev => ({ ...prev, isInitialized: value }));
   }, []);

   const setIsConsentModalOpen = useCallback((value: boolean) => {
     setUiState(prev => ({ ...prev, isConsentModalOpen: value }));
   }, []);

   // Ref to track if initialization has been attempted
   const hasInitializedRef = useRef(false);
   const navigate = useNavigate();
   const location = useLocation();

  // ✅ Retrieve and validate token & user data on startup
  useEffect(() => {
    // Prevent multiple initialization attempts
    if (hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    if (!token || !user) {
      // Don't redirect if already on login or register pages
      const currentPath = location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        console.warn("⚠️ No valid session found, redirecting to /login...");
        navigate("/login", { replace: true });
      }
    } else {
      console.log("✅ Token & user loaded from localStorage:", user);
    }
    setIsInitialized(true);
  }, [token, user, navigate, setIsInitialized, location]);

  // 🔄 Automatisk token-förnyelse (var 14:e minut) - Förhindra race conditions
  useEffect(() => {
    if (!token) return;

    let isRefreshing = false;

    const refreshToken = async () => {
      // Förhindra flera samtidiga refresh-försök
      if (isRefreshing) return;

      isRefreshing = true;
      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          setTokenState(newAccessToken);
          localStorage.setItem("token", newAccessToken);
          console.log("🔄 Token förnyad automatiskt.");
        }
      } catch (error) {
        console.warn("⚠️ Token-förnyelse misslyckades, loggar ut användaren.");
        handleLogout();
      } finally {
        isRefreshing = false;
      }
    };

    const interval = setInterval(refreshToken, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  // 🔑 Kontrollera om användaren är inloggad
  const isLoggedIn = useCallback(() => Boolean(token && user?.user_id), [token, user]);

  // 🔓 Hantera inloggning och lagra användarinformation
  const login = useCallback(async (accessToken: string, email: string, user_id: string) => {
    const userData: User = { email, user_id };
    setTokenState(accessToken);
    setUserState(userData);

    localStorage.setItem("token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    console.log("✅ Användaren är inloggad:", userData);

    // Check if consent has been given (check localStorage first for better UX)
    const consentGiven = localStorage.getItem('consent_given');
    const consentVersion = localStorage.getItem('consent_version');

    if (consentGiven === 'true' && consentVersion === '1.0') {
      // Consent already given locally, proceed to dashboard
      navigate("/dashboard");
      return;
    }

    // Verify with backend as fallback
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/consent/${user_id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const consentData = await response.json();
        if (consentData.consent_given) {
          // Update localStorage if backend confirms
          localStorage.setItem('consent_given', 'true');
          localStorage.setItem('consent_version', consentData.version || '1.0');
          // Consent already given, proceed to dashboard
          navigate("/dashboard");
          return;
        }
      }
    } catch (error) {
      console.warn("Could not verify consent status with backend:", error);
      // If backend check fails but localStorage has consent, proceed anyway
      if (consentGiven === 'true') {
        navigate("/dashboard");
        return;
      }
    }

    // If we reach here, consent not given or verification failed
    setIsConsentModalOpen(true);
  }, [navigate]);

  // 🚪 Hantera utloggning och rensa användardata
  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.warn("⚠️ Utloggning misslyckades, rensar ändå lokalt.");
    } finally {
      setTokenState(null);
      setUserState(null);
      // Keep consent_given in localStorage, only clear auth-related items
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  }, [navigate]);

  // � Optimera prestanda genom att memo-isera autentiseringskontexten
  const value = useMemo<AuthContextProps>(
    () => ({ user, setUser: setUserState, token, setToken: setTokenState, isLoggedIn, login, logout: handleLogout }),
    [user, token, login, handleLogout, isLoggedIn]
  );

  const handleConsentClose = () => {
    setIsConsentModalOpen(false);
    navigate("/dashboard");
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {uiState.isConsentModalOpen && user && (
        <ConsentModal
          isOpen={uiState.isConsentModalOpen}
          onClose={handleConsentClose}
          userId={user.user_id}
        />
      )}
    </AuthContext.Provider>
  );
};

// 🏷 Hook för att hämta autentiseringsfunktioner i andra komponenter
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth måste användas inom en AuthProvider");
  }
  return context;
};
