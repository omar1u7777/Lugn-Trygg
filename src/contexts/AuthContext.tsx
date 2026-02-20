import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../api/api";
import ConsentModal from "../components/Auth/ConsentModal";
import type { AuthContextProps, User } from "../types/index";
import { tokenStorage, secureStorage } from "../utils/secureStorage";
import { logger } from '../utils/logger';

// 🎯 Skapa AuthContext för att hantera autentisering globalt i appen
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [token, setTokenState] = useState<string | null>(null);
   const [user, setUserState] = useState<User | null>(null);
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

  // ✅ Retrieve and validate token & user data on startup - FIXED: Proper loading state
  useEffect(() => {
    // Prevent multiple initialization attempts
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    const initializeAuth = async () => {
      try {
        // Load token from secure storage
        const storedToken = await tokenStorage.getAccessToken();
        const savedUserJson = await secureStorage.getItem('user');
        const userData = savedUserJson ? JSON.parse(savedUserJson) : null;
        
        if (storedToken && userData) {
          // Valid session exists - restore it BEFORE marking as initialized
          if ((import.meta as any).env?.DEV) {
            logger.debug("✅ Token & user loaded from secure storage:", userData);
          }
          setTokenState(storedToken);
          setUserState(userData);
        }
      } catch (error) {
        logger.error("❌ Failed to load token from secure storage:", error);
      } finally {
        // Mark as initialized AFTER state has been set
        setTimeout(() => setIsInitialized(true), 0);
      }
    };

    initializeAuth();
  }, []); // Empty deps - only run once on mount

  // 🔑 Kontrollera om användaren är inloggad (memoized for performance)
  const isLoggedIn = useMemo(() => {
    return Boolean(token && user && user.user_id);
  }, [token, user]);

  // 🔓 Hantera inloggning och lagra användarinformation
  const login = useCallback(async (accessToken: string, emailOrUser: string | User, userId?: string) => {
    logger.debug('🔑 AUTH CONTEXT - Login called', { email: typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email });

    try {
      // Store token securely
      await tokenStorage.setAccessToken(accessToken);
      setTokenState(accessToken);

      // Handle user data
      let userData: User;
      if (typeof emailOrUser === 'string') {
        // Old signature: (token, email, userId)
        userData = {
          email: emailOrUser,
          user_id: userId || ''
        };
      } else {
        // New signature: (token, user)
        userData = emailOrUser;
      }

      setUserState(userData);
      await secureStorage.setItem('user', JSON.stringify(userData));

      logger.debug('✅ AUTH CONTEXT - Login successful:', { userId: userData.user_id });

      // ✅ FIX: Navigate to dashboard after successful login
      navigate("/dashboard");

    } catch (error) {
      logger.error('❌ AUTH CONTEXT - Login failed:', error);
      throw error;
    }
  }, [navigate]);

  // 🚪 Hantera utloggning och rensa användardata
  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      if ((import.meta as any).env?.DEV) {
        logger.warn("⚠️ Utloggning misslyckades, rensar ändå lokalt.");
      }
    } finally {
      setTokenState(null);
      setUserState(null);
      // Clear secure storage
      tokenStorage.clearTokens();
      // Keep consent_given in localStorage, only clear auth-related items
      secureStorage.removeItem('user');
      navigate("/login");
    }
  }, [navigate]);

  // 📦 Optimera prestanda genom att memo-isera autentiseringskontexten
  const value = useMemo<AuthContextProps>(
    () => ({ 
      user, 
      setUser: setUserState, 
      token, 
      setToken: setTokenState, 
      isLoggedIn, 
      login, 
      logout: handleLogout,
      isInitialized: uiState.isInitialized 
    }),
    [user, token, login, handleLogout, isLoggedIn, uiState.isInitialized]
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
