import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logoutUser, refreshAccessToken } from "../api/api";
import ConsentModal from "../components/Auth/ConsentModal";
import type { AuthContextProps, User } from "../types/index";
import { tokenStorage } from "../utils/secureStorage";

// 🎯 Skapa AuthContext för att hantera autentisering globalt i appen
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [token, setTokenState] = useState<string | null>(null);
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

    // Load token from secure storage
    tokenStorage.getAccessToken().then(storedToken => {
      if (!storedToken || !user) {
        // Don't redirect if already on login or register pages
        const currentPath = location.pathname;
        if (currentPath !== '/login' && currentPath !== '/register') {
          console.warn("⚠️ No valid session found, redirecting to /login...");
          navigate("/login", { replace: true });
        }
      } else {
        console.log("✅ Token & user loaded from secure storage:", user);
        setTokenState(storedToken);
      }
      setIsInitialized(true);
    }).catch(error => {
      console.error("❌ Failed to load token from secure storage:", error);
      setIsInitialized(true);
    });
  }, [user, navigate, setIsInitialized, location]);

  // 🔄 Automatisk token-förnyelse - Förbättrad version
 useEffect(() => {
   if (!token || !user?.user_id) return;

   // Refresh token proactively every 20 hours (JWT expires after 24h)
   // This ensures token is always fresh before it expires
   const interval = setInterval(async () => {
     try {
       const newAccessToken = await refreshAccessToken();
       if (newAccessToken) {
         setTokenState(newAccessToken);
         await tokenStorage.setAccessToken(newAccessToken);
         console.log("🔄 Token refreshed automatically.");
       }
     } catch (error) {
       console.warn("⚠️ Token refresh failed. Please log in again.");
     }
   }, 20 * 60 * 60 * 1000); // 20 hours
   
   return () => clearInterval(interval);
 }, [token, user?.user_id]);

  // 🔑 Kontrollera om användaren är inloggad
  const isLoggedIn = useCallback(() => Boolean(token && user && user.user_id), [token, user]);

  // 🔓 Hantera inloggning och lagra användarinformation
  const login = useCallback(async (accessToken: string, email: string, user_id: string) => {
    const userData: User = { email, user_id };
    setTokenState(accessToken);
    setUserState(userData);

    // Store token securely
    await tokenStorage.setAccessToken(accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    console.log("✅ Användaren är inloggad:", userData);

    // Navigate to dashboard after successful login
    navigate("/dashboard");
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
      // Clear secure storage
      tokenStorage.clearTokens();
      // Keep consent_given in localStorage, only clear auth-related items
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
